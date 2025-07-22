const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const CompressionService = require('./compression');
const DatabaseService = require('./database');
const Config = require('./config');
const HttpClient = require('./http-client');
const Scheduler = require('./scheduler');

class MaritimeServer {
  constructor() {
    // Initialize configuration first
    this.config = new Config();
    
    this.app = express();
    this.port = this.config.port;
    this.compressionService = new CompressionService();
    this.databaseService = new DatabaseService();
    this.httpClient = new HttpClient();
    this.scheduler = new Scheduler(this.config, this.databaseService, this.compressionService, this.httpClient);
    
    // Statistics tracking
    this.stats = {
      totalRequests: 0,
      successfulWrites: 0,
      errors: 0,
      startTime: Date.now(),
      nodeType: this.config.nodeType
    };
    
    console.log(`🚢 Maritime Server initializing in ${this.config.nodeType} mode`);
  }

  /**
   * Initialize server
   */
  async initialize() {
    try {
      // Initialize database
      await this.databaseService.initialize();
      
      // Optimized SQLite settings for containerized environment
      this.databaseService.db.run('PRAGMA cache_size=-524288;'); // 512MB cache (negative means MB)
      this.databaseService.db.run('PRAGMA mmap_size=2147483648;'); // 2GB mmap for Docker with sufficient memory
      this.databaseService.db.run('PRAGMA wal_autocheckpoint=10000;'); // Less frequent checkpoints
      this.databaseService.db.run('PRAGMA wal_checkpoint_fullfsync=OFF;'); // Faster WAL checkpoints
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Start scheduler if in master mode
      if (this.config.isMaster()) {
        this.scheduler.start();
      }
      
      // Start server
      this.start();
      
      console.log(`Maritime Container Server initialized successfully in ${this.config.nodeType} mode`);
    } catch (error) {
      console.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      }
    }));
    
    // CORS
    this.app.use(cors());
    
    // Body parsing
    this.app.use(express.json({ limit: '100mb' })); // Increased for compressed data
    this.app.use(express.urlencoded({ extended: true, limit: '100mb' }));
    
    // Static files
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Request logging
    this.app.use((req, res, next) => {
      this.stats.totalRequests++;
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * Setup API routes based on master/slave mode
   */
  setupRoutes() {
    // Home page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Health check endpoint (available in both modes)
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        nodeType: this.config.nodeType,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.stats.startTime,
        config: this.config.getSummary()
      });
    });

    // Slave-only endpoint: Receive and forward compressed data
    if (this.config.isSlave()) {
      this.setupSlaveRoutes();
    }

    // Master-only endpoints: Container data ingestion and management
    if (this.config.isMaster()) {
      this.setupMasterRoutes();
    }

    // Common endpoints for stats and health
    this.setupCommonRoutes();

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });
  }

  /**
   * Setup slave-specific routes
   */
  setupSlaveRoutes() {
    console.log('🔗 Setting up slave-specific routes');

    // Receive compressed data from master and forward it
    this.app.post('/api/receive-compressed', async (req, res) => {
      try {
        const { compressedData, metadata } = req.body;
        
        if (!compressedData) {
          return res.status(400).json({ error: 'Missing compressedData in request body' });
        }

        console.log(`📨 Received compressed data from master`);
        console.log(`📊 Metadata:`, metadata);

        // Convert base64 back to buffer
        const compressedBuffer = Buffer.from(compressedData, 'base64');
        console.log(`📊 Compressed data size: ${this.formatBytes(compressedBuffer.length)}`);

        // Decompress the data
        console.log('🔓 Decompressing received data...');
        const decompressedContainers = await this.compressionService.decompressMultiple(compressedBuffer);
        
        console.log(`✅ Successfully decompressed ${decompressedContainers.length} containers`);

        // Forward decompressed data to target endpoint
        console.log('📨 Forwarding decompressed data...');
        const forwardResult = await this.httpClient.forwardDecompressedData(
          this.config.getForwardToUrl(),
          decompressedContainers,
          {
            receivedAt: new Date().toISOString(),
            originalMetadata: metadata,
            decompressedContainerCount: decompressedContainers.length
          }
        );

        if (forwardResult.success) {
          console.log(`✅ Successfully forwarded ${decompressedContainers.length} containers`);
          res.json({
            success: true,
            message: 'Data received, decompressed, and forwarded successfully',
            containersProcessed: decompressedContainers.length,
            forwardResult: {
              status: forwardResult.responseStatus,
              forwardedContainers: forwardResult.forwardedContainers
            }
          });
        } else {
          console.error('❌ Failed to forward decompressed data:', forwardResult.error);
          res.status(500).json({
            success: false,
            error: 'Failed to forward decompressed data',
            details: forwardResult.error,
            containersProcessed: decompressedContainers.length
          });
        }

      } catch (error) {
        this.stats.errors++;
        console.error('❌ Error processing compressed data:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to process compressed data',
          message: error.message
        });
      }
    });
  }

  /**
   * Setup master-specific routes
   */
  setupMasterRoutes() {
    console.log('🎯 Setting up master-specific routes');

    // Container data ingestion endpoint
    this.app.post('/api/container', async (req, res) => {
      try {
        const containerData = req.body;
        
        // Validate required fields
        if (!containerData.containerId && !containerData.iso6346) {
          return res.status(400).json({ 
            error: 'Container ID is required (containerId or iso6346)' 
          });
        }

        const containerId = containerData.containerId || containerData.iso6346;
        
        // Compress the data
        const compressedData = await this.compressionService.compress(containerData);
        
        // Add to queue (returns immediately for fast response)
        const queueResult = await this.databaseService.addToQueue(containerId, compressedData);
        
        this.stats.successfulWrites++;
        
        res.status(201).json({ 
          success: true, 
          containerId,
          compressionRatio: this.compressionService.getCompressionRatio(containerData, compressedData),
          queue: queueResult
        });
        
      } catch (error) {
        this.stats.errors++;
        console.error('Error processing container data:', error);
        res.status(500).json({ 
          error: 'Failed to process container data',
          message: error.message 
        });
      }
    });

    // Bulk container data ingestion
    this.app.post('/api/containers/bulk', async (req, res) => {
      try {
        const containers = req.body.containers || req.body;
        
        if (!Array.isArray(containers)) {
          return res.status(400).json({ error: 'Expected array of containers' });
        }

        const results = [];
        const errors = [];
        const startTime = Date.now();

        // Process all containers in parallel for maximum speed
        const promises = containers.map(async (containerData, index) => {
          try {
            const containerId = containerData.containerId || containerData.iso6346;
            
            if (!containerId) {
              errors.push({ index, container: containerData, error: 'Missing container ID' });
              return null;
            }

            const compressedData = await this.compressionService.compress(containerData);
            const queueResult = await this.databaseService.addToQueue(containerId, compressedData);
            
            this.stats.successfulWrites++;
            return { index, containerId, success: true, queue: queueResult };
            
          } catch (error) {
            errors.push({ index, container: containerData, error: error.message });
            this.stats.errors++;
            return null;
          }
        });

        // Wait for all processing to complete
        const allResults = await Promise.all(promises);
        const successfulResults = allResults.filter(r => r !== null);
        
        const processingTime = Date.now() - startTime;
        const throughput = containers.length / (processingTime / 1000);

        res.json({ 
          processed: successfulResults.length,
          errors: errors.length,
          totalContainers: containers.length,
          processingTimeMs: processingTime,
          throughputPerSecond: Math.round(throughput),
          results: successfulResults.slice(0, 10),
          errors: errors.slice(0, 5),
          queue: this.databaseService.getQueueStatus()
        });
        
      } catch (error) {
        this.stats.errors++;
        console.error('Error processing bulk container data:', error);
        res.status(500).json({ 
          error: 'Failed to process bulk container data',
          message: error.message 
        });
      }
    });

    // Manual trigger for compression task (testing purposes)
    this.app.post('/api/compress-send', async (req, res) => {
      try {
        console.log('🔧 Manual compression task triggered');
        await this.scheduler.forceRun();
        res.json({ 
          success: true, 
          message: 'Compression task triggered successfully' 
        });
      } catch (error) {
        console.error('Manual compression task failed:', error);
        res.status(500).json({ 
          error: 'Failed to trigger compression task',
          message: error.message 
        });
      }
    });

    // Get scheduler statistics
    this.app.get('/api/scheduler/stats', (req, res) => {
      res.json(this.scheduler.getStats());
    });
  }

  /**
   * Setup common routes available in both modes
   */
  setupCommonRoutes() {
    // System statistics
    this.app.get('/api/stats', async (req, res) => {
      try {
        const dbStats = await this.databaseService.getStats();
        const queueStatus = this.databaseService.getQueueStatus();
        
        const systemStats = {
          ...this.stats,
          uptime: Date.now() - this.stats.startTime,
          database: dbStats,
          writeQueue: queueStatus,
          nodeType: this.config.nodeType,
          scheduler: this.config.isMaster() ? this.scheduler.getStats() : null
        };

        res.json(systemStats);
        
      } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
          error: 'Failed to fetch stats',
          message: error.message 
        });
      }
    });

    // Get recent container data (master only functionality but available for compatibility)
    this.app.get('/api/containers', async (req, res) => {
      if (this.config.isSlave()) {
        return res.status(403).json({ 
          error: 'Container data access not available in slave mode' 
        });
      }

      try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        
        const rows = await this.databaseService.getRecentContainerData(limit, offset);
        
        // Decompress data for response
        const containers = await Promise.all(rows.map(async (row) => {
          try {
            const decompressedData = await this.compressionService.decompress(row.compressed_data);
            return {
              id: row.id,
              containerId: row.container_id,
              timestamp: row.timestamp,
              data: decompressedData
            };
          } catch (error) {
            console.error('Error decompressing data for container:', row.container_id, error);
            return {
              id: row.id,
              containerId: row.container_id,
              timestamp: row.timestamp,
              error: 'Failed to decompress data'
            };
          }
        }));

        res.json({ containers, total: containers.length });
        
      } catch (error) {
        console.error('Error fetching container data:', error);
        res.status(500).json({ 
          error: 'Failed to fetch container data',
          message: error.message 
        });
      }
    });
  }

  /**
   * Helper to format bytes into a human-readable string
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Start the server
   */
  start() {
    this.app.listen(this.port, () => {
      console.log(`\n🚢 Maritime Container Server running on port ${this.port} (${this.config.nodeType} mode)`);
      console.log(`📊 Dashboard: http://localhost:${this.port}`);
      console.log(`🔌 API: http://localhost:${this.port}/api`);
      console.log(`💾 Database: SQLite with Brotli compression`);
      if (this.config.isMaster()) {
        console.log(`📤 Send to: ${this.config.getSendToUrl()}`);
        console.log(`⏰ Compression schedule: every ${this.config.compressionScheduleHours} hours`);
      }
      if (this.config.isSlave()) {
        console.log(`📨 Forward to: ${this.config.getForwardToUrl()}`);
      }
      console.log(`⚡ Ready to handle maritime container data\n`);
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down server...');
    if (this.scheduler) {
      this.scheduler.stop();
    }
    await this.databaseService.close();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  if (global.server) {
    await global.server.shutdown();
  }
});

process.on('SIGTERM', async () => {
  if (global.server) {
    await global.server.shutdown();
  }
});

// Start server
if (require.main === module) {
  const server = new MaritimeServer();
  global.server = server;
  server.initialize();
}

module.exports = MaritimeServer; 
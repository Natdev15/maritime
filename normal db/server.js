const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const DatabaseService = require('./database');

class MaritimeServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.databaseService = new DatabaseService();
    
    // Statistics tracking
    this.stats = {
      totalRequests: 0,
      successfulWrites: 0,
      errors: 0,
      startTime: Date.now(),
      totalDataSize: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Initialize server
   */
  async initialize() {
    try {
      // Initialize database
      await this.databaseService.initialize();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Start server
      this.start();
      
      console.log('Maritime Container Server initialized successfully');
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
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Request logging and timing
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      this.stats.totalRequests++;
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Home page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Container data ingestion endpoint
    this.app.post('/api/container', async (req, res) => {
      const requestStartTime = Date.now();
      
      try {
        const containerData = req.body;
        
        // Validate required fields
        if (!containerData.containerId && !containerData.iso6346) {
          return res.status(400).json({ 
            error: 'Container ID is required (containerId or iso6346)' 
          });
        }

        const containerId = containerData.containerId || containerData.iso6346;
        
        // Calculate data size
        const dataSize = Buffer.byteLength(JSON.stringify(containerData), 'utf8');
        this.stats.totalDataSize += dataSize;
        
        // Add to queue (returns immediately for fast response)
        const queueResult = await this.databaseService.addToQueue(containerId, containerData);
        
        this.stats.successfulWrites++;
        
        const responseTime = Date.now() - requestStartTime;
        this.stats.avgResponseTime = (this.stats.avgResponseTime + responseTime) / 2;
        
        res.status(201).json({ 
          success: true, 
          containerId,
          dataSize: dataSize,
          responseTimeMs: responseTime,
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

    // Bulk container data ingestion (optimized for high throughput)
    this.app.post('/api/containers/bulk', async (req, res) => {
      const requestStartTime = Date.now();
      
      try {
        const containers = req.body.containers || req.body;
        
        if (!Array.isArray(containers)) {
          return res.status(400).json({ error: 'Expected array of containers' });
        }

        const results = [];
        const errors = [];
        let totalDataSize = 0;

        // Process all containers in parallel for maximum speed
        const promises = containers.map(async (containerData, index) => {
          try {
            const containerId = containerData.containerId || containerData.iso6346;
            
            if (!containerId) {
              errors.push({ index, container: containerData, error: 'Missing container ID' });
              return null;
            }

            const dataSize = Buffer.byteLength(JSON.stringify(containerData), 'utf8');
            totalDataSize += dataSize;
            
            const queueResult = await this.databaseService.addToQueue(containerId, containerData);
            
            this.stats.successfulWrites++;
            return { 
              index, 
              containerId, 
              success: true, 
              dataSize: dataSize,
              queue: queueResult 
            };
            
          } catch (error) {
            errors.push({ index, container: containerData, error: error.message });
            this.stats.errors++;
            return null;
          }
        });

        // Wait for all processing to complete
        const allResults = await Promise.all(promises);
        const successfulResults = allResults.filter(r => r !== null);
        
        const processingTime = Date.now() - requestStartTime;
        const throughput = containers.length / (processingTime / 1000);
        const avgDataSize = totalDataSize / containers.length;
        
        this.stats.totalDataSize += totalDataSize;
        this.stats.avgResponseTime = (this.stats.avgResponseTime + processingTime) / 2;

        res.json({ 
          processed: successfulResults.length,
          errors: errors.length,
          totalContainers: containers.length,
          processingTimeMs: processingTime,
          throughputPerSecond: Math.round(throughput),
          totalDataSizeBytes: totalDataSize,
          avgDataSizeBytes: Math.round(avgDataSize),
          results: successfulResults.slice(0, 10), // Limit response size
          errors: errors.slice(0, 5), // Limit error details
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

    // Get recent container data
    this.app.get('/api/containers', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        
        const rows = await this.databaseService.getRecentContainerData(limit, offset);
        
        // Transform data for response
        const containers = rows.map((row) => {
          return {
            id: row.id,
            containerId: row.container_id,
            iso6346: row.iso6346,
            msisdn: row.msisdn,
            time: row.time,
            rssi: row.rssi,
            cgi: row.cgi,
            bleM: row.ble_m,
            batSoc: row.bat_soc,
            acc: row.acc,
            temperature: row.temperature,
            humidity: row.humidity,
            pressure: row.pressure,
            door: row.door,
            gnss: row.gnss,
            latitude: row.latitude,
            longitude: row.longitude,
            altitude: row.altitude,
            speed: row.speed,
            heading: row.heading,
            nsat: row.nsat,
            hdop: row.hdop,
            timestamp: row.timestamp,
            rowSize: row.row_size,
            processingTime: row.processing_time_ms,
            createdAt: row.created_at
          };
        });

        res.json({ 
          containers, 
          total: containers.length,
          totalDataSize: containers.reduce((sum, c) => sum + (c.rowSize || 0), 0),
          avgRowSize: containers.length > 0 ? 
            Math.round(containers.reduce((sum, c) => sum + (c.rowSize || 0), 0) / containers.length) : 0
        });
        
      } catch (error) {
        console.error('Error fetching container data:', error);
        res.status(500).json({ 
          error: 'Failed to fetch container data',
          message: error.message 
        });
      }
    });

    // Get specific container data
    this.app.get('/api/containers/:containerId', async (req, res) => {
      try {
        const { containerId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        
        const rows = await this.databaseService.getContainerData(containerId, limit);
        
        const containerHistory = rows.map((row) => {
          return {
            id: row.id,
            containerId: row.container_id,
            iso6346: row.iso6346,
            msisdn: row.msisdn,
            time: row.time,
            rssi: row.rssi,
            cgi: row.cgi,
            bleM: row.ble_m,
            batSoc: row.bat_soc,
            acc: row.acc,
            temperature: row.temperature,
            humidity: row.humidity,
            pressure: row.pressure,
            door: row.door,
            gnss: row.gnss,
            latitude: row.latitude,
            longitude: row.longitude,
            altitude: row.altitude,
            speed: row.speed,
            heading: row.heading,
            nsat: row.nsat,
            hdop: row.hdop,
            timestamp: row.timestamp,
            rowSize: row.row_size,
            processingTime: row.processing_time_ms,
            createdAt: row.created_at
          };
        });

        res.json({ 
          containerId,
          history: containerHistory,
          total: containerHistory.length,
          totalDataSize: containerHistory.reduce((sum, c) => sum + (c.rowSize || 0), 0),
          avgRowSize: containerHistory.length > 0 ? 
            Math.round(containerHistory.reduce((sum, c) => sum + (c.rowSize || 0), 0) / containerHistory.length) : 0
        });
        
      } catch (error) {
        console.error('Error fetching container data:', error);
        res.status(500).json({ 
          error: 'Failed to fetch container data',
          message: error.message 
        });
      }
    });

    // Get system statistics
    this.app.get('/api/stats', async (req, res) => {
      try {
        const dbStats = await this.databaseService.getStats();
        const dbInfo = await this.databaseService.getDatabaseInfo();
        const queueStatus = this.databaseService.getQueueStatus();
        
        const uptime = Date.now() - this.stats.startTime;
        
        res.json({
          server: {
            uptime: uptime,
            uptimeHours: (uptime / (1000 * 60 * 60)).toFixed(2),
            totalRequests: this.stats.totalRequests,
            successfulWrites: this.stats.successfulWrites,
            errors: this.stats.errors,
            successRate: this.stats.totalRequests > 0 ? 
              ((this.stats.successfulWrites / this.stats.totalRequests) * 100).toFixed(2) : 0,
            avgResponseTime: Math.round(this.stats.avgResponseTime),
            totalDataProcessed: this.stats.totalDataSize,
            totalDataProcessedMB: (this.stats.totalDataSize / (1024 * 1024)).toFixed(2)
          },
          database: {
            totalRecords: dbStats.totalRecords?.[0]?.count || 0,
            uniqueContainers: dbStats.uniqueContainers?.[0]?.count || 0,
            avgRowSize: Math.round(dbStats.avgRowSize?.[0]?.avg || 0),
            totalSize: dbStats.totalSize?.[0]?.total || 0,
            totalSizeMB: ((dbStats.totalSize?.[0]?.total || 0) / (1024 * 1024)).toFixed(2),
            avgProcessingTime: Math.round(dbStats.avgProcessingTime?.[0]?.avg || 0),
            fileSizeMB: dbInfo.fileSizeMB,
            recentActivity: dbStats.recentActivity || []
          },
          performance: {
            avgBatchSize: this.databaseService.getPerformanceMetrics().avgBatchSize,
            avgProcessingTime: this.databaseService.getPerformanceMetrics().avgProcessingTime,
            avgRowSize: this.databaseService.getPerformanceMetrics().avgRowSize
          },
          queue: queueStatus
        });
        
      } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
          error: 'Failed to fetch statistics',
          message: error.message 
        });
      }
    });



    // Force process queue (for testing)
    this.app.post('/api/queue/process', async (req, res) => {
      try {
        const result = await this.databaseService.forceProcessQueue();
        res.json(result);
      } catch (error) {
        console.error('Error force processing queue:', error);
        res.status(500).json({ 
          error: 'Failed to process queue',
          message: error.message 
        });
      }
    });

    // Get queue status
    this.app.get('/api/queue', (req, res) => {
      try {
        const queueStatus = this.databaseService.getQueueStatus();
        const performanceMetrics = this.databaseService.getPerformanceMetrics();
        
        res.json({
          queue: queueStatus,
          performance: performanceMetrics
        });
      } catch (error) {
        console.error('Error fetching queue status:', error);
        res.status(500).json({ 
          error: 'Failed to fetch queue status',
          message: error.message 
        });
      }
    });

    // Database maintenance endpoints
    this.app.post('/api/maintenance/cleanup', async (req, res) => {
      try {
        const daysToKeep = parseInt(req.body.days) || 30;
        await this.databaseService.cleanupOldRecords(daysToKeep);
        res.json({ success: true, message: `Cleaned up records older than ${daysToKeep} days` });
      } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ 
          error: 'Failed to cleanup database',
          message: error.message 
        });
      }
    });

    this.app.post('/api/maintenance/optimize', async (req, res) => {
      try {
        await this.databaseService.optimizeDatabase();
        res.json({ success: true, message: 'Database optimized successfully' });
      } catch (error) {
        console.error('Error during optimization:', error);
        res.status(500).json({ 
          error: 'Failed to optimize database',
          message: error.message 
        });
      }
    });

    // Health check endpoint
    this.app.get('/api/health', (req, res) => {
      const uptime = Date.now() - this.stats.startTime;
      const queueStatus = this.databaseService.getQueueStatus();
      
      res.json({
        status: 'healthy',
        uptime: uptime,
        uptimeSeconds: Math.floor(uptime / 1000),
        timestamp: new Date().toISOString(),
        queue: queueStatus,
        stats: {
          totalRequests: this.stats.totalRequests,
          successfulWrites: this.stats.successfulWrites,
          errors: this.stats.errors,
          avgResponseTime: Math.round(this.stats.avgResponseTime)
        }
      });
    });
  }

  /**
   * Start the server
   */
  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`🚢 Maritime Container Server running on port ${this.port}`);
      console.log(`📊 Access dashboard at: http://localhost:${this.port}`);
      console.log(`📈 API endpoints available at: http://localhost:${this.port}/api/*`);
      console.log(`💾 Database: ${this.databaseService.dbPath}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🔄 Shutting down Maritime Container Server...');
    
    try {
      // Close server
      if (this.server) {
        this.server.close();
        console.log('✅ HTTP server closed');
      }
      
      // Close database
      await this.databaseService.close();
      console.log('✅ Database connection closed');
      
      console.log('🚪 Server shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Initialize and start server
const server = new MaritimeServer();
server.initialize().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = MaritimeServer;
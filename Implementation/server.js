const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const CompressionService = require('./compression');
const DatabaseService = require('./database');

class MaritimeServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.compressionService = new CompressionService();
    this.databaseService = new DatabaseService();
    
    // Statistics tracking
    this.stats = {
      totalRequests: 0,
      successfulWrites: 0,
      errors: 0,
      startTime: Date.now()
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
    
    // Request logging
    this.app.use((req, res, next) => {
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
        
        // Queue for database write
        await this.databaseService.queueWrite(containerId, compressedData);
        
        this.stats.successfulWrites++;
        
        res.status(201).json({ 
          success: true, 
          containerId,
          compressionRatio: this.compressionService.getCompressionRatio(containerData, compressedData)
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

        for (const containerData of containers) {
          try {
            const containerId = containerData.containerId || containerData.iso6346;
            
            if (!containerId) {
              errors.push({ container: containerData, error: 'Missing container ID' });
              continue;
            }

            const compressedData = await this.compressionService.compress(containerData);
            await this.databaseService.queueWrite(containerId, compressedData);
            
            results.push({ containerId, success: true });
            this.stats.successfulWrites++;
            
          } catch (error) {
            errors.push({ container: containerData, error: error.message });
            this.stats.errors++;
          }
        }

        res.json({ 
          processed: results.length,
          errors: errors.length,
          results,
          errors: errors.slice(0, 10) // Limit error details
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
        
        // Decompress data for response
        const containers = await Promise.all(rows.map(async (row) => {
          try {
            const decompressedData = await this.compressionService.decompress(row.compressed_data);
            return {
              id: row.id,
              containerId: row.container_id,
              timestamp: row.timestamp,
              createdAt: row.created_at,
              data: decompressedData
            };
          } catch (error) {
            console.error('Error decompressing data for container:', row.container_id, error);
            return {
              id: row.id,
              containerId: row.container_id,
              timestamp: row.timestamp,
              createdAt: row.created_at,
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

    // Get specific container data
    this.app.get('/api/containers/:containerId', async (req, res) => {
      try {
        const { containerId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        
        const rows = await this.databaseService.getContainerData(containerId, limit);
        
        const containerHistory = await Promise.all(rows.map(async (row) => {
          try {
            const decompressedData = await this.compressionService.decompress(row.compressed_data);
            return {
              timestamp: row.timestamp,
              createdAt: row.created_at,
              data: decompressedData
            };
          } catch (error) {
            console.error('Error decompressing data:', error);
            return {
              timestamp: row.timestamp,
              createdAt: row.created_at,
              error: 'Failed to decompress data'
            };
          }
        }));

        res.json({ 
          containerId, 
          history: containerHistory,
          total: containerHistory.length 
        });
        
      } catch (error) {
        console.error('Error fetching container history:', error);
        res.status(500).json({ 
          error: 'Failed to fetch container history',
          message: error.message 
        });
      }
    });

    // System statistics
    this.app.get('/api/stats', async (req, res) => {
      try {
        const dbStats = await this.databaseService.getStats();
        const queueStatus = this.databaseService.getQueueStatus();
        
        const systemStats = {
          ...this.stats,
          uptime: Date.now() - this.stats.startTime,
          database: dbStats,
          writeQueue: queueStatus
        };

        res.json(systemStats);
        
      } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
          error: 'Failed to fetch statistics',
          message: error.message 
        });
      }
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      const queueStatus = this.databaseService.getQueueStatus();
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.stats.startTime,
        queueLength: queueStatus.queueLength,
        memoryUsage: process.memoryUsage()
      };

      res.json(health);
    });

    // Database maintenance endpoints
    this.app.get('/api/database/info', async (req, res) => {
      try {
        const dbInfo = await this.databaseService.getDatabaseInfo();
        res.json(dbInfo);
      } catch (error) {
        console.error('Error fetching database info:', error);
        res.status(500).json({ 
          error: 'Failed to fetch database info',
          message: error.message 
        });
      }
    });

    this.app.post('/api/database/cleanup', async (req, res) => {
      try {
        const daysToKeep = parseInt(req.body.daysToKeep) || 30;
        const deletedRecords = await this.databaseService.cleanupOldRecords(daysToKeep);
        
        res.json({ 
          success: true,
          deletedRecords,
          daysToKeep,
          message: `Cleaned up ${deletedRecords} records older than ${daysToKeep} days`
        });
      } catch (error) {
        console.error('Error cleaning up database:', error);
        res.status(500).json({ 
          error: 'Failed to cleanup database',
          message: error.message 
        });
      }
    });

    this.app.post('/api/database/optimize', async (req, res) => {
      try {
        await this.databaseService.optimizeDatabase();
        const dbInfo = await this.databaseService.getDatabaseInfo();
        
        res.json({ 
          success: true,
          message: 'Database optimization completed',
          databaseInfo: dbInfo
        });
      } catch (error) {
        console.error('Error optimizing database:', error);
        res.status(500).json({ 
          error: 'Failed to optimize database',
          message: error.message 
        });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });
  }

  /**
   * Start the server
   */
  start() {
    this.app.listen(this.port, () => {
      console.log(`\n🚢 Maritime Container Server running on port ${this.port}`);
      console.log(`📊 Dashboard: http://localhost:${this.port}`);
      console.log(`🔌 API: http://localhost:${this.port}/api`);
      console.log(`💾 Database: SQLite with Brotli compression`);
      console.log(`⚡ Ready to handle 300+ containers/second\n`);
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down server...');
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
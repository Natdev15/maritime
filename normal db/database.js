const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseService {
  constructor() {
    this.dbPath = path.join(__dirname, 'maritime_containers.db');
    this.db = null;
    
    // Queue-based batching system for high throughput
    this.pendingQueue = [];
    this.maxQueueSize = 50000; // Allow larger queue for batch processing
    this.batchProcessInterval = 2000; // Process queue every 2 seconds
    this.batchTimer = null;
    this.isProcessingBatch = false;
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      totalBatches: 0,
      totalInserted: 0,
      lastBatchSize: 0,
      lastBatchTime: null,
      avgBatchSize: 0,
      avgRowSize: 0,
      avgProcessingTime: 0
    };
  }

  /**
   * Initialize database connection and setup
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }

        console.log('Connected to SQLite database');
        
        // Optimize SQLite for maximum performance with increased memory usage
        this.db.serialize(() => {
          // WAL mode for better concurrent access
          this.db.run('PRAGMA journal_mode=WAL;');
          
          // Optimize for high-throughput batch writes with more aggressive settings
          this.db.run('PRAGMA synchronous=OFF;'); // Fastest but less safe
          this.db.run('PRAGMA cache_size=100000;'); // Increased from 20000 to 100000
          this.db.run('PRAGMA temp_store=MEMORY;');
          this.db.run('PRAGMA mmap_size=1073741824;'); // Increased to 1GB memory map
          this.db.run('PRAGMA page_size=4096;'); // Optimal page size
          this.db.run('PRAGMA locking_mode=EXCLUSIVE;'); // Faster writes, no concurrent access
          
          // Disable auto vacuum for better performance
          this.db.run('PRAGMA auto_vacuum=NONE;');
          
          this.createTables()
            .then(() => {
              this.startBatchProcessor();
              console.log(`📦 Queue-based batch processor started (${this.batchProcessInterval/1000}s intervals)`);
              resolve();
            })
            .catch(reject);
        });
      });
    });
  }

  /**
   * Create necessary tables with individual fields
   */
  async createTables() {
    return new Promise((resolve, reject) => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS container_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          container_id TEXT NOT NULL,
          iso6346 TEXT,
          msisdn TEXT,
          time TEXT,
          rssi TEXT,
          cgi TEXT,
          ble_m TEXT,
          bat_soc TEXT,
          acc TEXT,
          temperature REAL,
          humidity REAL,
          pressure REAL,
          door TEXT,
          gnss TEXT,
          latitude REAL,
          longitude REAL,
          altitude REAL,
          speed REAL,
          heading REAL,
          nsat TEXT,
          hdop REAL,
          timestamp INTEGER NOT NULL,
          row_size INTEGER,
          processing_time_ms INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE INDEX IF NOT EXISTS idx_container_id ON container_data(container_id);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON container_data(timestamp);
        CREATE INDEX IF NOT EXISTS idx_iso6346 ON container_data(iso6346);
        CREATE INDEX IF NOT EXISTS idx_created_at ON container_data(created_at);
      `;

      this.db.exec(createTableSQL, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
        } else {
          console.log('Database tables created/verified');
          resolve();
        }
      });
    });
  }

  /**
   * Calculate size of a container data object
   */
  calculateRowSize(containerData) {
    return Buffer.byteLength(JSON.stringify(containerData), 'utf8');
  }

  /**
   * Add container data to queue - Returns immediately for fast response
   */
  async addToQueue(containerId, containerData, timestamp = null) {
    return new Promise((resolve, reject) => {
      // Check queue size limit
      if (this.pendingQueue.length >= this.maxQueueSize) {
        reject(new Error(`Queue full (${this.maxQueueSize} items). High load detected.`));
        return;
      }

      // Convert timestamp to Unix timestamp for efficient storage
      const unixTimestamp = timestamp ? new Date(timestamp).getTime() : Date.now();
      const rowSize = this.calculateRowSize(containerData);

      // Add to queue with size tracking
      this.pendingQueue.push({
        containerId,
        containerData,
        timestamp: unixTimestamp,
        rowSize,
        queuedAt: Date.now()
      });

      this.metrics.totalRequests++;

      // Resolve immediately - data is queued for processing
      resolve({
        success: true,
        queued: true,
        queuePosition: this.pendingQueue.length,
        nextBatchIn: this.getTimeUntilNextBatch(),
        estimatedRowSize: rowSize
      });
    });
  }

  /**
   * Start the batch processor that runs every 2 seconds
   */
  startBatchProcessor() {
    const processBatch = async () => {
      if (this.isProcessingBatch) {
        return; // Skip if already processing
      }

      if (this.pendingQueue.length === 0) {
        return; // Nothing to process
      }

      this.isProcessingBatch = true;
      const batchStartTime = Date.now();
      
      try {
        // Take entire queue for processing
        const batchData = [...this.pendingQueue];
        this.pendingQueue = []; // Clear queue immediately
        
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`🚀 Processing batch ${batchId}: ${batchData.length} containers`);
        
        // Process the entire batch in a single transaction
        const result = await this.processBatchInsert(batchData, batchId);
        
        // Update metrics
        this.metrics.totalBatches++;
        this.metrics.totalInserted += result.insertedCount;
        this.metrics.lastBatchSize = batchData.length;
        this.metrics.lastBatchTime = Date.now();
        this.metrics.avgBatchSize = this.metrics.totalInserted / this.metrics.totalBatches;
        this.metrics.avgRowSize = result.avgRowSize;
        this.metrics.avgProcessingTime = result.processingTime;
        
        const processingTime = Date.now() - batchStartTime;
        console.log(`✅ Batch ${batchId} completed: ${result.insertedCount} inserted in ${processingTime}ms (${(result.insertedCount/processingTime*1000).toFixed(0)} ops/sec)`);
        console.log(`📊 Avg row size: ${result.avgRowSize} bytes, Total batch size: ${result.totalSize} bytes`);
        
      } catch (error) {
        console.error('❌ Batch processing error:', error);
        // On error, items are lost from queue but this prevents blocking
        // In production, you might want to implement a retry mechanism
      } finally {
        this.isProcessingBatch = false;
      }
    };

    // Start the interval processor
    this.batchTimer = setInterval(processBatch, this.batchProcessInterval);
    
    // Also process immediately if queue gets very large
    const checkLargeQueue = () => {
      if (this.pendingQueue.length > 1000 && !this.isProcessingBatch) {
        console.log(`📊 Large queue detected (${this.pendingQueue.length}), processing early`);
        processBatch();
      }
    };
    
    setInterval(checkLargeQueue, 1000); // Check every second
  }

  /**
   * Process batch insert with individual fields and performance tracking
   */
  async processBatchInsert(batchData, batchId) {
    return new Promise((resolve, reject) => {
      if (batchData.length === 0) {
        resolve({ insertedCount: 0, avgRowSize: 0, totalSize: 0, processingTime: 0 });
        return;
      }

      const batchStartTime = Date.now();
      let insertedCount = 0;
      let totalSize = 0;
      const db = this.db;

      db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION');

        // Prepare insert statement for container data
        const containerStmt = db.prepare(`
          INSERT INTO container_data (
            container_id, iso6346, msisdn, time, rssi, cgi, ble_m, bat_soc, acc,
            temperature, humidity, pressure, door, gnss, latitude, longitude,
            altitude, speed, heading, nsat, hdop, timestamp, row_size, processing_time_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let errorOccurred = false;
        let processedCount = 0;

        // Process all items in the batch
        batchData.forEach((item) => {
          const rowStartTime = Date.now();
          const data = item.containerData;
          
          containerStmt.run([
            item.containerId,
            data.iso6346 || null,
            data.msisdn || null,
            data.time || null,
            data.rssi || null,
            data.cgi || null,
            data['ble-m'] || null,
            data['bat-soc'] || null,
            data.acc || null,
            parseFloat(data.temperature) || null,
            parseFloat(data.humidity) || null,
            parseFloat(data.pressure) || null,
            data.door || null,
            data.gnss || null,
            parseFloat(data.latitude) || null,
            parseFloat(data.longitude) || null,
            parseFloat(data.altitude) || null,
            parseFloat(data.speed) || null,
            parseFloat(data.heading) || null,
            data.nsat || null,
            parseFloat(data.hdop) || null,
            item.timestamp,
            item.rowSize,
            Date.now() - rowStartTime
          ], function(err) {
            processedCount++;
            
            if (err) {
              if (!errorOccurred) {
                errorOccurred = true;
                console.error('Batch insert error:', err);
              }
            } else {
              insertedCount++;
              totalSize += item.rowSize;
            }

            // When all items are processed, finalize transaction
            if (processedCount === batchData.length) {
              containerStmt.finalize((finalizeErr) => {
                if (finalizeErr || errorOccurred) {
                  db.run('ROLLBACK', (rollbackErr) => {
                    if (rollbackErr) console.error('Rollback error:', rollbackErr);
                    reject(new Error('Batch transaction failed'));
                  });
                                  } else {
                    db.run('COMMIT', (commitErr) => {
                      if (commitErr) {
                        console.error('Commit error:', commitErr);
                        reject(commitErr);
                      } else {
                        const processingTime = Date.now() - batchStartTime;
                        const avgRowSize = insertedCount > 0 ? Math.round(totalSize / insertedCount) : 0;
                        
                        resolve({
                          insertedCount,
                          avgRowSize,
                          totalSize,
                          processingTime
                        });
                      }
                    });
                  }
              });
            }
          });
        });
      });
    });
  }

  /**
   * Get time until next batch processing
   */
  getTimeUntilNextBatch() {
    if (!this.batchTimer) return 0;
    
    const now = Date.now();
    const nextBatchTime = this.metrics.lastBatchTime + this.batchProcessInterval;
    return Math.max(0, nextBatchTime - now);
  }

  /**
   * Force process current queue (for testing/debugging)
   */
  async forceProcessQueue() {
    if (this.isProcessingBatch) {
      return { message: 'Batch already processing' };
    }

    if (this.pendingQueue.length === 0) {
      return { message: 'Queue is empty' };
    }

    // Trigger immediate processing
    const queueSize = this.pendingQueue.length;
    const batchData = [...this.pendingQueue];
    this.pendingQueue = [];
    
    try {
      const batchId = `force_batch_${Date.now()}`;
      const result = await this.processBatchInsert(batchData, batchId);
      return { 
        message: 'Queue processed successfully', 
        processed: result.insertedCount,
        batchId
      };
    } catch (error) {
      // Re-add to queue if processing failed
      this.pendingQueue.unshift(...batchData);
      throw error;
    }
  }

  /**
   * Get recent container data with all fields
   */
  async getRecentContainerData(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id, container_id, iso6346, msisdn, time, rssi, cgi, ble_m, bat_soc, acc,
          temperature, humidity, pressure, door, gnss, latitude, longitude,
          altitude, speed, heading, nsat, hdop, timestamp, row_size, processing_time_ms,
          created_at
        FROM container_data 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      this.db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get container data for specific container ID
   */
  async getContainerData(containerId, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id, container_id, iso6346, msisdn, time, rssi, cgi, ble_m, bat_soc, acc,
          temperature, humidity, pressure, door, gnss, latitude, longitude,
          altitude, speed, heading, nsat, hdop, timestamp, row_size, processing_time_ms,
          created_at
        FROM container_data 
        WHERE container_id = ? OR iso6346 = ?
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      this.db.all(sql, [containerId, containerId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get database statistics
   */
  async getStats() {
    return new Promise((resolve, reject) => {
      const queries = {
        totalRecords: 'SELECT COUNT(*) as count FROM container_data',
        uniqueContainers: 'SELECT COUNT(DISTINCT container_id) as count FROM container_data',
        avgRowSize: 'SELECT AVG(row_size) as avg FROM container_data WHERE row_size IS NOT NULL',
        totalSize: 'SELECT SUM(row_size) as total FROM container_data WHERE row_size IS NOT NULL',
        avgProcessingTime: 'SELECT AVG(processing_time_ms) as avg FROM container_data WHERE processing_time_ms IS NOT NULL',
                 recentActivity: `
           SELECT 
             DATE(created_at, 'unixepoch') as date,
             COUNT(*) as count,
             AVG(row_size) as avg_size,
             AVG(processing_time_ms) as avg_processing_time
           FROM container_data 
           WHERE created_at > (strftime('%s', 'now') - 86400)
           GROUP BY DATE(created_at, 'unixepoch')
           ORDER BY date DESC
         `
      };

      const results = {};
      let completed = 0;
      const total = Object.keys(queries).length;

      Object.entries(queries).forEach(([key, sql]) => {
        this.db.all(sql, [], (err, rows) => {
          if (err) {
            console.error(`Error executing ${key} query:`, err);
            results[key] = null;
          } else {
            results[key] = rows;
          }
          
          completed++;
          if (completed === total) {
            resolve(results);
          }
        });
      });
    });
  }



  /**
   * Clean up old records to manage database size
   */
  async cleanupOldRecords(daysToKeep = 30) {
    return new Promise((resolve, reject) => {
      const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
      
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Delete old container data
        this.db.run(
          'DELETE FROM container_data WHERE created_at < ?',
          [cutoffTime],
          function(err) {
            if (err) {
              console.error('Error deleting old container data:', err);
              return;
            }
            console.log(`Deleted ${this.changes} old container records`);
          }
        );
        
        
        
        this.db.run('COMMIT', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Optimize database performance
   */
  async optimizeDatabase() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('VACUUM;');
        this.db.run('ANALYZE;');
        this.db.run('PRAGMA optimize;', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database optimized');
            resolve();
          }
        });
      });
    });
  }

  /**
   * Get database size and other info
   */
  async getDatabaseInfo() {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      
      try {
        const stats = fs.statSync(this.dbPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        this.db.get('PRAGMA page_count;', (err, pageCount) => {
          if (err) {
            reject(err);
            return;
          }
          
          this.db.get('PRAGMA page_size;', (err, pageSize) => {
            if (err) {
              reject(err);
              return;
            }
            
            resolve({
              fileSizeMB: parseFloat(sizeInMB),
              pageCount: pageCount.page_count,
              pageSize: pageSize.page_size,
              totalPages: pageCount.page_count * pageSize.page_size,
              path: this.dbPath
            });
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      length: this.pendingQueue.length,
      maxSize: this.maxQueueSize,
      isProcessing: this.isProcessingBatch,
      nextBatchIn: this.getTimeUntilNextBatch()
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.metrics,
      queueStatus: this.getQueueStatus()
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      totalBatches: 0,
      totalInserted: 0,
      lastBatchSize: 0,
      lastBatchTime: null,
      avgBatchSize: 0,
      avgRowSize: 0,
      avgProcessingTime: 0
    };
  }

  /**
   * Close database connection
   */
  async close() {
    return new Promise((resolve) => {
      if (this.batchTimer) {
        clearInterval(this.batchTimer);
      }
      
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = DatabaseService; 
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseService {
  constructor() {
    this.dbPath = path.join(__dirname, 'maritime_containers.db');
    this.db = null;
    this.writeQueue = [];
    this.isProcessingQueue = false;
    this.maxQueueSize = 10000; // Prevent memory overflow
    this.batchSize = 100; // Process writes in batches for efficiency
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
        
        // Optimize SQLite for performance and size
        this.db.serialize(() => {
          // WAL mode for better concurrent access
          this.db.run('PRAGMA journal_mode=WAL;');
          
          // More aggressive compression and caching
          this.db.run('PRAGMA synchronous=NORMAL;');
          this.db.run('PRAGMA cache_size=10000;');
          this.db.run('PRAGMA temp_store=MEMORY;');
          
          // Enable compression at SQLite level
          this.db.run('PRAGMA locking_mode=EXCLUSIVE;');
          
          // Auto vacuum for size management
          this.db.run('PRAGMA auto_vacuum=INCREMENTAL;');
          
          this.createTables()
            .then(() => {
              this.startQueueProcessor();
              resolve();
            })
            .catch(reject);
        });
      });
    });
  }

  /**
   * Create necessary tables
   */
  async createTables() {
    return new Promise((resolve, reject) => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS container_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          container_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          compressed_data BLOB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_container_id ON container_data(container_id);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON container_data(timestamp);
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
   * Add write operation to queue (thread-safe approach for SQLite)
   * @param {string} containerId 
   * @param {Buffer} compressedData 
   * @param {string} timestamp 
   */
  async queueWrite(containerId, compressedData, timestamp = null) {
    return new Promise((resolve, reject) => {
      if (this.writeQueue.length >= this.maxQueueSize) {
        reject(new Error('Write queue is full. Please try again later.'));
        return;
      }

      // Convert timestamp to Unix timestamp (INTEGER) for more efficient storage
      const unixTimestamp = timestamp ? new Date(timestamp).getTime() : Date.now();

      const writeOperation = {
        containerId,
        compressedData,
        timestamp: unixTimestamp,
        resolve,
        reject
      };

      this.writeQueue.push(writeOperation);
    });
  }

  /**
   * Process write queue in batches to handle high throughput
   */
  startQueueProcessor() {
    const processQueue = async () => {
      if (this.isProcessingQueue || this.writeQueue.length === 0) {
        setTimeout(processQueue, 10); // Check every 10ms
        return;
      }

      this.isProcessingQueue = true;

      try {
        // Process in batches for efficiency
        const batch = this.writeQueue.splice(0, Math.min(this.batchSize, this.writeQueue.length));
        
        if (batch.length > 0) {
          await this.processBatch(batch);
        }
      } catch (error) {
        console.error('Error processing write queue:', error);
      } finally {
        this.isProcessingQueue = false;
        setTimeout(processQueue, 1); // Continue processing
      }
    };

    processQueue();
  }

  /**
   * Process a batch of write operations using transaction
   */
  async processBatch(batch) {
    return new Promise((resolve, reject) => {
      const db = this.db; // Capture the database reference
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare(`
          INSERT INTO container_data (container_id, timestamp, compressed_data)
          VALUES (?, ?, ?)
        `);

        let errorOccurred = false;
        let completedCount = 0;

        batch.forEach((operation) => {
          stmt.run([operation.containerId, operation.timestamp, operation.compressedData], function(err) {
            completedCount++;
            
            if (err) {
              if (!errorOccurred) {
                errorOccurred = true;
                console.error('Error inserting data:', err);
                operation.reject(err);
              }
            } else {
              operation.resolve(this.lastID);
            }

            // Complete transaction when all operations are done
            if (completedCount === batch.length) {
              stmt.finalize();
              
              if (errorOccurred) {
                db.run('ROLLBACK');
              } else {
                db.run('COMMIT');
              }
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Get recent container data with pagination
   */
  async getRecentContainerData(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, container_id, timestamp, compressed_data
        FROM container_data
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `;

      this.db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Convert Unix timestamp back to ISO string for compatibility
          const processedRows = rows.map(row => ({
            ...row,
            timestamp: new Date(row.timestamp).toISOString(),
            created_at: new Date(row.timestamp).toISOString() // For backward compatibility
          }));
          resolve(processedRows);
        }
      });
    });
  }

  /**
   * Get data for specific container
   */
  async getContainerData(containerId, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, container_id, timestamp, compressed_data
        FROM container_data
        WHERE container_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      this.db.all(sql, [containerId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Convert Unix timestamp back to ISO string for compatibility
          const processedRows = rows.map(row => ({
            ...row,
            timestamp: new Date(row.timestamp).toISOString(),
            created_at: new Date(row.timestamp).toISOString() // For backward compatibility
          }));
          resolve(processedRows);
        }
      });
    });
  }

  /**
   * Get container statistics
   */
  async getStats() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT container_id) as unique_containers,
          AVG(LENGTH(compressed_data)) as avg_compressed_size,
          SUM(LENGTH(compressed_data)) as total_compressed_size,
          MIN(timestamp) as earliest_record,
          MAX(timestamp) as latest_record
        FROM container_data
      `;

      this.db.get(sql, (err, row) => {
        if (err) {
          reject(err);
        } else {
          // Convert timestamps back to ISO strings
          const stats = {
            ...row,
            earliest_record: row.earliest_record ? new Date(row.earliest_record).toISOString() : null,
            latest_record: row.latest_record ? new Date(row.latest_record).toISOString() : null,
            total_compressed_size_mb: (row.total_compressed_size / (1024 * 1024)).toFixed(2)
          };
          resolve(stats);
        }
      });
    });
  }

  /**
   * Clean up old records to manage database size
   * @param {number} daysToKeep - Number of days of data to keep
   */
  async cleanupOldRecords(daysToKeep = 30) {
    return new Promise((resolve, reject) => {
      const cutoffTimestamp = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      
      const sql = `DELETE FROM container_data WHERE timestamp < ?`;
      
      this.db.run(sql, [cutoffTimestamp], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log(`Cleaned up ${this.changes} old records (older than ${daysToKeep} days)`);
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Optimize database (vacuum and analyze)
   */
  async optimizeDatabase() {
    return new Promise((resolve, reject) => {
      console.log('Starting database optimization...');
      
      this.db.serialize(() => {
        // Incremental vacuum to reclaim space
        this.db.run('PRAGMA incremental_vacuum;', (err) => {
          if (err) {
            console.error('Error during incremental vacuum:', err);
            reject(err);
            return;
          }
          
          // Analyze tables for query optimization
          this.db.run('ANALYZE;', (err) => {
            if (err) {
              console.error('Error during analyze:', err);
              reject(err);
            } else {
              console.log('Database optimization completed');
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Get database file size and page info
   */
  async getDatabaseInfo() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          page_count * page_size as size_bytes,
          page_count,
          page_size,
          freelist_count
        FROM pragma_page_count(), pragma_page_size(), pragma_freelist_count()
      `;

      this.db.get(sql, (err, row) => {
        if (err) {
          reject(err);
        } else {
          const info = {
            ...row,
            size_mb: (row.size_bytes / (1024 * 1024)).toFixed(2),
            size_kb: (row.size_bytes / 1024).toFixed(2)
          };
          resolve(info);
        }
      });
    });
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus() {
    return {
      queueLength: this.writeQueue.length,
      isProcessing: this.isProcessingQueue,
      maxQueueSize: this.maxQueueSize
    };
  }

  /**
   * Close database connection
   */
  async close() {
    return new Promise((resolve) => {
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
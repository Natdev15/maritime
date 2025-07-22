/**
 * Scheduler for master node operations
 * Handles periodic compression and sending of all database data
 */
class Scheduler {
  constructor(config, databaseService, compressionService, httpClient) {
    this.config = config;
    this.databaseService = databaseService;
    this.compressionService = compressionService;
    this.httpClient = httpClient;
    
    this.schedulerTimer = null;
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunDuration: null,
      totalDataSent: 0,
      totalContainersProcessed: 0,
      totalDataCleaned: 0,
      cleanupOperations: 0
    };
  }

  /**
   * Start the scheduler (only works in master mode)
   */
  start() {
    if (!this.config.isMaster()) {
      console.log('📅 Scheduler not started - not in master mode');
      return;
    }

    if (this.schedulerTimer) {
      console.log('📅 Scheduler already running');
      return;
    }

    const intervalMs = this.config.getCompressionScheduleMs();
    console.log(`📅 Starting scheduler: every ${this.config.compressionScheduleHours} hours (${intervalMs}ms)`);
    
    // Run immediately on start (optional - can be disabled)
    const runImmediately = process.env.RUN_COMPRESSION_ON_START === 'true';
    if (runImmediately) {
      console.log('🚀 Running initial compression task...');
      setImmediate(() => this.runCompressionTask());
    }

    // Schedule recurring task
    this.schedulerTimer = setInterval(() => {
      this.runCompressionTask();
    }, intervalMs);

    console.log(`✅ Scheduler started successfully`);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
      console.log('📅 Scheduler stopped');
    }
  }

  /**
   * Run the compression and sending task
   */
  async runCompressionTask() {
    if (this.isRunning) {
      console.log('⏳ Compression task already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🔄 Starting scheduled compression task at ${new Date().toISOString()}`);
      
      // Step 1: Get all container data from database
      console.log('📦 Retrieving all container data from database...');
      const allContainerData = await this.databaseService.getAllContainerData();
      
      if (allContainerData.length === 0) {
        console.log('📭 No container data found in database, skipping compression');
        this.stats.totalRuns++;
        this.stats.successfulRuns++;
        return;
      }

      console.log(`📊 Found ${allContainerData.length} container records`);

      // Step 2: Decompress all data to get original JSON
      console.log('🔓 Decompressing container data...');
      const decompressedContainers = [];
      
      for (let i = 0; i < allContainerData.length; i++) {
        const record = allContainerData[i];
        try {
          const decompressedData = await this.compressionService.decompress(record.compressed_data);
          decompressedContainers.push({
            id: record.id,
            containerId: record.container_id,
            timestamp: record.timestamp,
            data: decompressedData
          });
        } catch (error) {
          console.error(`❌ Failed to decompress record ${record.id}:`, error.message);
          // Continue with other records
        }
      }

      console.log(`✅ Successfully decompressed ${decompressedContainers.length}/${allContainerData.length} records`);

      // Step 3: Compress all decompressed data together for efficient transmission
      console.log('🗜️ Compressing all data for transmission...');
      const bulkCompressedData = await this.compressionService.compressMultiple(decompressedContainers);
      
      const originalSize = JSON.stringify(decompressedContainers).length;
      const compressedSize = bulkCompressedData.length;
      const compressionRatio = originalSize / compressedSize;
      
      console.log(`📊 Compression complete:`);
      console.log(`   Original size: ${this.formatBytes(originalSize)}`);
      console.log(`   Compressed size: ${this.formatBytes(compressedSize)}`);
      console.log(`   Compression ratio: ${compressionRatio.toFixed(2)}:1`);

      // Step 4: Send compressed data to slave
      console.log('📤 Sending compressed data to slave...');
      const sendResult = await this.httpClient.sendCompressedData(
        this.config.getSendToUrl(),
        bulkCompressedData,
        {
          originalSize,
          compressionRatio,
          containerCount: decompressedContainers.length,
          compressionTimestamp: new Date().toISOString()
        }
      );

      if (sendResult.success) {
        console.log(`✅ Successfully sent compressed data to slave`);
        console.log(`📊 Sent ${this.formatBytes(sendResult.sentBytes)} to ${this.config.getSendToUrl()}`);
        
        // Step 5: Delete all data from database after successful transmission
        console.log('🗑️ Cleaning up database after successful transmission...');
        try {
          const deletedCount = await this.databaseService.deleteAllContainerData();
          console.log(`✅ Database cleanup complete: ${deletedCount} records deleted`);
          
          // Update cleanup statistics
          this.stats.totalDataCleaned += deletedCount;
          this.stats.cleanupOperations++;
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup database after transmission:', cleanupError.message);
          // Don't fail the whole process for cleanup errors
        }
        
        // Update statistics
        this.stats.successfulRuns++;
        this.stats.totalDataSent += sendResult.sentBytes;
        this.stats.totalContainersProcessed += decompressedContainers.length;
      } else {
        console.error(`❌ Failed to send compressed data to slave:`, sendResult.error);
        console.log('📦 Data retained in database due to failed transmission');
        this.stats.failedRuns++;
      }

      this.stats.totalRuns++;
      
    } catch (error) {
      console.error('❌ Compression task failed:', error);
      this.stats.totalRuns++;
      this.stats.failedRuns++;
    } finally {
      const duration = Date.now() - startTime;
      this.stats.lastRunDuration = duration;
      this.lastRun = new Date().toISOString();
      this.isRunning = false;
      
      console.log(`⏱️ Compression task completed in ${duration}ms`);
      console.log(`📊 Next run scheduled in ${this.config.compressionScheduleHours} hours\n`);
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.getNextRunTime(),
      scheduleIntervalHours: this.config.compressionScheduleHours,
      isSchedulerActive: !!this.schedulerTimer
    };
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime() {
    if (!this.schedulerTimer || !this.lastRun) {
      return null;
    }
    
    const lastRunTime = new Date(this.lastRun);
    const nextRunTime = new Date(lastRunTime.getTime() + this.config.getCompressionScheduleMs());
    return nextRunTime.toISOString();
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Force run compression task (for testing/manual trigger)
   */
  async forceRun() {
    console.log('🔧 Manually triggering compression task...');
    await this.runCompressionTask();
  }
}

module.exports = Scheduler; 
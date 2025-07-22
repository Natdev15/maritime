const axios = require('axios');

// node test-load.js bulk --total=100 --records=100
// node test-load.js individual --total=100
// node test-load.js bulk --total=100 --records=50 --rate=200
// node test-load.js individual --total=100 --records=100 --rate=10000

class LoadTester {
  constructor(options = {}) {
    this.serverUrl = 'http://localhost:3000';
    this.totalContainers = options.totalContainers || 100; // Number of unique containers
    this.recordsPerContainer = options.recordsPerContainer || 50; // Records per container
    this.batchSize = options.batchSize || 2000; // Containers per batch (for bulk mode)
    this.batchDelay = 100; // Delay between batches in ms
    this.containersPerSecond = options.containersPerSecond || 500; // Target rate for individual sends
  }

  // Generate realistic container data with time progression
  generateContainerData(containerId, recordIndex = 0) {
    // Create time progression - each record is 1 minute apart
    const baseTime = new Date(Date.now() - (this.recordsPerContainer - recordIndex) * 60000);
    
    const variations = {
      latitude: 31 + (Math.random() - 0.5) * 2,
      longitude: 28 + (Math.random() - 0.5) * 2,
      temperature: 15 + Math.random() * 20 + Math.sin(recordIndex * 0.1) * 5, // Some variation over time
      humidity: 30 + Math.random() * 50 + Math.cos(recordIndex * 0.15) * 10,
      pressure: 1000 + Math.random() * 20,
      battery: Math.max(10, 100 - (recordIndex * 0.5) + (Math.random() - 0.5) * 10), // Battery drains over time
      rssi: Math.floor(Math.random() * 100),
      speed: Math.random() * 30,
      heading: Math.random() * 360,
      altitude: 30 + Math.random() * 10
    };

    return {
      containerId: `CONT${String(containerId).padStart(6, '0')}`,
      iso6346: `LMCU${String(containerId).padStart(7, '0')}`,
      msisdn: `393315537${String(800 + (containerId % 200)).padStart(3, '0')}`,
      time: baseTime.toISOString().replace(/[-:T]/g, '').slice(0, 15),
      rssi: String(variations.rssi),
      cgi: "999-01-1-31D41",
      "ble-m": "0",
      "bat-soc": String(Math.floor(variations.battery)),
      acc: `${(-1000 + Math.random() * 200).toFixed(4)}${(-1.5 + Math.random() * 3).toFixed(4)}${(-5 + Math.random() * 5).toFixed(4)}`,
      temperature: variations.temperature.toFixed(2),
      humidity: variations.humidity.toFixed(2),
      pressure: variations.pressure.toFixed(4),
      door: "D",
      gnss: "1",
      latitude: variations.latitude.toFixed(4),
      longitude: variations.longitude.toFixed(4),
      altitude: variations.altitude.toFixed(2),
      speed: variations.speed.toFixed(1),
      heading: variations.heading.toFixed(2),
      nsat: String(Math.floor(4 + Math.random() * 8)).padStart(2, '0'),
      hdop: (0.5 + Math.random() * 2).toFixed(1),
      timestamp: baseTime.toISOString()
    };
  }

  // Generate all records for all containers
  generateAllRecords() {
    const allRecords = [];
    
    for (let containerId = 1; containerId <= this.totalContainers; containerId++) {
      for (let recordIndex = 0; recordIndex < this.recordsPerContainer; recordIndex++) {
        allRecords.push(this.generateContainerData(containerId, recordIndex));
      }
    }
    
    // Shuffle records to simulate realistic mixed container data flow
    for (let i = allRecords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allRecords[i], allRecords[j]] = [allRecords[j], allRecords[i]];
    }
    
    return allRecords;
  }

  // Send a batch of containers
  async sendBatch(containers) {
    try {
      const response = await axios.post(`${this.serverUrl}/api/containers/bulk`, {
        containers: containers
      }, {
        timeout: 100000
      });

      return {
        success: true,
        processed: response.data.processed,
        errors: response.data.errors
      };
    } catch (error) {
      console.error(`Batch error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send individual container (for comparison)
  async sendSingle(container) {
    try {
      const response = await axios.post(`${this.serverUrl}/api/container`, container, {
        timeout: 5000
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Run individual load test with rate control
  async runIndividualLoadTest() {
    const totalRecords = this.totalContainers * this.recordsPerContainer;
    
    console.log('🔄 Starting Individual Load Test (Rate Controlled)');
    console.log(`📦 Containers: ${this.totalContainers}`);
    console.log(`📊 Records per container: ${this.recordsPerContainer}`);
    console.log(`🎯 Total records: ${totalRecords}`);
    console.log(`⚡ Target rate: ${this.containersPerSecond} records/second`);
    console.log('─'.repeat(50));
    
    const stats = {
      totalSent: 0,
      totalProcessed: 0,
      totalErrors: 0,
      startTime: Date.now(),
      responseTimes: []
    };

    // Generate all records
    const allRecords = this.generateAllRecords();
    
    // Calculate delay between sends to achieve target rate
    const delayMs = 1000 / this.containersPerSecond;
    
    for (let i = 0; i < allRecords.length; i++) {
      const recordStartTime = Date.now();
      
      try {
        const result = await this.sendSingle(allRecords[i]);
        const responseTime = Date.now() - recordStartTime;
        
        stats.totalSent++;
        stats.responseTimes.push(responseTime);
        
        if (result.success) {
          stats.totalProcessed++;
        } else {
          stats.totalErrors++;
        }
        
        // Progress reporting
        if (stats.totalSent % 100 === 0 || i === allRecords.length - 1) {
          const elapsed = (Date.now() - stats.startTime) / 1000;
          const currentRate = stats.totalSent / elapsed;
          const avgResponseTime = stats.responseTimes.slice(-100).reduce((a, b) => a + b, 0) / Math.min(100, stats.responseTimes.length);
          
          console.log(`📊 Sent: ${stats.totalSent}/${totalRecords} | ` +
                     `Rate: ${currentRate.toFixed(1)}/s | ` +
                     `Errors: ${stats.totalErrors} | ` +
                     `Avg Response: ${avgResponseTime.toFixed(0)}ms`);
        }
        
        // Rate limiting - wait for next send
        const elapsed = Date.now() - recordStartTime;
        const waitTime = Math.max(0, delayMs - elapsed);
        if (waitTime > 0 && i < allRecords.length - 1) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
      } catch (error) {
        stats.totalSent++;
        stats.totalErrors++;
        console.error(`Error sending record ${i + 1}:`, error.message);
      }
    }

    return stats;
  }

  // Get server statistics
  async getServerStats() {
    try {
      const response = await axios.get(`${this.serverUrl}/api/stats`);
      return response.data;
    } catch (error) {
      console.error('Failed to get server stats:', error.message);
      return null;
    }
  }

  // Print enhanced report with response time stats
  printReport(stats, testType = 'Individual') {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rate = stats.totalSent / elapsed;
    const successRate = (stats.totalProcessed / stats.totalSent) * 100;

    console.log('\n' + '='.repeat(60));
    console.log(`📋 ${testType} Load Test Results`);
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${elapsed.toFixed(2)} seconds`);
    console.log(`📦 Total sent: ${stats.totalSent}`);
    console.log(`✅ Processed: ${stats.totalProcessed}`);
    console.log(`❌ Errors: ${stats.totalErrors}`);
    console.log(`📈 Average rate: ${rate.toFixed(2)} records/second`);
    console.log(`🎯 Success rate: ${successRate.toFixed(1)}%`);
    
    if (stats.responseTimes && stats.responseTimes.length > 0) {
      const sortedTimes = [...stats.responseTimes].sort((a, b) => a - b);
      const avgResponseTime = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
      const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const maxResponseTime = Math.max(...sortedTimes);
      const minResponseTime = Math.min(...sortedTimes);
      
      console.log('─'.repeat(60));
      console.log('📊 Response Time Statistics:');
      console.log(`   Average: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`   Min: ${minResponseTime}ms`);
      console.log(`   Max: ${maxResponseTime}ms`);
      console.log(`   95th percentile: ${p95ResponseTime}ms`);
    }
    
    if (stats.batchesSent) {
      console.log(`📊 Batches sent: ${stats.batchesSent}`);
      console.log(`📦 Avg containers/batch: ${(stats.totalSent / stats.batchesSent).toFixed(1)}`);
    }
    
    console.log('='.repeat(60));
  }
}

// CLI interface
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const testType = args[0] || 'individual';
  
  // Parse options
  const options = {};
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--total=')) {
      options.totalContainers = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--records=')) {
      options.recordsPerContainer = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--rate=')) {
      options.containersPerSecond = parseInt(arg.split('=')[1]);
    }
  }
  
  const tester = new LoadTester(options);
  
  console.log('🚢 Maritime Container Load Tester');
  console.log('==================================');
  console.log(`📦 Total containers: ${tester.totalContainers}`);
  console.log(`📊 Records per container: ${tester.recordsPerContainer}`);
  console.log(`🎯 Target rate: ${tester.containersPerSecond}/second\n`);

  // Check if server is running
  try {
    const health = await axios.get(`${tester.serverUrl}/api/health`);
    console.log('✅ Server is running');
    console.log(`📊 Queue length: ${health.data.queueLength || 0}`);
    console.log(`⏱️  Server uptime: ${((health.data.uptime || 0) / 1000).toFixed(0)}s\n`);
  } catch (error) {
    console.error('❌ Server not reachable. Please start the server first.');
    process.exit(1);
  }
  
  try {
    let stats;
    
    if (testType === 'individual') {
      stats = await tester.runIndividualLoadTest();
      tester.printReport(stats, 'Individual');
    } else {
      const allRecords = tester.generateAllRecords();
      const batches = Math.ceil(allRecords.length / tester.batchSize);
      const stats = {
        totalSent: 0,
        totalProcessed: 0,
        totalErrors: 0,
        batchesSent: 0,
        startTime: Date.now()
      };

      for (let batchNum = 0; batchNum < batches; batchNum++) {
        const batchStart = batchNum * tester.batchSize;
        const batchEnd = Math.min(batchStart + tester.batchSize, allRecords.length);
        
        // Send batch
        const result = await tester.sendBatch(allRecords.slice(batchStart, batchEnd));
        
        stats.batchesSent++;
        stats.totalSent += result.processed || 0;
        stats.totalErrors += result.errors || 0;

        // Progress reporting
        if (batchNum % 10 === 0 || batchNum === batches - 1) {
          const elapsed = (Date.now() - stats.startTime) / 1000;
          const rate = stats.totalSent / elapsed;
          
          console.log(`📊 Batch ${batchNum + 1}/${batches} | ` +
                     `Sent: ${stats.totalSent} | ` +
                     `Rate: ${rate.toFixed(1)}/s | ` +
                     `Errors: ${stats.totalErrors}`);
        }

        // Rate limiting
        if (batchNum < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, tester.batchDelay));
        }
      }
    }

    // Get final server stats
    console.log('\n📊 Final Server Statistics:');
    const serverStats = await tester.getServerStats();
    if (serverStats) {
      console.log(`📦 Total records: ${serverStats.database?.total_records || 0}`);
      console.log(`🏷️  Unique containers: ${serverStats.database?.unique_containers || 0}`);
      console.log(`📥 Queue length: ${serverStats.writeQueue?.queueLength || 0}`);
      console.log(`🔄 Is processing: ${serverStats.writeQueue?.isProcessing || false}`);
    }

  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  console.log('🚢 Maritime Container Load Tester');
  console.log('Usage: node test-load.js [testType] [options]');
  console.log('');
  console.log('Test Types:');
  console.log('  bulk       - Send containers in batches (default)');
  console.log('  individual - Send containers one by one');
  console.log('');
  console.log('Options:');
  console.log('  --total=N    - Total number of containers to send (default: 100)');
  console.log('  --records=N  - Records per container (default: 50)');
  console.log('  --rate=N     - Target containers per second (default: 500)');
  console.log('');
  console.log('Examples:');
  console.log('  node test-load.js bulk --total=1000 --records=100');
  console.log('  node test-load.js individual --total=50');
  console.log('  node test-load.js bulk --total=500 --records=50 --rate=200');
  console.log('');
  
  main().catch(console.error);
}

module.exports = LoadTester; 
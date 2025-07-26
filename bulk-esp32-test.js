/**
 * Bulk ESP32 Testing Script
 * Send single or multiple JSON payloads to the encoder for testing
 */

const axios = require('axios');

// node bulk-esp32-test.js bulk --total=100 --records=100
// node bulk-esp32-test.js individual --total=100
// node bulk-esp32-test.js bulk --total=100 --records=50 --rate=200
// node bulk-esp32-test.js individual --total=100 --records=100 --rate=10000

class ESP32LoadTester {
  constructor(options = {}) {
    this.encoderUrl = 'http://localhost:3000'; // ESP32 encoder endpoint (local)
    this.totalDevices = options.totalDevices || 100; // Number of unique ESP32 devices
    this.recordsPerDevice = options.recordsPerDevice || 50; // Records per device
    this.batchSize = options.batchSize || 2000; // Devices per batch (for bulk mode)
    this.batchDelay = 100; // Delay between batches in ms
    this.devicesPerSecond = options.devicesPerSecond || 500; // Target rate for individual sends
  }

  // Generate realistic ESP32 sensor data with time progression
  generateESP32Data(deviceId, recordIndex = 0) {
    // Create time progression - each record is 1 minute apart
    const baseTime = new Date(Date.now() - (this.recordsPerDevice - recordIndex) * 60000);
    
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
      msisdn: `393315537${String(800 + (deviceId % 200)).padStart(3, '0')}`,
      iso6346: `LMCU${String(deviceId).padStart(7, '0')}`,
      time: baseTime.toISOString().replace(/[-:T]/g, '').slice(0, 15),
      rssi: String(variations.rssi),
      cgi: "999-01-1-31D41",
      "ble-m": "0",
      "bat-soc": String(Math.floor(variations.battery)),
      acc: `${(-1000 + Math.random() * 200).toFixed(4)} ${(-1.5 + Math.random() * 3).toFixed(4)} ${(-5 + Math.random() * 5).toFixed(4)}`,
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

  // Generate all records for all devices
  generateAllRecords() {
    const allRecords = [];
    
    for (let deviceId = 1; deviceId <= this.totalDevices; deviceId++) {
      for (let recordIndex = 0; recordIndex < this.recordsPerDevice; recordIndex++) {
        allRecords.push(this.generateESP32Data(deviceId, recordIndex));
      }
    }
    
    // Shuffle records to simulate realistic mixed device data flow
    for (let i = allRecords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allRecords[i], allRecords[j]] = [allRecords[j], allRecords[i]];
    }
    
    return allRecords;
  }

  // Send a batch of ESP32 JSON payloads to encoder
  async sendBatch(devices) {
    try {
      const results = [];
      let processed = 0;
      let errors = 0;

      for (const deviceData of devices) {
        try {
          const result = await this.sendSingle(deviceData);
          if (result.success) {
            processed++;
          } else {
            errors++;
          }
          results.push(result);
        } catch (error) {
          errors++;
          results.push({ success: false, error: error.message });
        }
      }

      return {
        success: true,
        processed,
        errors,
        results
      };
    } catch (error) {
      console.error(`Batch error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send individual ESP32 JSON payload to encoder
  async sendSingle(deviceData) {
    try {
      const response = await axios.post(`${this.encoderUrl}/api/encode`, deviceData, {
        headers: {
          'Content-Type': 'application/json',
          'device-id': `ESP32_${deviceData.iso6346}`,
          'network-type': 'astrocast',
          'timestamp': deviceData.timestamp
        },
        timeout: 10000
      });
      
      return { 
        success: response.data.success, 
        data: response.data,
        stats: response.data.stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Run individual load test with rate control
  async runIndividualLoadTest() {
    const totalRecords = this.totalDevices * this.recordsPerDevice;
    
    console.log('🔄 Starting Individual ESP32 Load Test (Rate Controlled)');
    console.log(`📱 Devices: ${this.totalDevices}`);
    console.log(`📊 Records per device: ${this.recordsPerDevice}`);
    console.log(`🎯 Total records: ${totalRecords}`);
    console.log(`⚡ Target rate: ${this.devicesPerSecond} records/second`);
    console.log('─'.repeat(50));
    
    const stats = {
      totalSent: 0,
      totalProcessed: 0,
      totalErrors: 0,
      startTime: Date.now(),
      responseTimes: [],
      totalEncodedSize: 0,
      compressionRatios: [],
      totalProcessingTime: 0
    };

    // Generate all records
    const allRecords = this.generateAllRecords();
    
    // Calculate delay between sends to achieve target rate
    const delayMs = 1000 / this.devicesPerSecond;
    
    for (let i = 0; i < allRecords.length; i++) {
      const recordStartTime = Date.now();
      
      try {
        const result = await this.sendSingle(allRecords[i]);
        const responseTime = Date.now() - recordStartTime;
        
        stats.totalSent++;
        stats.responseTimes.push(responseTime);
        
        if (result.success) {
          stats.totalProcessed++;
          if (result.stats) {
            stats.totalEncodedSize += result.stats.encodedSize || 0;
            stats.compressionRatios.push(result.stats.compressionRatio || 0);
            stats.totalProcessingTime += result.data.processingTime || 0;
          }
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

  // Get encoder statistics
  async getEncoderStats() {
    try {
      const response = await axios.get(`${this.encoderUrl}/health`);
      return response.data;
    } catch (error) {
      console.error('Failed to get encoder stats:', error.message);
      return null;
    }
  }

  // Print enhanced report with response time stats
  printReport(stats, testType = 'Individual') {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rate = stats.totalSent / elapsed;
    const successRate = (stats.totalProcessed / stats.totalSent) * 100;
    const avgCompression = stats.compressionRatios.length > 0 ? 
      stats.compressionRatios.reduce((a, b) => a + b, 0) / stats.compressionRatios.length : 0;
    const avgProcessingTime = stats.totalProcessed > 0 ? 
      stats.totalProcessingTime / stats.totalProcessed : 0;

    console.log('\n' + '='.repeat(60));
    console.log(`📋 ${testType} ESP32 Load Test Results`);
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${elapsed.toFixed(2)} seconds`);
    console.log(`📱 Total sent: ${stats.totalSent}`);
    console.log(`✅ Processed: ${stats.totalProcessed}`);
    console.log(`❌ Errors: ${stats.totalErrors}`);
    console.log(`📈 Average rate: ${rate.toFixed(2)} records/second`);
    console.log(`🎯 Success rate: ${successRate.toFixed(1)}%`);
    
    if (stats.totalEncodedSize > 0) {
      const avgSize = stats.totalEncodedSize / stats.totalProcessed;
      console.log(`🗜️  Average CBOR size: ${avgSize.toFixed(1)} bytes`);
      console.log(`📉 Average compression: ${avgCompression.toFixed(1)}%`);
      console.log(`⚡ Average processing time: ${avgProcessingTime.toFixed(0)}ms`);
    }
    
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
      console.log(`📱 Avg devices/batch: ${(stats.totalSent / stats.batchesSent).toFixed(1)}`);
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
      options.totalDevices = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--records=')) {
      options.recordsPerDevice = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--rate=')) {
      options.devicesPerSecond = parseInt(arg.split('=')[1]);
    }
  }
  
  const tester = new ESP32LoadTester(options);
  
  console.log('🚀 ESP32 Load Tester');
  console.log('===================');
  console.log(`📱 Total devices: ${tester.totalDevices}`);
  console.log(`📊 Records per device: ${tester.recordsPerDevice}`);
  console.log(`🎯 Target rate: ${tester.devicesPerSecond}/second\n`);

  // Check if encoder is running
  try {
    const health = await axios.get(`${tester.encoderUrl}/health`);
    console.log('✅ ESP32 Encoder is running');
    console.log(`📊 Service: ${health.data.service}`);
    console.log(`📡 Decoder URL: ${health.data.decoderUrl}`);
    console.log(`⏱️  Uptime: ${((health.data.uptime || 0) / 1000).toFixed(0)}s\n`);
  } catch (error) {
    console.error('❌ ESP32 Encoder not reachable. Please start the encoder first.');
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
      
      tester.printReport(stats, 'Bulk');
    }

    // Get final encoder stats
    console.log('\n📊 Final Encoder Statistics:');
    const encoderStats = await tester.getEncoderStats();
    if (encoderStats) {
      console.log(`📱 Service: ${encoderStats.service}`);
      console.log(`📡 Decoder URL: ${encoderStats.decoderUrl}`);
      console.log(`⏱️  Uptime: ${((encoderStats.uptime || 0) / 1000).toFixed(0)}s`);
    }

  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  console.log('🚀 ESP32 Load Tester');
  console.log('Usage: node bulk-esp32-test.js [testType] [options]');
  console.log('');
  console.log('Test Types:');
  console.log('  bulk       - Send ESP32 devices in batches (default)');
  console.log('  individual - Send ESP32 devices one by one');
  console.log('');
  console.log('Options:');
  console.log('  --total=N    - Total number of ESP32 devices to send (default: 100)');
  console.log('  --records=N  - Records per device (default: 50)');
  console.log('  --rate=N     - Target devices per second (default: 500)');
  console.log('');
  console.log('Examples:');
  console.log('  node bulk-esp32-test.js bulk --total=1000 --records=100');
  console.log('  node bulk-esp32-test.js individual --total=50');
  console.log('  node bulk-esp32-test.js bulk --total=500 --records=50 --rate=200');
  console.log('');
  
  main().catch(console.error);
}

module.exports = ESP32LoadTester; 
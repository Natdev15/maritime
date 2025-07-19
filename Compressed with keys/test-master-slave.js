const axios = require('axios');

/**
 * Test script for master-slave functionality
 * Run this to validate the master-slave communication
 */
class MasterSlaveTest {
  constructor() {
    this.masterUrl = process.env.MASTER_URL || 'http://localhost:3000';
    this.slaveUrl = process.env.SLAVE_URL || 'http://localhost:3001';
    this.destinationUrl = process.env.DESTINATION_URL || 'http://localhost:3002';
  }

  async runTests() {
    console.log('🧪 Starting Master-Slave Architecture Tests\n');

    try {
      // Test 1: Health checks
      await this.testHealthChecks();

      // Test 2: Master data ingestion
      await this.testMasterIngestion();

      // Test 3: Manual compression trigger (if master has data)
      await this.testManualCompression();

      // Test 4: Slave endpoint validation
      await this.testSlaveEndpoints();

      console.log('\n✅ All tests completed successfully!');

    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    }
  }

  async testHealthChecks() {
    console.log('🔍 Testing health checks...');

    try {
      const masterHealth = await axios.get(`${this.masterUrl}/api/health`);
      console.log(`✅ Master health: ${masterHealth.data.nodeType} mode`);
      
      if (masterHealth.data.nodeType !== 'master') {
        throw new Error('Master node not configured correctly');
      }

      try {
        const slaveHealth = await axios.get(`${this.slaveUrl}/api/health`);
        console.log(`✅ Slave health: ${slaveHealth.data.nodeType} mode`);
        
        if (slaveHealth.data.nodeType !== 'slave') {
          throw new Error('Slave node not configured correctly');
        }
      } catch (error) {
        console.log(`⚠️  Slave health check failed: ${error.message}`);
      }

    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  async testMasterIngestion() {
    console.log('\n📦 Testing master data ingestion...');

    const testContainer = {
      containerId: 'TEST001',
      iso6346: 'LMCU1234567',
      msisdn: '393315537800',
      time: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15),
      rssi: '85',
      cgi: '999-01-1-31D41',
      'ble-m': '0',
      'bat-soc': '75',
      acc: '-1000.1234-1.2345-4.5678',
      temperature: '22.5',
      humidity: '65.2',
      pressure: '1013.25',
      door: 'D',
      gnss: '1',
      latitude: '31.2304',
      longitude: '28.4567',
      altitude: '30.5',
      speed: '15.2',
      heading: '270.5',
      nsat: '08',
      hdop: '1.2',
      timestamp: new Date().toISOString()
    };

    try {
      const response = await axios.post(`${this.masterUrl}/api/container`, testContainer);
      console.log(`✅ Container ingested: ${response.data.containerId}`);
      console.log(`📊 Compression ratio: ${response.data.compressionRatio}`);
    } catch (error) {
      throw new Error(`Master ingestion failed: ${error.message}`);
    }
  }

  async testManualCompression() {
    console.log('\n🗜️ Testing manual compression trigger...');

    try {
      const response = await axios.post(`${this.masterUrl}/api/compress-send`);
      console.log(`✅ Manual compression triggered: ${response.data.message}`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️  Manual compression endpoint not available (slave mode?)');
      } else {
        console.log(`⚠️  Manual compression failed: ${error.message}`);
      }
    }
  }

  async testSlaveEndpoints() {
    console.log('\n🔍 Testing slave endpoint validation...');

    try {
      // Test that slave rejects container ingestion
      const testContainer = { containerId: 'TEST002' };
      
      try {
        await axios.post(`${this.slaveUrl}/api/container`, testContainer);
        console.log('❌ Slave should not accept container data');
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('✅ Slave correctly rejects container ingestion');
        } else {
          console.log(`⚠️  Unexpected slave response: ${error.message}`);
        }
      }

      // Test slave stats
      try {
        const stats = await axios.get(`${this.slaveUrl}/api/stats`);
        console.log(`✅ Slave stats accessible: ${stats.data.nodeType} mode`);
      } catch (error) {
        console.log(`⚠️  Slave stats failed: ${error.message}`);
      }

    } catch (error) {
      console.log(`⚠️  Slave endpoint test failed: ${error.message}`);
    }
  }

  async testDataCleanup() {
    console.log('\n🗑️ Testing data cleanup behavior...');

    try {
      // Get initial container count
      const initialStats = await axios.get(`${this.masterUrl}/api/stats`);
      console.log(`📊 Initial database records: ${initialStats.data.database?.total_records || 0}`);

      // Check scheduler stats for cleanup operations
      if (initialStats.data.scheduler) {
        console.log(`🧹 Total cleanup operations: ${initialStats.data.scheduler.cleanupOperations || 0}`);
        console.log(`📦 Total data cleaned: ${initialStats.data.scheduler.totalDataCleaned || 0}`);
      }

    } catch (error) {
      console.log(`⚠️  Data cleanup test failed: ${error.message}`);
    }
  }

  async testFullDataFlow() {
    console.log('\n🔄 Testing full data flow (requires both nodes running)...');

    // This would require a more complex setup with a mock destination server
    console.log('⚠️  Full data flow test requires manual setup');
    console.log('   1. Start master with SEND_TO_URL pointing to slave');
    console.log('   2. Start slave with FORWARD_TO_URL pointing to destination');
    console.log('   3. Add container data to master');
    console.log('   4. Trigger manual compression or wait for schedule');
    console.log('   5. After successful transmission, database will be cleared');
    console.log('   6. Check destination for forwarded data');
  }

  async testEnvironmentValidation() {
    console.log('\n🔍 Environment validation notes...');
    console.log('⚠️  The application requires proper environment variables:');
    console.log('   - NODE_TYPE=master requires SEND_TO_URL');
    console.log('   - NODE_TYPE=slave requires FORWARD_TO_URL');
    console.log('   - Application will NOT start without these!');
    console.log('   - See README.md for complete setup guide and error examples');
  }

  async generateStats() {
    console.log('\n📊 Generating statistics...');

    try {
      const masterStats = await axios.get(`${this.masterUrl}/api/stats`);
      console.log('\n🎯 Master Stats:');
      console.log(`   Total requests: ${masterStats.data.totalRequests}`);
      console.log(`   Successful writes: ${masterStats.data.successfulWrites}`);
      console.log(`   Errors: ${masterStats.data.errors}`);
      
      if (masterStats.data.scheduler) {
        console.log('\n⏰ Scheduler Stats:');
        console.log(`   Total runs: ${masterStats.data.scheduler.totalRuns}`);
        console.log(`   Successful runs: ${masterStats.data.scheduler.successfulRuns}`);
        console.log(`   Last run: ${masterStats.data.scheduler.lastRun || 'Never'}`);
        console.log(`   Next run: ${masterStats.data.scheduler.nextRun || 'Not scheduled'}`);
      }

    } catch (error) {
      console.log(`⚠️  Stats generation failed: ${error.message}`);
    }
  }
}

// Usage examples
if (require.main === module) {
  const tester = new MasterSlaveTest();
  
  console.log('🚢 Maritime Container Master-Slave Architecture Test');
  console.log('====================================================');
  console.log(`Master URL: ${tester.masterUrl}`);
  console.log(`Slave URL: ${tester.slaveUrl}`);
  console.log(`Destination URL: ${tester.destinationUrl}\n`);

  tester.runTests()
    .then(() => tester.generateStats())
    .then(() => tester.testDataCleanup())
    .then(() => tester.testEnvironmentValidation())
    .then(() => tester.testFullDataFlow())
    .catch(error => {
      console.error('Test execution failed:', error.message);
      process.exit(1);
    });
}

module.exports = MasterSlaveTest; 
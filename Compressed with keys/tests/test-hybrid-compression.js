const CompressionService = require('./compression');

/**
 * Test the hybrid compression implementation
 */
class HybridCompressionTest {
  constructor() {
    this.compressionService = new CompressionService();
  }

  /**
   * Generate test container data (matching test-load.js format)
   */
  generateTestContainerData() {
    const baseTime = new Date();
    
    return {
      containerId: `CONT000001`,
      iso6346: `LMCU0000001`,
      msisdn: `393315537800`,
      time: baseTime.toISOString().replace(/[-:T]/g, '').slice(0, 15),
      rssi: "85",
      cgi: "999-01-1-31D41",
      "ble-m": "0",
      "bat-soc": "75",
      acc: "-1000.1234-1.2345-3.4567",
      temperature: "22.5",
      humidity: "65.2",
      pressure: "1013.25",
      door: "D",
      gnss: "1",
      latitude: "31.2345",
      longitude: "28.6789",
      altitude: "35.5",
      speed: "12.3",
      heading: "180.45",
      nsat: "08",
      hdop: "1.2",
      timestamp: baseTime.toISOString()
    };
  }

  /**
   * Test single container compression/decompression
   */
  async testSingleContainer() {
    console.log('🧪 Testing Single Container Compression...\n');
    
    const containerData = this.generateTestContainerData();
    console.log('📦 Original Container Data:');
    console.log(JSON.stringify(containerData, null, 2));
    
    try {
      // Test compression cycle
      const result = await this.compressionService.testCycle(containerData);
      
      if (result.success) {
        console.log('\n✅ Compression/Decompression Cycle: PASSED');
        console.log('📊 Compression Analysis:');
        console.log(`  Original Size: ${this.compressionService.formatBytes(result.analysis.originalSize)}`);
        console.log(`  Compressed Size: ${this.compressionService.formatBytes(result.analysis.compressedSize)}`);
        console.log(`  Space Saved: ${this.compressionService.formatBytes(result.analysis.spaceSaved)} (${result.analysis.percentSaved}%)`);
        console.log(`  Compression Ratio: ${result.analysis.compressionRatio}:1`);
        
        console.log('\n🔍 Reconstructed Data:');
        console.log(JSON.stringify(result.decompressed, null, 2));
        
        return true;
      } else {
        console.log('\n❌ Compression/Decompression Cycle: FAILED');
        console.log('Error:', result.error);
        return false;
      }
    } catch (error) {
      console.log('\n❌ Test failed:', error.message);
      return false;
    }
  }

  /**
   * Test multiple containers compression
   */
  async testMultipleContainers() {
    console.log('\n🧪 Testing Multiple Containers Compression...\n');
    
    // Generate 10 test containers
    const containers = [];
    for (let i = 1; i <= 10; i++) {
      const container = this.generateTestContainerData();
      container.containerId = `CONT${String(i).padStart(6, '0')}`;
      container.iso6346 = `LMCU${String(i).padStart(7, '0')}`;
      container.msisdn = `393315537${String(800 + i).padStart(3, '0')}`;
      containers.push(container);
    }
    
    console.log(`📦 Generated ${containers.length} containers`);
    
    try {
      // Compress multiple containers
      const compressed = await this.compressionService.compressMultiple(containers);
      
      // Decompress
      const decompressed = await this.compressionService.decompressMultiple(compressed);
      
      // Verify
      const originalJson = JSON.stringify(containers);
      const decompressedJson = JSON.stringify(decompressed);
      const isValid = originalJson === decompressedJson;
      
      if (isValid) {
        console.log('✅ Multiple Container Compression: PASSED');
        
        const originalSize = Buffer.byteLength(originalJson, 'utf8');
        const compressedSize = compressed.length;
        const spaceSaved = originalSize - compressedSize;
        const percentSaved = ((spaceSaved / originalSize) * 100).toFixed(2);
        const compressionRatio = (originalSize / compressedSize).toFixed(2);
        
        console.log('📊 Multi-Container Analysis:');
        console.log(`  Original Size: ${this.compressionService.formatBytes(originalSize)}`);
        console.log(`  Compressed Size: ${this.compressionService.formatBytes(compressedSize)}`);
        console.log(`  Space Saved: ${this.compressionService.formatBytes(spaceSaved)} (${percentSaved}%)`);
        console.log(`  Compression Ratio: ${compressionRatio}:1`);
        console.log(`  Containers: ${containers.length}`);
        console.log(`  Average per container: ${this.compressionService.formatBytes(originalSize / containers.length)} → ${this.compressionService.formatBytes(compressedSize / containers.length)}`);
        
        return true;
      } else {
        console.log('❌ Multiple Container Compression: FAILED - Data integrity check failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Multiple container test failed:', error.message);
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚢 Maritime Container Hybrid Compression Test Suite\n');
    console.log('🎯 Testing Schema-based Value Extraction + Brotli Compression\n');
    console.log('=' .repeat(60));
    
    try {
      // Test single container
      const singleTest = await this.testSingleContainer();
      
      // Test multiple containers
      const multiTest = await this.testMultipleContainers();
      
      console.log('\n' + '='.repeat(60));
      console.log('📋 TEST SUMMARY:');
      console.log(`Single Container: ${singleTest ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Multiple Containers: ${multiTest ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (singleTest && multiTest) {
        console.log('\n🎉 All tests PASSED! Hybrid compression is working correctly.');
        console.log('💡 Your revolutionary space-saving approach is ready for production!');
        return true;
      } else {
        console.log('\n⚠️  Some tests FAILED. Please check the implementation.');
        return false;
      }
    } catch (error) {
      console.log('\n❌ Test suite failed:', error.message);
      return false;
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new HybridCompressionTest();
  test.runAllTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = HybridCompressionTest; 
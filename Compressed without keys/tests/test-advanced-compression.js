const CompressionService = require('./compression');
const SchemaCompressionService = require('./schema-compression');
const HybridCompressionService = require('./hybrid-compression');

class AdvancedCompressionTest {
  constructor() {
    this.brotliService = new CompressionService();
    this.schemaService = new SchemaCompressionService();
    this.hybridService = new HybridCompressionService();
    this.targetSizeMB = 30;
    this.targetSizeBytes = this.targetSizeMB * 1024 * 1024;
    this.recordsPerContainer = 1; // Single record per container for simplicity
  }

  /**
   * Generate a single maritime container data object (same format as test-load.js)
   */
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

  /**
   * Generate exactly 30MB of container data
   */
  async generateExact30MBData() {
    console.log(`🎯 Generating exactly ${this.targetSizeMB}MB of maritime container data...`);
    
    let totalData = [];
    let currentSize = 0;
    let containerId = 1;
    const batchSize = 1000; // Generate containers in batches for efficiency
    
    // Generate containers in batches until we get close to target
    while (currentSize < this.targetSizeBytes * 0.95) {
      // Generate a batch of containers
      const batch = [];
      for (let i = 0; i < batchSize; i++) {
        const containerData = this.generateContainerData(containerId++);
        batch.push(containerData);
      }
      
      // Add batch to total data
      totalData.push(...batch);
      
      // Check size only after batch is complete
      const dataString = JSON.stringify(totalData);
      currentSize = Buffer.byteLength(dataString, 'utf8');
      
      console.log(`Generated ${(containerId - 1).toLocaleString()} containers, current size: ${(currentSize / 1024 / 1024).toFixed(2)}MB`);
      
      // If we're getting close to target, switch to smaller batches
      if (currentSize > this.targetSizeBytes * 0.8) {
        break;
      }
    }
    
    // Fine-tune with smaller batches when close to target
    console.log('🎯 Fine-tuning with smaller batches...');
    const smallBatchSize = 100;
    
    while (currentSize < this.targetSizeBytes * 0.98) {
      const batch = [];
      for (let i = 0; i < smallBatchSize; i++) {
        const containerData = this.generateContainerData(containerId++);
        batch.push(containerData);
      }
      
      totalData.push(...batch);
      
      const dataString = JSON.stringify(totalData);
      currentSize = Buffer.byteLength(dataString, 'utf8');
      
      console.log(`Generated ${(containerId - 1).toLocaleString()} containers, current size: ${(currentSize / 1024 / 1024).toFixed(2)}MB`);
    }

    console.log('🎯 Final adjustment to reach exactly 30MB...');
    
    // Final precise adjustment with padding
    while (true) {
      const dataString = JSON.stringify(totalData);
      currentSize = Buffer.byteLength(dataString, 'utf8');
      
      if (currentSize === this.targetSizeBytes) {
        break;
      } else if (currentSize < this.targetSizeBytes) {
        // Need more data - add padding to last container  
        const diff = this.targetSizeBytes - currentSize;
        const lastContainer = totalData[totalData.length - 1];
        
        // Add padding field to reach exact size
        if (!lastContainer.padding) {
          lastContainer.padding = '';
        }
        lastContainer.padding += 'x'.repeat(diff);
      } else {
        // Too much data - reduce padding or remove containers
        const diff = currentSize - this.targetSizeBytes;
        const lastContainer = totalData[totalData.length - 1];
        
        if (lastContainer.padding && lastContainer.padding.length > diff) {
          lastContainer.padding = lastContainer.padding.slice(0, -diff);
        } else {
          // Remove padding field if it exists
          if (lastContainer.padding) {
            delete lastContainer.padding;
          }
          // Remove one container and try again
          totalData.pop();
          containerId--;
        }
      }
    }

    console.log(`✅ Generated exactly ${totalData.length.toLocaleString()} containers for ${this.targetSizeMB}MB`);
    return totalData;
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
   * Test compression method performance
   */
  async testCompressionMethod(name, compressFunc, decompressFunc, data) {
    console.log(`\n🧪 Testing ${name}...`);
    
    try {
      // Compression
      const compressStart = Date.now();
      const compressed = await compressFunc(data);
      const compressionTime = Date.now() - compressStart;
      
      // Decompression
      const decompressStart = Date.now();
      const decompressed = await decompressFunc(compressed);
      const decompressionTime = Date.now() - decompressStart;
      
      // Verification
      const originalJson = JSON.stringify(data);
      const decompressedJson = JSON.stringify(decompressed);
      const isValid = originalJson === decompressedJson;
      
      // Analysis
      const originalSize = Buffer.byteLength(originalJson, 'utf8');
      const compressedSize = compressed.length;
      const spaceSaved = originalSize - compressedSize;
      const percentSaved = ((spaceSaved / originalSize) * 100).toFixed(2);
      const compressionRatio = (originalSize / compressedSize).toFixed(2);
      
      console.log(`  ✅ ${name} completed`);
      console.log(`  📊 Size: ${this.formatBytes(compressedSize)}`);
      console.log(`  📈 Ratio: ${compressionRatio}:1 (${percentSaved}% saved)`);
      console.log(`  ⏱️  Time: ${compressionTime + decompressionTime}ms`);
      
      return {
        name,
        success: isValid,
        originalSize,
        compressedSize,
        spaceSaved,
        percentSaved: parseFloat(percentSaved),
        compressionRatio: parseFloat(compressionRatio),
        compressionTime,
        decompressionTime,
        totalTime: compressionTime + decompressionTime,
        efficiency: (originalSize / (compressionTime + decompressionTime) / 1024).toFixed(2)
      };
      
    } catch (error) {
      console.log(`  ❌ ${name} failed: ${error.message}`);
      return {
        name,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run comprehensive compression comparison
   */
  async runAdvancedTest() {
    try {
      console.log('🚢 Advanced Maritime Container Compression Test\n');
      console.log('🎯 Target: Maximum space savings with data integrity\n');
      
      // Generate test data
      const containerData = await this.generateExact30MBData();
      const originalSize = Buffer.byteLength(JSON.stringify(containerData), 'utf8');
      
      console.log('\n📊 ORIGINAL DATA:');
      console.log(`Size: ${this.formatBytes(originalSize)} (${originalSize.toLocaleString()} bytes)`);
      console.log(`Containers: ${containerData.length.toLocaleString()}`);
      console.log(`Average per container: ${this.formatBytes(originalSize / containerData.length)}`);
      
      console.log('\n🧪 TESTING COMPRESSION METHODS:');
      console.log('═'.repeat(50));
      
      const results = [];
      
      // Test 1: Brotli Only
      const brotliResult = await this.testCompressionMethod(
        'Brotli Only',
        (data) => this.brotliService.compress(data),
        (compressed) => this.brotliService.decompress(compressed),
        containerData
      );
      results.push(brotliResult);
      
      // Test 2: Schema Only  
      const schemaResult = await this.testCompressionMethod(
        'Schema Only',
        (data) => this.schemaService.compressMultiple(data),
        (compressed) => this.schemaService.decompressMultiple(compressed),
        containerData
      );
      results.push(schemaResult);
      
      // Test 3: Hybrid (Schema + Brotli)
      const hybridResult = await this.testCompressionMethod(
        'Hybrid (Schema + Brotli)',
        (data) => this.hybridService.compressMultiple(data),
        (compressed) => this.hybridService.decompressMultiple(compressed),
        containerData
      );
      results.push(hybridResult);
      
      // Display comparison table
      console.log('\n📊 COMPRESSION COMPARISON TABLE:');
      console.log('═'.repeat(80));
      console.log('Method                  | Size     | Ratio  | Saved  | Time  | Speed  ');
      console.log('─'.repeat(80));
      
      const validResults = results.filter(r => r.success);
      
      validResults.forEach(result => {
        const name = result.name.padEnd(22);
        const size = this.formatBytes(result.compressedSize).padEnd(8);
        const ratio = `${result.compressionRatio}:1`.padEnd(6);
        const saved = `${result.percentSaved}%`.padEnd(6);
        const time = `${result.totalTime}ms`.padEnd(5);
        const speed = `${result.efficiency}KB/ms`.padEnd(6);
        
        console.log(`${name} | ${size} | ${ratio} | ${saved} | ${time} | ${speed}`);
      });
      
      // Find best method
      const bestByRatio = validResults.sort((a, b) => b.compressionRatio - a.compressionRatio)[0];
      const bestBySpeed = validResults.sort((a, b) => parseFloat(b.efficiency) - parseFloat(a.efficiency))[0];
      
      console.log('\n🏆 WINNERS:');
      console.log(`🥇 Best Compression: ${bestByRatio.name} (${bestByRatio.compressionRatio}:1)`);
      console.log(`⚡ Fastest: ${bestBySpeed.name} (${bestBySpeed.efficiency}KB/ms)`);
      
      // Detailed analysis of best method
      console.log('\n🔍 BEST METHOD ANALYSIS:');
      console.log(`Method: ${bestByRatio.name}`);
      console.log(`Original: ${this.formatBytes(bestByRatio.originalSize)}`);
      console.log(`Compressed: ${this.formatBytes(bestByRatio.compressedSize)}`);
      console.log(`Space Saved: ${this.formatBytes(bestByRatio.spaceSaved)} (${bestByRatio.percentSaved}%)`);
      console.log(`Compression Ratio: ${bestByRatio.compressionRatio}:1`);
      console.log(`Processing Speed: ${bestByRatio.efficiency}KB/ms`);
      
      console.log('\n💡 STORAGE PROJECTIONS:');
      const containers1M = 1000000;
      const avgContainerSize = originalSize / containerData.length;
      const uncompressed1M = containers1M * avgContainerSize;
      const compressed1M = (uncompressed1M / bestByRatio.compressionRatio);
      
      console.log(`1M containers uncompressed: ${this.formatBytes(uncompressed1M)}`);
      console.log(`1M containers compressed: ${this.formatBytes(compressed1M)}`);
      console.log(`Storage savings: ${this.formatBytes(uncompressed1M - compressed1M)}`);
      
      return {
        originalSize,
        results: validResults,
        bestMethod: bestByRatio,
        fastestMethod: bestBySpeed
      };
      
    } catch (error) {
      console.error('❌ Advanced test failed:', error);
      throw error;
    }
  }
}

// Run the test
if (require.main === module) {
  const advancedTest = new AdvancedCompressionTest();
  advancedTest.runAdvancedTest()
    .then(() => {
      console.log('\n✅ Advanced compression test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Advanced compression test failed:', error);
      process.exit(1);
    });
}

module.exports = AdvancedCompressionTest; 
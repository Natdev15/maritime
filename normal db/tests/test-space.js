const CompressionService = require('./compression');

class SpaceTestScript {
  constructor() {
    this.compressionService = new CompressionService();
    this.targetSizeMB = 30;
    this.targetSizeBytes = this.targetSizeMB * 1024 * 1024; // 30MB in bytes
  }

  /**
   * Generate a single maritime container data object
   */
  generateContainerData(containerId) {
    return {
      containerId: `MSCU${containerId.toString().padStart(7, '0')}`,
      iso6346: `MSCU${containerId.toString().padStart(7, '0')}`,
      timestamp: new Date().toISOString(),
      location: {
        latitude: (Math.random() * 180 - 90).toFixed(6),
        longitude: (Math.random() * 360 - 180).toFixed(6),
        altitude: Math.floor(Math.random() * 100),
        accuracy: Math.floor(Math.random() * 10) + 1,
        heading: Math.floor(Math.random() * 360),
        speed: (Math.random() * 25).toFixed(2)
      },
      sensors: {
        temperature: {
          internal: (Math.random() * 50 - 20).toFixed(2),
          external: (Math.random() * 60 - 30).toFixed(2),
          unit: 'celsius'
        },
        humidity: {
          level: Math.floor(Math.random() * 100),
          unit: 'percentage'
        },
        pressure: {
          atmospheric: (Math.random() * 200 + 900).toFixed(2),
          unit: 'hPa'
        },
        battery: {
          level: Math.floor(Math.random() * 100),
          voltage: (Math.random() * 2 + 11).toFixed(2),
          charging: Math.random() > 0.8
        },
        door: {
          status: Math.random() > 0.95 ? 'open' : 'closed',
          openCount: Math.floor(Math.random() * 50),
          lastOpened: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString()
        },
        motion: {
          accelerometer: {
            x: (Math.random() * 20 - 10).toFixed(3),
            y: (Math.random() * 20 - 10).toFixed(3),
            z: (Math.random() * 20 - 10).toFixed(3),
            unit: 'm/s²'
          },
          gyroscope: {
            x: (Math.random() * 500 - 250).toFixed(3),
            y: (Math.random() * 500 - 250).toFixed(3),
            z: (Math.random() * 500 - 250).toFixed(3),
            unit: 'deg/s'
          }
        },
        light: {
          ambient: Math.floor(Math.random() * 1000),
          unit: 'lux'
        }
      },
      cargo: {
        type: ['refrigerated', 'dry', 'hazardous', 'liquid', 'bulk'][Math.floor(Math.random() * 5)],
        weight: Math.floor(Math.random() * 30000),
        volume: Math.floor(Math.random() * 50),
        destination: ['Shanghai', 'Rotterdam', 'Singapore', 'Hamburg', 'Los Angeles'][Math.floor(Math.random() * 5)],
        origin: ['New York', 'London', 'Tokyo', 'Dubai', 'Sydney'][Math.floor(Math.random() * 5)]
      },
      vessel: {
        name: `MV Cargo${Math.floor(Math.random() * 1000)}`,
        imo: `IMO${Math.floor(Math.random() * 9000000) + 1000000}`,
        callSign: Math.random().toString(36).substring(2, 8).toUpperCase(),
        voyageNumber: `V${Math.floor(Math.random() * 10000)}`
      },
      maintenance: {
        lastService: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
        nextService: new Date(Date.now() + Math.floor(Math.random() * 90) * 86400000).toISOString(),
        serviceHistory: Array.from({length: Math.floor(Math.random() * 10)}, (_, i) => ({
          date: new Date(Date.now() - i * 30 * 86400000).toISOString(),
          type: ['inspection', 'repair', 'cleaning', 'certification'][Math.floor(Math.random() * 4)],
          description: `Service record ${i + 1} for container maintenance`
        }))
      },
      // Add some variable-length text data to help reach target size
      events: Array.from({length: Math.floor(Math.random() * 20) + 5}, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        type: ['security_alert', 'temperature_warning', 'door_event', 'location_update', 'system_check'][Math.floor(Math.random() * 5)],
        severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        message: `Event ${i + 1}: ${Math.random().toString(36).substring(2, 50)} - Maritime container monitoring system detected an event requiring attention from the operations team.`,
        resolved: Math.random() > 0.3,
        resolvedAt: Math.random() > 0.3 ? new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString() : null
      })),
      // Add some padding data to help reach exact target size
      diagnostics: {
        systemVersion: '2.1.4',
        firmwareVersion: '1.8.2',
        lastBootTime: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
        memoryUsage: Math.floor(Math.random() * 80) + 10,
        cpuUsage: Math.floor(Math.random() * 50) + 5,
        networkSignal: Math.floor(Math.random() * 100),
        satelliteCount: Math.floor(Math.random() * 12) + 4,
        additionalData: Math.random().toString(36).repeat(100) // Variable padding
      }
    };
  }

  /**
   * Generate data until we reach exactly 30MB
   */
  async generateExact30MBData() {
    console.log(`🎯 Generating exactly ${this.targetSizeMB}MB of maritime container data...`);
    
    let totalData = [];
    let currentSize = 0;
    let containerId = 1;
    
    // Generate containers until we get close to target
    while (currentSize < this.targetSizeBytes * 0.95) {
      const containerData = this.generateContainerData(containerId++);
      totalData.push(containerData);
      
      // Calculate current size
      const dataString = JSON.stringify(totalData);
      currentSize = Buffer.byteLength(dataString, 'utf8');
      
      if (containerId % 100 === 0) {
        console.log(`Generated ${containerId} containers, current size: ${(currentSize / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    // Fine-tune to reach exactly 30MB by adjusting the last container's padding
    console.log('🎯 Fine-tuning to reach exactly 30MB...');
    
    while (true) {
      const dataString = JSON.stringify(totalData);
      currentSize = Buffer.byteLength(dataString, 'utf8');
      
      if (currentSize === this.targetSizeBytes) {
        break;
      } else if (currentSize < this.targetSizeBytes) {
        // Need more data - add padding to last container
        const diff = this.targetSizeBytes - currentSize;
        const lastContainer = totalData[totalData.length - 1];
        lastContainer.diagnostics.additionalData += 'x'.repeat(diff);
      } else {
        // Too much data - reduce padding
        const diff = currentSize - this.targetSizeBytes;
        const lastContainer = totalData[totalData.length - 1];
        lastContainer.diagnostics.additionalData = lastContainer.diagnostics.additionalData.slice(0, -diff);
      }
    }

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
   * Run the space test
   */
  async runTest() {
    try {
      console.log('🚢 Maritime Container Space Test Starting...\n');
      
      // Generate exactly 30MB of data
      const containerData = await this.generateExact30MBData();
      
      // Convert to JSON string and get exact size
      const jsonString = JSON.stringify(containerData);
      const decompressedBuffer = Buffer.from(jsonString, 'utf8');
      const decompressedSize = decompressedBuffer.length;
      
      console.log('\n📊 DECOMPRESSED DATA:');
      console.log(`Size: ${this.formatBytes(decompressedSize)} (${decompressedSize.toLocaleString()} bytes)`);
      console.log(`Containers: ${containerData.length.toLocaleString()}`);
      console.log(`Average per container: ${this.formatBytes(decompressedSize / containerData.length)}`);
      
      // Compress the data
      console.log('\n🗜️  Compressing data with Brotli...');
      const startTime = Date.now();
      
      const compressedBuffer = await this.compressionService.compress(containerData);
      
      const compressionTime = Date.now() - startTime;
      const compressedSize = compressedBuffer.length;
      
      console.log('\n📊 COMPRESSED DATA:');
      console.log(`Size: ${this.formatBytes(compressedSize)} (${compressedSize.toLocaleString()} bytes)`);
      console.log(`Compression time: ${compressionTime}ms`);
      
      // Calculate compression ratio and savings
      const compressionRatio = decompressedSize / compressedSize;
      const spaceSaved = decompressedSize - compressedSize;
      const spaceSavedPercent = ((spaceSaved / decompressedSize) * 100).toFixed(2);
      
      console.log('\n📈 COMPRESSION STATISTICS:');
      console.log(`Compression ratio: ${compressionRatio.toFixed(2)}:1`);
      console.log(`Space saved: ${this.formatBytes(spaceSaved)} (${spaceSavedPercent}%)`);
      console.log(`Efficiency: ${(decompressedSize / compressionTime / 1024).toFixed(2)} KB/ms`);
      
      // Test decompression
      console.log('\n🔄 Testing decompression...');
      const decompressStartTime = Date.now();
      
      const decompressedData = await this.compressionService.decompress(compressedBuffer);
      
      const decompressionTime = Date.now() - decompressStartTime;
      const decompressedJson = JSON.stringify(decompressedData);
      const decompressedVerifySize = Buffer.byteLength(decompressedJson, 'utf8');
      
      console.log(`Decompression time: ${decompressionTime}ms`);
      console.log(`Verification: ${decompressedVerifySize === decompressedSize ? '✅ PASSED' : '❌ FAILED'}`);
      
      console.log('\n🎯 SUMMARY:');
      console.log(`Original: ${this.formatBytes(decompressedSize)}`);
      console.log(`Compressed: ${this.formatBytes(compressedSize)}`);
      console.log(`Saved: ${this.formatBytes(spaceSaved)} (${spaceSavedPercent}%)`);
      console.log(`Total time: ${compressionTime + decompressionTime}ms`);
      
    } catch (error) {
      console.error('❌ Error during space test:', error);
      throw error;
    }
  }
}

// Run the test
if (require.main === module) {
  const spaceTest = new SpaceTestScript();
  spaceTest.runTest()
    .then(() => {
      console.log('\n✅ Space test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Space test failed:', error);
      process.exit(1);
    });
}

module.exports = SpaceTestScript; 
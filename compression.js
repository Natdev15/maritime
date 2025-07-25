const msgpack = require('msgpack5')();

/**
 * MessagePack Compression Service - Binary serialization for IoT/embedded systems
 * MessagePack is a binary serialization format that's more compact than JSON and optimized for ESP32/embedded devices.
 */
class CompressionService {
  constructor() {
    // MessagePack doesn't require any initialization options
    // Efficient binary serialization for IoT and M2M applications
  }

  async compress(containerData) {
    try {
      // MessagePack encoding - returns Buffer directly
      const compressed = msgpack.encode(containerData);
      
      return Buffer.from(compressed);
    } catch (error) {
      throw new Error(`MessagePack compression failed: ${error.message}`);
    }
  }

  async decompress(compressedBuffer) {
    try {
      // MessagePack decoding - handles Buffer directly
      const decompressed = msgpack.decode(compressedBuffer);
      
      return decompressed;
    } catch (error) {
      throw new Error(`MessagePack decompression failed: ${error.message}`);
    }
  }

  async compressMultiple(containersArray) {
    try {
      // MessagePack encoding of entire array
      const compressed = msgpack.encode(containersArray);
      
      return Buffer.from(compressed);
    } catch (error) {
      throw new Error(`MessagePack multi-compression failed: ${error.message}`);
    }
  }

  async decompressMultiple(compressedBuffer) {
    try {
      // MessagePack decoding - returns the original array
      const decompressed = msgpack.decode(compressedBuffer);
      
      // Ensure we return an array
      if (!Array.isArray(decompressed)) {
        throw new Error('Decompressed data is not an array');
      }
      
      return decompressed;
    } catch (error) {
      throw new Error(`MessagePack multi-decompression failed: ${error.message}`);
    }
  }

  /**
   * Get compression ratio between original and compressed data
   */
  getCompressionRatio(originalSize, compressedSize) {
    if (compressedSize === 0) return 1.0;
    return (originalSize / compressedSize).toFixed(2);
  }

  /**
   * Format bytes for human-readable output
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Test compression with sample data
   */
  async testCompression() {
    const testData = {
      containerId: "TEST12345",
      timestamp: new Date().toISOString(),
      sensors: {
        temperature: 23.5,
        humidity: 65.2,
        pressure: 1013.25
      },
      location: {
        latitude: 31.2504,
        longitude: 28.1651
      }
    };

    try {
      console.log('🧪 Testing MessagePack compression...');
      
      const originalSize = Buffer.byteLength(JSON.stringify(testData), 'utf8');
      const compressed = await this.compress(testData);
      const decompressed = await this.decompress(compressed);
      
      const compressionRatio = this.getCompressionRatio(originalSize, compressed.length);
      
      console.log(`✅ MessagePack Test Results:`);
      console.log(`   Original: ${this.formatBytes(originalSize)}`);
      console.log(`   Compressed: ${this.formatBytes(compressed.length)}`);
      console.log(`   Ratio: ${compressionRatio}:1`);
      console.log(`   Data integrity: ${JSON.stringify(testData) === JSON.stringify(decompressed) ? '✅ PASS' : '❌ FAIL'}`);
      
      return {
        success: true,
        originalSize,
        compressedSize: compressed.length,
        compressionRatio: parseFloat(compressionRatio),
        dataIntegrity: JSON.stringify(testData) === JSON.stringify(decompressed)
      };
    } catch (error) {
      console.error('❌ MessagePack test failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = CompressionService; 
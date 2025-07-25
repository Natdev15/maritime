const lz4 = require('lz4js');

/**
 * Full JSON Compression Service - CBOR encoding of complete JSON
 * CBOR is a binary serialization format, not a compressor, but is much more compact than JSON and ideal for IoT/embedded.
 */
class CompressionService {
  constructor() {
    // LZ4 doesn't require any initialization options
    // Pure JavaScript implementation for optimal compatibility
  }

  async compress(containerData) {
    try {
      // Convert to JSON string first, then to Uint8Array
      const jsonString = JSON.stringify(containerData);
      const inputBuffer = Buffer.from(jsonString, 'utf8');
      
      // LZ4 compression - returns Uint8Array
      const compressed = lz4.compress(inputBuffer);
      
      // Convert back to Buffer for consistency with existing code
      return Buffer.from(compressed);
    } catch (error) {
      throw new Error(`LZ4 compression failed: ${error.message}`);
    }
  }

  async decompress(compressedBuffer) {
    try {
      // Ensure we have a Uint8Array for lz4js
      const uint8Array = new Uint8Array(compressedBuffer);
      
      // LZ4 decompression - returns Uint8Array
      const decompressed = lz4.decompress(uint8Array);
      
      // Convert back to string and parse JSON
      const jsonString = Buffer.from(decompressed).toString('utf8');
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`LZ4 decompression failed: ${error.message}`);
    }
  }

  async compressMultiple(containersArray) {
    try {
      // Convert array to JSON string first, then to Uint8Array
      const jsonString = JSON.stringify(containersArray);
      const inputBuffer = Buffer.from(jsonString, 'utf8');
      
      // LZ4 compression - returns Uint8Array
      const compressed = lz4.compress(inputBuffer);
      
      // Convert back to Buffer for consistency
      return Buffer.from(compressed);
    } catch (error) {
      throw new Error(`LZ4 multi-compression failed: ${error.message}`);
    }
  }

  async decompressMultiple(compressedBuffer) {
    try {
      // Ensure we have a Uint8Array for lz4js
      const uint8Array = new Uint8Array(compressedBuffer);
      
      // LZ4 decompression - returns Uint8Array
      const decompressed = lz4.decompress(uint8Array);
      
      // Convert back to string and parse JSON
      const jsonString = Buffer.from(decompressed).toString('utf8');
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`LZ4 multi-decompression failed: ${error.message}`);
    }
  }

  getCompressionRatio(originalData, compressedBuffer) {
    const originalSize = Buffer.byteLength(JSON.stringify(originalData), 'utf8');
    const compressedSize = compressedBuffer.length;
    return originalSize / compressedSize;
  }

  analyzeSpaceSavings(originalData, compressedBuffer) {
    const originalSize = Buffer.byteLength(JSON.stringify(originalData), 'utf8');
    const compressedSize = compressedBuffer.length;
    const spaceSaved = originalSize - compressedSize;
    const percentSaved = ((spaceSaved / originalSize) * 100).toFixed(2);
    
    return {
      originalSize,
      compressedSize,
      spaceSaved,
      percentSaved: parseFloat(percentSaved),
      compressionRatio: (originalSize / compressedSize).toFixed(2)
    };
  }

  async testCycle(containerData) {
    try {
      const compressed = await this.compress(containerData);
      const decompressed = await this.decompress(compressed);
      
      const originalJson = JSON.stringify(containerData);
      const decompressedJson = JSON.stringify(decompressed);
      const isValid = originalJson === decompressedJson;
      
      return {
        success: isValid,
        original: containerData,
        compressed,
        decompressed,
        analysis: this.analyzeSpaceSavings(containerData, compressed)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        original: containerData,
        compressed: null,
        decompressed: null,
        analysis: null
      };
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = CompressionService; 
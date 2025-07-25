const cbor = require('cbor');

/**
 * Full JSON Compression Service - CBOR encoding of complete JSON
 * CBOR is a binary serialization format, not a compressor, but is much more compact than JSON and ideal for IoT/embedded.
 */
class CompressionService {
  constructor() {}

  /**
   * Encode single container data using CBOR
   */
  async compress(containerData) {
    try {
      return cbor.encode(containerData); // returns Buffer
    } catch (error) {
      throw new Error(`CBOR encoding failed: ${error.message}`);
    }
  }

  /**
   * Decode container data back to original JSON
   */
  async decompress(encodedBuffer) {
    try {
      return cbor.decode(encodedBuffer); // returns JS object
    } catch (error) {
      throw new Error(`CBOR decoding failed: ${error.message}`);
    }
  }

  /**
   * Encode multiple containers with CBOR
   */
  async compressMultiple(containersArray) {
    try {
      return cbor.encode(containersArray); // returns Buffer
    } catch (error) {
      throw new Error(`CBOR multi-encode failed: ${error.message}`);
    }
  }

  /**
   * Decode multiple containers
   */
  async decompressMultiple(encodedBuffer) {
    try {
      return cbor.decode(encodedBuffer); // returns array
    } catch (error) {
      throw new Error(`CBOR multi-decode failed: ${error.message}`);
    }
  }

  /**
   * Get encoding ratio compared to original JSON
   */
  getCompressionRatio(originalData, encodedBuffer) {
    const originalSize = Buffer.byteLength(JSON.stringify(originalData), 'utf8');
    const encodedSize = encodedBuffer.length;
    return originalSize / encodedSize;
  }

  /**
   * Analyze space savings
   */
  analyzeSpaceSavings(originalData, encodedBuffer) {
    const originalSize = Buffer.byteLength(JSON.stringify(originalData), 'utf8');
    const encodedSize = encodedBuffer.length;
    const spaceSaved = originalSize - encodedSize;
    const percentSaved = ((spaceSaved / originalSize) * 100).toFixed(2);
    return {
      originalSize,
      encodedSize,
      spaceSaved,
      percentSaved: parseFloat(percentSaved),
      compressionRatio: (originalSize / encodedSize).toFixed(2)
    };
  }

  /**
   * Test encode/decode cycle for validation
   */
  async testCycle(containerData) {
    try {
      // Encode
      const encoded = await this.compress(containerData);
      // Decode
      const decoded = await this.decompress(encoded);
      // Verify integrity
      const originalJson = JSON.stringify(containerData);
      const decodedJson = JSON.stringify(decoded);
      const isValid = originalJson === decodedJson;
      return {
        success: isValid,
        original: containerData,
        encoded,
        decoded,
        analysis: this.analyzeSpaceSavings(containerData, encoded)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
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
}

module.exports = CompressionService; 
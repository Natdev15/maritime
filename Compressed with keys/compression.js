const zlib = require('zlib');
const { promisify } = require('util');

// Promisify brotli functions for async/await usage
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * Full JSON Compression Service - Direct Brotli compression of complete JSON
 * Compresses the entire JSON structure without schema-based value extraction
 * This provides better compatibility and simplicity while still achieving good compression ratios
 */
class CompressionService {
  constructor() {
    // Brotli compression settings optimized for JSON data
    this.brotliOptions = {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 6, // Maximum compression
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 1024 * 1024, // 1MB hint
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
      }
    };
  }

  /**
   * Compress single container data using direct JSON compression
   */
  async compress(containerData) {
    try {
      // Convert to JSON string
      const jsonString = JSON.stringify(containerData);
      const jsonBuffer = Buffer.from(jsonString, 'utf8');
      
      // Apply Brotli compression directly to the JSON
      const compressedBuffer = await brotliCompress(jsonBuffer, this.brotliOptions);
      
      return compressedBuffer;
    } catch (error) {
      throw new Error(`JSON compression failed: ${error.message}`);
    }
  }

  /**
   * Decompress container data back to original JSON
   */
  async decompress(compressedBuffer) {
    try {
      // Decompress with Brotli
      const decompressedBuffer = await brotliDecompress(compressedBuffer);
      
      // Parse back to JSON object
      const jsonString = decompressedBuffer.toString('utf8');
      const containerData = JSON.parse(jsonString);
      
      return containerData;
    } catch (error) {
      throw new Error(`JSON decompression failed: ${error.message}`);
    }
  }

  /**
   * Compress multiple containers with maximum efficiency
   */
  async compressMultiple(containersArray) {
    try {
      // Convert entire array to JSON string
      const jsonString = JSON.stringify(containersArray);
      const jsonBuffer = Buffer.from(jsonString, 'utf8');
      
      // Apply Brotli compression
      const compressedBuffer = await brotliCompress(jsonBuffer, this.brotliOptions);
      
      return compressedBuffer;
    } catch (error) {
      throw new Error(`Multi-JSON compression failed: ${error.message}`);
    }
  }

  /**
   * Decompress multiple containers
   */
  async decompressMultiple(compressedBuffer) {
    try {
      // Decompress with Brotli
      const decompressedBuffer = await brotliDecompress(compressedBuffer);
      
      // Parse back to array of containers
      const jsonString = decompressedBuffer.toString('utf8');
      const containersArray = JSON.parse(jsonString);
      
      return containersArray;
    } catch (error) {
      throw new Error(`Multi-JSON decompression failed: ${error.message}`);
    }
  }

  /**
   * Get compression ratio compared to original JSON
   */
  getCompressionRatio(originalData, compressedBuffer) {
    const originalSize = Buffer.byteLength(JSON.stringify(originalData), 'utf8');
    const compressedSize = compressedBuffer.length;
    return originalSize / compressedSize;
  }

  /**
   * Analyze space savings
   */
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

  /**
   * Test compression/decompression cycle for validation
   */
  async testCycle(containerData) {
    try {
      // Compress
      const compressed = await this.compress(containerData);
      
      // Decompress
      const decompressed = await this.decompress(compressed);
      
      // Verify integrity
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
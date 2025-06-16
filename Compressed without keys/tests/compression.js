const zlib = require('zlib');
const { promisify } = require('util');

// Promisify brotli functions for async/await usage
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

class CompressionService {
  constructor() {
    // Brotli compression options optimized for JSON data
    this.compressionOptions = {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 1, // Maximum compression (0-11)
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 1024 // Expected input size hint
      }
    };
  }

  /**
   * Compress container data using Brotli
   * @param {Object} data - Container data object
   * @returns {Promise<Buffer>} Compressed data
   */
  async compress(data) {
    try {
      const jsonString = JSON.stringify(data);
      const compressed = await brotliCompress(Buffer.from(jsonString, 'utf8'), this.compressionOptions);
      return compressed;
    } catch (error) {
      console.error('Compression error:', error);
      throw new Error(`Failed to compress data: ${error.message}`);
    }
  }

  /**
   * Decompress container data
   * @param {Buffer} compressedData - Compressed data buffer
   * @returns {Promise<Object>} Decompressed data object
   */
  async decompress(compressedData) {
    try {
      const decompressed = await brotliDecompress(compressedData);
      const jsonString = decompressed.toString('utf8');
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Decompression error:', error);
      throw new Error(`Failed to decompress data: ${error.message}`);
    }
  }

  /**
   * Get compression ratio for monitoring
   * @param {Object} originalData - Original data object
   * @param {Buffer} compressedData - Compressed data buffer
   * @returns {number} Compression ratio (original/compressed)
   */
  getCompressionRatio(originalData, compressedData) {
    const originalSize = Buffer.byteLength(JSON.stringify(originalData), 'utf8');
    const compressedSize = compressedData.length;
    return originalSize / compressedSize;
  }
}

module.exports = CompressionService; 
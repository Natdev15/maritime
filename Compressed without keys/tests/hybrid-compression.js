const zlib = require('zlib');
const { promisify } = require('util');
const SchemaCompressionService = require('./schema-compression');

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * Hybrid compression service combining schema-based value extraction with Brotli compression
 * Step 1: Extract only values using schema (eliminates redundant JSON keys)
 * Step 2: Apply Brotli compression to the value array
 */
class HybridCompressionService {
  constructor() {
    this.schemaService = new SchemaCompressionService();
    
    // Brotli compression settings optimized for JSON data
    this.brotliOptions = {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11, // Maximum compression
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 1024 * 1024, // 1MB hint
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
      }
    };
  }

  /**
   * Compress single container data using hybrid approach
   */
  async compressContainer(containerData) {
    try {
      // Step 1: Extract values using schema (removes redundant keys)
      const schemaCompressed = this.schemaService.compressContainer(containerData);
      
      // Step 2: Apply Brotli compression to the values
      const brotliCompressed = await brotliCompress(schemaCompressed, this.brotliOptions);
      
      return brotliCompressed;
    } catch (error) {
      throw new Error(`Hybrid compression failed: ${error.message}`);
    }
  }

  /**
   * Decompress single container data
   */
  async decompressContainer(compressedBuffer) {
    try {
      // Step 1: Decompress with Brotli
      const brotliDecompressed = await brotliDecompress(compressedBuffer);
      
      // Step 2: Reconstruct full JSON from values using schema
      const containerData = this.schemaService.decompressContainer(brotliDecompressed);
      
      return containerData;
    } catch (error) {
      throw new Error(`Hybrid decompression failed: ${error.message}`);
    }
  }

  /**
   * Compress multiple containers with maximum efficiency
   */
  async compressMultiple(containersArray) {
    try {
      // Step 1: Extract all values using schema
      const schemaCompressed = this.schemaService.compressMultiple(containersArray);
      
      // Step 2: Apply Brotli compression
      const brotliCompressed = await brotliCompress(schemaCompressed, this.brotliOptions);
      
      return brotliCompressed;
    } catch (error) {
      throw new Error(`Hybrid multi-compression failed: ${error.message}`);
    }
  }

  /**
   * Decompress multiple containers
   */
  async decompressMultiple(compressedBuffer) {
    try {
      // Step 1: Decompress with Brotli
      const brotliDecompressed = await brotliDecompress(compressedBuffer);
      
      // Step 2: Reconstruct all containers from values
      const containersArray = this.schemaService.decompressMultiple(brotliDecompressed);
      
      return containersArray;
    } catch (error) {
      throw new Error(`Hybrid multi-decompression failed: ${error.message}`);
    }
  }

  /**
   * Analyze compression performance across different methods
   */
  async analyzeCompressionMethods(containerData) {
    const originalJson = JSON.stringify(containerData);
    const originalSize = Buffer.byteLength(originalJson, 'utf8');
    
    try {
      // Method 1: No compression
      const noCompression = {
        name: 'No Compression',
        size: originalSize,
        ratio: 1,
        percentSaved: 0
      };

      // Method 2: Brotli only
      const brotliOnly = await brotliCompress(Buffer.from(originalJson, 'utf8'), this.brotliOptions);
      const brotliOnlyAnalysis = {
        name: 'Brotli Only',
        size: brotliOnly.length,
        ratio: (originalSize / brotliOnly.length).toFixed(2),
        percentSaved: (((originalSize - brotliOnly.length) / originalSize) * 100).toFixed(2)
      };

      // Method 3: Schema compression only
      const schemaOnly = this.schemaService.compressContainer(containerData);
      const schemaOnlyAnalysis = {
        name: 'Schema Only',
        size: schemaOnly.length,
        ratio: (originalSize / schemaOnly.length).toFixed(2),
        percentSaved: (((originalSize - schemaOnly.length) / originalSize) * 100).toFixed(2)
      };

      // Method 4: Hybrid (Schema + Brotli)
      const hybrid = await this.compressContainer(containerData);
      const hybridAnalysis = {
        name: 'Hybrid (Schema + Brotli)',
        size: hybrid.length,
        ratio: (originalSize / hybrid.length).toFixed(2),
        percentSaved: (((originalSize - hybrid.length) / originalSize) * 100).toFixed(2)
      };

      return {
        originalSize,
        methods: [noCompression, brotliOnlyAnalysis, schemaOnlyAnalysis, hybridAnalysis],
        bestMethod: hybridAnalysis
      };
    } catch (error) {
      throw new Error(`Compression analysis failed: ${error.message}`);
    }
  }

  /**
   * Test the complete hybrid compression cycle
   */
  async testHybridCycle(containerData) {
    try {
      const startTime = Date.now();
      
      // Compress
      const compressed = await this.compressContainer(containerData);
      const compressionTime = Date.now() - startTime;
      
      // Decompress
      const decompressStart = Date.now();
      const decompressed = await this.decompressContainer(compressed);
      const decompressionTime = Date.now() - decompressStart;
      
      // Verify integrity
      const originalJson = JSON.stringify(containerData);
      const decompressedJson = JSON.stringify(decompressed);
      const isValid = originalJson === decompressedJson;
      
      // Calculate savings
      const originalSize = Buffer.byteLength(originalJson, 'utf8');
      const compressedSize = compressed.length;
      const spaceSaved = originalSize - compressedSize;
      const percentSaved = ((spaceSaved / originalSize) * 100).toFixed(2);
      
      return {
        success: isValid,
        originalSize,
        compressedSize,
        spaceSaved,
        percentSaved: parseFloat(percentSaved),
        compressionRatio: (originalSize / compressedSize).toFixed(2),
        compressionTime,
        decompressionTime,
        totalTime: compressionTime + decompressionTime,
        efficiency: (originalSize / (compressionTime + decompressionTime) / 1024).toFixed(2) // KB/ms
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

  /**
   * Get compression ratio for API compatibility
   */
  getCompressionRatio(originalData, compressedBuffer) {
    const originalSize = Buffer.byteLength(JSON.stringify(originalData), 'utf8');
    const compressedSize = compressedBuffer.length;
    return originalSize / compressedSize;
  }

  // Alias methods for API compatibility with existing compression service
  async compress(data) {
    return this.compressContainer(data);
  }

  async decompress(compressedBuffer) {
    return this.decompressContainer(compressedBuffer);
  }
}

module.exports = HybridCompressionService; 
const zlib = require('zlib');
const { promisify } = require('util');

// Promisify brotli functions for async/await usage
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * Hybrid Compression Service - Schema-based value extraction + Brotli compression
 * Step 1: Extract only values from JSON using predefined schema (eliminates redundant keys)
 * Step 2: Apply Brotli compression to the value array for maximum space savings
 */
class CompressionService {
  constructor() {
    // Define the schema for maritime container data (matches test-load.js format)
    this.schema = this.defineSchema();
    
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
   * Define the schema structure for maritime container data
   * This must match exactly with the data structure used in the application
   */
  defineSchema() {
    return {
      // Container identification
      containerId: 'string',           // CONT000001
      iso6346: 'string',              // LMCU0000001  
      msisdn: 'string',               // 393315537800
      
      // Timing
      time: 'string',                 // 20241218123045 (compressed timestamp)
      timestamp: 'string',            // ISO timestamp
      
      // Network/Communication
      rssi: 'string',                 // Signal strength
      cgi: 'string',                  // Cell tower info: "999-01-1-31D41"
      "ble-m": 'string',              // Bluetooth mode: "0"
      
      // Power/Battery
      "bat-soc": 'string',            // Battery state of charge
      
      // Motion/Acceleration
      acc: 'string',                  // Concatenated accelerometer data
      
      // Environmental sensors
      temperature: 'string',          // Temperature reading
      humidity: 'string',             // Humidity reading  
      pressure: 'string',             // Pressure reading
      
      // Status
      door: 'string',                 // Door status: "D"
      gnss: 'string',                 // GPS status: "1"
      
      // Location
      latitude: 'string',             // GPS latitude
      longitude: 'string',            // GPS longitude
      altitude: 'string',             // GPS altitude
      speed: 'string',                // Speed
      heading: 'string',              // Heading direction
      
      // GPS quality
      nsat: 'string',                 // Number of satellites  
      hdop: 'string',                 // Horizontal dilution of precision
      
      // Optional padding (may be added for exact size targeting)
      padding: 'string'               // Padding data to reach exact target size
    };
  }

  /**
   * Extract values from container data in schema order
   */
  extractValues(containerData) {
    const values = [];
    const schemaKeys = Object.keys(this.schema);
    
    for (const key of schemaKeys) {
      const value = containerData[key];
      // Store undefined/null as null to maintain array positions
      values.push(value !== undefined ? value : null);
    }
    
    return values;
  }

  /**
   * Reconstruct container data from values array
   */
  reconstructFromValues(values) {
    const containerData = {};
    const schemaKeys = Object.keys(this.schema);
    
    for (let i = 0; i < schemaKeys.length && i < values.length; i++) {
      const key = schemaKeys[i];
      const value = values[i];
      
      // Only set property if value is not null (skip undefined/missing values)
      if (value !== null) {
        containerData[key] = value;
      }
    }
    
    return containerData;
  }

  /**
   * Compress single container data using hybrid approach
   */
  async compress(containerData) {
    try {
      // Step 1: Extract values using schema (removes redundant keys)
      const values = this.extractValues(containerData);
      const valuesJson = JSON.stringify(values);
      const schemaCompressed = Buffer.from(valuesJson, 'utf8');
      
      // Step 2: Apply Brotli compression to the values
      const brotliCompressed = await brotliCompress(schemaCompressed, this.brotliOptions);
      
      return brotliCompressed;
    } catch (error) {
      throw new Error(`Hybrid compression failed: ${error.message}`);
    }
  }

  /**
   * Decompress container data and reconstruct full JSON
   */
  async decompress(compressedBuffer) {
    try {
      // Step 1: Decompress with Brotli
      const brotliDecompressed = await brotliDecompress(compressedBuffer);
      
      // Step 2: Parse values array
      const valuesJson = brotliDecompressed.toString('utf8');
      const values = JSON.parse(valuesJson);
      
      // Step 3: Reconstruct full JSON from values using schema
      const containerData = this.reconstructFromValues(values);
      
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
      // Extract all values using schema
      const allValues = containersArray.map(container => this.extractValues(container));
      const valuesJson = JSON.stringify(allValues);
      const schemaCompressed = Buffer.from(valuesJson, 'utf8');
      
      // Apply Brotli compression
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
      // Decompress with Brotli
      const brotliDecompressed = await brotliDecompress(compressedBuffer);
      
      // Parse all values
      const valuesJson = brotliDecompressed.toString('utf8');
      const allValues = JSON.parse(valuesJson);
      
      // Reconstruct all containers from values
      const containersArray = allValues.map(values => this.reconstructFromValues(values));
      
      return containersArray;
    } catch (error) {
      throw new Error(`Hybrid multi-decompression failed: ${error.message}`);
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
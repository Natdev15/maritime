/**
 * Schema-based compression service for maritime container data
 * Extracts only values in predefined order to eliminate redundant JSON keys
 */
class SchemaCompressionService {
  constructor() {
    // Define the exact schema/order for value extraction and reconstruction
    this.schema = this.defineSchema();
  }

  /**
   * Define the schema structure for maritime container data
   * This must match exactly with the data structure in test-load.js
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
   * Get value from object (simplified since we no longer use nested paths)
   */
  getNestedValue(obj, path) {
    // Since our new schema uses flat properties, just return the direct property
    return obj[path];
  }

  /**
   * Set value in object (simplified since we no longer use nested paths)
   */
  setNestedValue(obj, path, value) {
    // Since our new schema uses flat properties, just set the direct property
    obj[path] = value;
  }

  /**
   * Extract values from container data in schema order
   */
  extractValues(containerData) {
    const values = [];
    const schemaKeys = Object.keys(this.schema);
    
    for (const key of schemaKeys) {
      const type = this.schema[key];
      const value = this.getNestedValue(containerData, key);
      
      if (type === 'array') {
        // For arrays, we'll JSON stringify them (still saves space vs full object keys)
        values.push(JSON.stringify(value || []));
      } else {
        values.push(value);
      }
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
      const type = this.schema[key];
      let value = values[i];
      
      if (type === 'array') {
        // Parse JSON arrays back
        try {
          value = JSON.parse(value || '[]');
        } catch (e) {
          value = [];
        }
      }
      
      this.setNestedValue(containerData, key, value);
    }
    
    return containerData;
  }

  /**
   * Compress container data using schema-based value extraction
   */
  compressContainer(containerData) {
    const values = this.extractValues(containerData);
    
    // Convert to JSON string (much smaller than full object)
    const valuesJson = JSON.stringify(values);
    
    return Buffer.from(valuesJson, 'utf8');
  }

  /**
   * Decompress container data by reconstructing from values
   */
  decompressContainer(compressedBuffer) {
    const valuesJson = compressedBuffer.toString('utf8');
    const values = JSON.parse(valuesJson);
    
    return this.reconstructFromValues(values);
  }

  /**
   * Compress multiple containers (array of containers)
   */
  compressMultiple(containersArray) {
    const allValues = containersArray.map(container => this.extractValues(container));
    const valuesJson = JSON.stringify(allValues);
    return Buffer.from(valuesJson, 'utf8');
  }

  /**
   * Decompress multiple containers
   */
  decompressMultiple(compressedBuffer) {
    const valuesJson = compressedBuffer.toString('utf8');
    const allValues = JSON.parse(valuesJson);
    
    return allValues.map(values => this.reconstructFromValues(values));
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
   * Test the compression/decompression cycle
   */
  testCycle(containerData) {
    try {
      // Compress
      const compressed = this.compressContainer(containerData);
      
      // Decompress
      const decompressed = this.decompressContainer(compressed);
      
      // Verify
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
}

module.exports = SchemaCompressionService; 
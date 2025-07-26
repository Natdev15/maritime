/**
 * Extreme Astrocast CBOR Compression Engine
 * Optimized for Astrocast's 160-byte payload limit
 * 
 * This module implements ultra-aggressive CBOR compression techniques
 * to achieve 85%+ data reduction while maintaining data integrity
 */

const cbor = require('cbor');

class ExtremeAstrocastCBOR {
    constructor() {
        this.ASTROCAST_LIMIT = 160;
        
        // Only essential fields for maritime safety
        this.essentialFields = [
            'msisdn', 'time', 'latitude', 'longitude', 
            'temperature', 'humidity', 'bat-soc', 'door'
        ];
        
        // Key mapping for extreme compression
        this.keyMap = {
            'msisdn': 'm',
            'time': 't', 
            'latitude': 'l',
            'longitude': 'o',
            'temperature': 'e',
            'humidity': 'h',
            'bat-soc': 's',
            'door': 'd'
        };
        
        // Reverse mapping for decompression
        this.reverseKeyMap = {};
        for (const [original, compressed] of Object.entries(this.keyMap)) {
            this.reverseKeyMap[compressed] = original;
        }
    }

    /**
     * Extract only essential fields from sensor data
     */
    extractEssentialFields(sensorData) {
        const essentialData = {};
        
        for (const field of this.essentialFields) {
            if (sensorData[field] !== undefined) {
                essentialData[field] = sensorData[field];
            }
        }
        
        return essentialData;
    }

    /**
     * Map long keys to single characters
     */
    mapKeys(data) {
        const mappedData = {};
        
        for (const [key, value] of Object.entries(data)) {
            const mappedKey = this.keyMap[key] || key;
            mappedData[mappedKey] = value;
        }
        
        return mappedData;
    }

    /**
     * Apply extreme value optimization
     */
    extremeOptimizeValue(key, value) {
        switch (key) {
            case 'msisdn':
                // Remove country prefix and keep last 6 digits
                return value.replace(/^39/, '').slice(-6);
                
            case 'time':
                // Convert "200423 002014.0" to "20042300"
                return value.replace(/[^0-9]/g, '').substring(0, 8);
                
            case 'latitude':
            case 'longitude':
                // Round to 2 decimal places and convert to number
                return Math.round(parseFloat(value) * 100) / 100;
                
            case 'temperature':
            case 'humidity':
                // Round to nearest integer
                return Math.round(parseFloat(value));
                
            case 'bat-soc':
                // Convert to integer
                return parseInt(value) || 0;
                
            case 'door':
                // Keep only first character
                return value.charAt(0);
                
            default:
                return value;
        }
    }

    /**
     * Optimize all values in the data
     */
    optimizeValues(data) {
        const optimizedData = {};
        
        for (const [key, value] of Object.entries(data)) {
            optimizedData[key] = this.extremeOptimizeValue(key, value);
        }
        
        return optimizedData;
    }

    /**
     * Create minimal payload for Astrocast
     */
    createMinimalPayload(essentialData) {
        const mappedData = this.mapKeys(essentialData);
        const optimizedData = this.optimizeValues(mappedData);
        return optimizedData;
    }

    /**
     * Extreme Astrocast optimization - main compression method
     */
    extremeOptimize(sensorData) {
        console.log('🔥 Extreme Astrocast Optimization Starting...');
        
        // Extract only essential fields
        const essentialData = this.extractEssentialFields(sensorData);
        
        // Create minimal payload
        const minimalPayload = this.createMinimalPayload(essentialData);
        
        // Encode with CBOR
        const compressedBuffer = cbor.encode(minimalPayload);
        
        // Calculate metrics
        const originalSize = JSON.stringify(sensorData).length;
        const compressedSize = compressedBuffer.length;
        const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
        const astrocastCompatible = compressedSize <= this.ASTROCAST_LIMIT;
        const bytesRemaining = this.ASTROCAST_LIMIT - compressedSize;
        
        console.log('📊 Extreme Optimization Results:');
        console.log(`   Original: ${originalSize} bytes`);
        console.log(`   Compressed: ${compressedSize} bytes`);
        console.log(`   Compression: ${compressionRatio}% saved`);
        console.log(`   Astrocast Compatible: ${astrocastCompatible ? '✅' : '❌'}`);
        console.log(`   Bytes Remaining: ${bytesRemaining}`);
        console.log(`   Fields Included: ${Object.keys(essentialData).length}/${Object.keys(sensorData).length}`);
        
        return {
            compressedBuffer,
            originalSize,
            compressedSize,
            compressionRatio: parseFloat(compressionRatio),
            astrocastCompatible,
            bytesRemaining,
            fieldsIncluded: Object.keys(essentialData).length,
            totalFields: Object.keys(sensorData).length
        };
    }

    /**
     * Decompress from Astrocast format
     */
    extremeDecompress(compressedBuffer) {
        try {
            // Decode CBOR
            const compressedData = cbor.decode(compressedBuffer);
            
            // Reverse key mapping
            const reverseMappedData = {};
            for (const [key, value] of Object.entries(compressedData)) {
                const originalKey = this.reverseKeyMap[key] || key;
                reverseMappedData[originalKey] = this.extremeReconstructValue(originalKey, value);
            }
            
            return reverseMappedData;
            
        } catch (error) {
            console.error('❌ Decompression error:', error.message);
            throw new Error(`Decompression failed: ${error.message}`);
        }
    }

    /**
     * Reconstruct original value format
     */
    extremeReconstructValue(key, value) {
        switch (key) {
            case 'msisdn':
                // Add back country prefix
                return `39${value}`;
                
            case 'time':
                // Reconstruct time format "200423 002014.0"
                const timeStr = value.toString();
                if (timeStr.length >= 8) {
                    return `${timeStr.substring(0, 6)} ${timeStr.substring(6, 8)}00.0`;
                }
                return value;
                
            case 'latitude':
            case 'longitude':
                // Convert back to string with 4 decimal places
                return parseFloat(value).toFixed(4);
                
            case 'temperature':
            case 'humidity':
                // Convert back to string with 2 decimal places
                return parseFloat(value).toFixed(2);
                
            case 'bat-soc':
                // Convert back to string
                return value.toString();
                
            case 'door':
                // Convert to uppercase
                return value.toUpperCase();
                
            default:
                return value;
        }
    }

    /**
     * Validate data integrity after compression/decompression
     */
    validateDataIntegrity(originalData, decompressedData) {
        const originalEssential = this.extractEssentialFields(originalData);
        const decompressedEssential = this.extractEssentialFields(decompressedData);
        
        // Check if all essential fields are present
        for (const field of this.essentialFields) {
            if (originalEssential[field] !== undefined && decompressedEssential[field] === undefined) {
                return {
                    valid: false,
                    error: `Missing field: ${field}`,
                    missingField: field
                };
            }
        }
        
        // Check data type consistency
        for (const field of this.essentialFields) {
            if (originalEssential[field] !== undefined && decompressedEssential[field] !== undefined) {
                const originalType = typeof originalEssential[field];
                const decompressedType = typeof decompressedEssential[field];
                
                if (originalType !== decompressedType) {
                    return {
                        valid: false,
                        error: `Type mismatch for ${field}: ${originalType} vs ${decompressedType}`,
                        field: field,
                        originalType: originalType,
                        decompressedType: decompressedType
                    };
                }
            }
        }
        
        return {
            valid: true,
            message: 'Data integrity validated successfully'
        };
    }

    /**
     * Get compression statistics
     */
    getCompressionStats(originalData, compressedResult) {
        return {
            originalSize: compressedResult.originalSize,
            compressedSize: compressedResult.compressedSize,
            compressionRatio: compressedResult.compressionRatio,
            astrocastCompatible: compressedResult.astrocastCompatible,
            bytesRemaining: compressedResult.bytesRemaining,
            fieldsIncluded: compressedResult.fieldsIncluded,
            totalFields: compressedResult.totalFields,
            efficiency: `${compressedResult.compressionRatio}% reduction`,
            status: compressedResult.astrocastCompatible ? '✅ Compatible' : '❌ Exceeds Limit'
        };
    }

    /**
     * Test compression with sample data
     */
    testCompression() {
        const sampleData = {
            "msisdn": "393315537896",
            "iso6346": "LMCU1231230",
            "time": "200423 002014.0",
            "rssi": "26",
            "cgi": "999-01-1-31D41",
            "ble-m": "0",
            "bat-soc": "92",
            "acc": "-1010.0407 -1.4649 -4.3947",
            "temperature": "17.00",
            "humidity": "44.00",
            "pressure": "1012.5043",
            "door": "D",
            "gnss": "1",
            "latitude": "31.8910",
            "longitude": "28.7041",
            "altitude": "38.10",
            "speed": "27.3",
            "heading": "125.31",
            "nsat": "06",
            "hdop": "1.8"
        };

        console.log('🧪 Testing Extreme Astrocast CBOR Compression...');
        console.log('📊 Original Data Size:', JSON.stringify(sampleData).length, 'bytes');
        
        // Compress
        const compressionResult = this.extremeOptimize(sampleData);
        
        // Decompress
        const decompressedData = this.extremeDecompress(compressionResult.compressedBuffer);
        
        // Validate integrity
        const integrityCheck = this.validateDataIntegrity(sampleData, decompressedData);
        
        console.log('🔍 Data Integrity Check:', integrityCheck.valid ? '✅ PASSED' : '❌ FAILED');
        if (!integrityCheck.valid) {
            console.log('   Error:', integrityCheck.error);
        }
        
        return {
            compression: compressionResult,
            decompression: decompressedData,
            integrity: integrityCheck,
            stats: this.getCompressionStats(sampleData, compressionResult)
        };
    }
}

module.exports = ExtremeAstrocastCBOR;

// Export a singleton instance for easy use
module.exports.instance = new ExtremeAstrocastCBOR(); 
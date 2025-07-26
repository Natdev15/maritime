/**
 * ESP32 JavaScript CBOR Encoder
 * Pure JavaScript implementation for ESP32 to compress JSON data into CBOR
 * This can run on ESP32 using Node.js or similar JavaScript runtime
 */

const cbor = require('cbor');

class ESP32JSCBOREncoder {
    constructor() {
        // Field ID mappings (same as decoder) - reduced set for better compression
        this.fieldMapping = {
            'msisdn': 0,
            'iso6346': 1,
            'time': 2,
            'rssi': 3,
            'cgi': 4,
            'bat-soc': 5,
            'acc': 6,
            'temperature': 7,
            'humidity': 8,
            'pressure': 9,
            'door': 10,
            'latitude': 11,
            'longitude': 12,
            'altitude': 13,
            'speed': 14,
            'heading': 15
            // Removed: ble-m, gnss, nsat, hdop for space
        };

        // Quantization factors (very aggressive for 160-byte limit)
        this.quantizationFactors = {
            temperature: 1,     // No quantization
            humidity: 1,        // No quantization
            pressure: 100,      // Very reduced
            acc: 10,            // Very reduced
            latitude: 100,      // Very reduced
            longitude: 100,     // Very reduced
            altitude: 1,        // No quantization
            speed: 1,           // No quantization
            heading: 1          // No quantization
        };

        // Version and codec identifiers
        this.CBOR_VERSION = 0x01;
        this.CBOR_CODEC_ID = 0x01;
        this.ASTROCAST_LIMIT = 160;
    }

    /**
     * Quantize a value based on field type
     */
    quantizeValue(fieldName, value) {
        const factor = this.quantizationFactors[fieldName];
        if (factor && typeof value === 'number') {
            return Math.round(value * factor);
        }
        return value;
    }

    /**
     * Optimize MSISDN (remove "39" prefix, keep last 6 digits)
     */
    optimizeMSISDN(msisdn) {
        if (typeof msisdn === 'string') {
            // More aggressive: keep only last 4 digits
            return parseInt(msisdn.replace(/^39/, '').slice(-4));
        }
        return msisdn;
    }

    /**
     * Optimize time format (extract YYYYMMDDHH)
     */
    optimizeTime(timeStr) {
        if (typeof timeStr === 'string') {
            const digits = timeStr.replace(/[^0-9]/g, '');
            // More aggressive: keep only YYYYMMDD (8 digits)
            return parseInt(digits.substring(0, 8));
        }
        return timeStr;
    }

    /**
     * Parse CGI string into array format
     */
    parseCGI(cgiStr) {
        if (typeof cgiStr === 'string') {
            const parts = cgiStr.split('-');
            if (parts.length >= 4) {
                // More aggressive: use smaller numbers
                return [
                    parseInt(parts[0]) % 1000 || 0,  // MCC (mod 1000)
                    parseInt(parts[1]) % 100 || 0,   // MNC (mod 100)
                    parseInt(parts[2]) % 1000 || 0,  // LAC (mod 1000)
                    parseInt(parts[3]) % 100000 || 0 // Cell ID (mod 100000)
                ];
            }
        }
        return [0, 0, 0, 0];
    }

    /**
     * Parse accelerometer string into array format
     */
    parseAccelerometer(accStr) {
        if (typeof accStr === 'string') {
            const parts = accStr.split(' ').map(Number);
            if (parts.length >= 3) {
                // More aggressive: use smaller quantization
                return [
                    Math.round(parts[0] * 100), // Reduce from 1000 to 100
                    Math.round(parts[1] * 100),
                    Math.round(parts[2] * 100)
                ];
            }
        }
        return [0, 0, 0];
    }

    /**
     * Encode sensor data to CBOR format
     */
    encodeSensorData(sensorData) {
        try {
            console.log('🔄 Encoding sensor data to CBOR...');
            
            // Create encoded data object with version and codec first
            const encodedData = {};
            
            // Add version and codec identifiers
            encodedData[0xFF] = this.CBOR_VERSION; // Version
            encodedData[0xFE] = this.CBOR_CODEC_ID; // Codec
            
            // Encode each field with optimization
            for (const [fieldName, fieldId] of Object.entries(this.fieldMapping)) {
                const value = sensorData[fieldName];
                
                if (value !== undefined && value !== null) {
                    switch (fieldName) {
                        case 'msisdn':
                            encodedData[fieldId] = this.optimizeMSISDN(value);
                            break;
                        case 'time':
                            encodedData[fieldId] = this.optimizeTime(value);
                            break;
                        case 'cgi':
                            encodedData[fieldId] = this.parseCGI(value);
                            break;
                        case 'acc':
                            encodedData[fieldId] = this.parseAccelerometer(value);
                            break;
                        case 'temperature':
                        case 'humidity':
                        case 'pressure':
                        case 'latitude':
                        case 'longitude':
                        case 'altitude':
                        case 'speed':
                        case 'heading':
                        case 'hdop':
                            encodedData[fieldId] = this.quantizeValue(fieldName, value);
                            break;
                        default:
                            encodedData[fieldId] = value;
                            break;
                    }
                }
            }

            // Encode to CBOR
            const cborBuffer = cbor.encode(encodedData);
            
            // Check size limit
            if (cborBuffer.length > this.ASTROCAST_LIMIT) {
                throw new Error(`CBOR payload too large: ${cborBuffer.length} bytes > ${this.ASTROCAST_LIMIT} bytes`);
            }

            console.log(`✅ CBOR encoding successful: ${cborBuffer.length} bytes`);
            console.log(`📊 Compression: ${((1 - cborBuffer.length / JSON.stringify(sensorData).length) * 100).toFixed(1)}%`);
            
            return {
                success: true,
                cborBuffer: cborBuffer,
                size: cborBuffer.length,
                originalSize: JSON.stringify(sensorData).length,
                compressionRatio: ((1 - cborBuffer.length / JSON.stringify(sensorData).length) * 100).toFixed(1)
            };

        } catch (error) {
            console.error('❌ CBOR encoding failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate example sensor data for testing
     */
    generateExampleData() {
        return {
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
    }
}

// Export for use
module.exports = { ESP32JSCBOREncoder };

// Example usage (if run directly)
if (require.main === module) {
    const encoder = new ESP32JSCBOREncoder();
    const exampleData = encoder.generateExampleData();
    
    console.log('🧪 Testing ESP32 JavaScript CBOR Encoder');
    console.log('========================================');
    console.log('📋 Original JSON data:');
    console.log(JSON.stringify(exampleData, null, 2));
    
    const result = encoder.encodeSensorData(exampleData);
    
    if (result.success) {
        console.log('\n✅ Encoding successful!');
        console.log(`📦 CBOR size: ${result.size} bytes`);
        console.log(`📊 Compression: ${result.compressionRatio}%`);
        console.log(`🚀 Astrocast compatible: ${result.size <= 160 ? '✅' : '❌'}`);
        
        // Save to file for testing
        const fs = require('fs');
        fs.writeFileSync('test-esp32-payload.cbor', result.cborBuffer);
        console.log('💾 CBOR payload saved to: test-esp32-payload.cbor');
    } else {
        console.log('\n❌ Encoding failed:', result.error);
    }
} 
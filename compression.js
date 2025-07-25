const cbor = require('cbor');

/**
 * Maritime Compression Handler using CBOR
 * Handles compression and decompression of maritime sensor data
 * Optimized for Astrocast 160-byte payload limits
 */
class MaritimeCompressionHandler {
    
    constructor() {
        this.compressionType = 'cbor';
        console.log('🗜️  Maritime CBOR Compression Handler initialized');
    }
    
    /**
     * Compress maritime sensor data using CBOR with optimized field names
     * @param {Object} sensorData - Raw maritime sensor data
     * @returns {Object} - { compressedBuffer, originalSize, compressedSize, compressionRatio }
     */
    compressMaritimeData(sensorData) {
        try {
            // Optimize payload with shortened keys for better compression
            const optimizedPayload = {
                "ms": sensorData.msisdn,                                    // msisdn
                "iso": sensorData.iso6346,                                  // iso6346
                "t": sensorData.time,                                       // time
                "rssi": parseInt(sensorData.rssi) || 0,                     // rssi as int
                "cgi": sensorData.cgi || "",                                // cgi
                "bl": parseInt(sensorData["ble-m"]) || 0,                   // ble-m as int
                "ba": parseInt(sensorData["bat-soc"]) || 0,                 // bat-soc as int
                "a": this.parseAccelerometer(sensorData.acc),               // acc as array
                "te": parseFloat(sensorData.temperature) || 0.0,            // temperature
                "h": parseInt(sensorData.humidity) || 0,                    // humidity as int
                "p": parseFloat(sensorData.pressure) || 0.0,                // pressure
                "d": sensorData.door || "D",                                // door
                "g": parseInt(sensorData.gnss) || 1,                        // gnss as int
                "lat": parseFloat(sensorData.latitude) || 0.0,              // latitude
                "lon": parseFloat(sensorData.longitude) || 0.0,             // longitude
                "alt": parseFloat(sensorData.altitude) || 0.0,              // altitude
                "s": parseFloat(sensorData.speed) || 0.0,                   // speed
                "hd": parseFloat(sensorData.heading) || 0.0,                // heading
                "n": parseInt(sensorData.nsat) || 6,                        // nsat as int
                "hp": parseFloat(sensorData.hdop) || 0.0                    // hdop
            };
            
            // CBOR encode the optimized payload
            const compressedBuffer = cbor.encode(optimizedPayload);
            
            // Calculate compression metrics
            const originalSize = JSON.stringify(sensorData).length;
            const compressedSize = compressedBuffer.length;
            const compressionRatio = Math.round(((originalSize - compressedSize) / originalSize) * 100);
            
            console.log(`✅ CBOR compression completed:`);
            console.log(`   Original size: ${originalSize} bytes`);
            console.log(`   Compressed size: ${compressedSize} bytes`);
            console.log(`   Compression ratio: ${compressionRatio}% saved`);
            
            // Verify Astrocast compatibility
            if (compressedSize <= 160) {
                console.log(`🛰️  Astrocast compatible: ${compressedSize} bytes (under 160-byte limit)`);
            } else {
                console.warn(`⚠️  Payload exceeds Astrocast limit: ${compressedSize} bytes > 160 bytes`);
            }
            
            return {
                compressedBuffer,
                originalSize,
                compressedSize,
                compressionRatio,
                astrocastCompatible: compressedSize <= 160
            };
            
        } catch (error) {
            console.error('❌ CBOR compression failed:', error);
            throw new Error(`CBOR compression failed: ${error.message}`);
        }
    }
    
    /**
     * Decompress CBOR maritime data and reconstruct original JSON format
     * @param {Buffer} compressedBuffer - CBOR compressed data
     * @returns {Object} - Reconstructed maritime sensor data
     */
    decompressMaritimeData(compressedBuffer) {
        try {
            // Decode CBOR binary data
            const decompressed = cbor.decode(compressedBuffer);
            
            console.log('✅ CBOR decompression completed');
            console.log('📊 Decompressed fields:', Object.keys(decompressed).length);
            
            // Reconstruct original JSON format exactly as Mobius expects
            const reconstructed = {
                "msisdn": decompressed.ms || decompressed.msisdn || "",
                "iso6346": decompressed.iso || decompressed.iso6346 || "",
                "time": decompressed.t || decompressed.time || "",
                "rssi": this.formatToString(decompressed.rssi, "0"),
                "cgi": decompressed.cgi || "",
                "ble-m": this.formatToString(decompressed.bl, "0"),
                "bat-soc": this.formatToString(decompressed.ba, "0"),
                "acc": this.reconstructAccelerometer(decompressed.a || decompressed.acc),
                "temperature": this.formatFloat(decompressed.te || decompressed.temperature, 2),
                "humidity": this.formatFloat(decompressed.h || decompressed.humidity, 2),
                "pressure": this.formatFloat(decompressed.p || decompressed.pressure, 4),
                "door": decompressed.d || decompressed.door || "D",
                "gnss": this.formatToString(decompressed.g, "1"),
                "latitude": this.formatFloat(decompressed.lat || decompressed.latitude, 4),
                "longitude": this.formatFloat(decompressed.lon || decompressed.longitude, 4),
                "altitude": this.formatFloat(decompressed.alt || decompressed.altitude, 2),
                "speed": this.formatFloat(decompressed.s || decompressed.speed, 1),
                "heading": this.formatFloat(decompressed.hd || decompressed.heading, 2),
                "nsat": this.formatToString(decompressed.n, "06", 2),
                "hdop": this.formatFloat(decompressed.hp || decompressed.hdop, 1)
            };
            
            console.log('🔄 Successfully reconstructed maritime payload for Mobius');
            
            return reconstructed;
            
        } catch (error) {
            console.error('❌ CBOR decompression failed:', error);
            throw new Error(`CBOR decompression failed: ${error.message}`);
        }
    }
    
    /**
     * Parse accelerometer string into array for CBOR optimization
     * @param {string} accString - "x y z" format accelerometer data
     * @returns {Array} - [x, y, z] numeric array
     */
    parseAccelerometer(accString) {
        if (typeof accString === 'string') {
            return accString.split(' ').map(val => parseFloat(val) || 0.0);
        } else if (Array.isArray(accString)) {
            return accString.map(val => parseFloat(val) || 0.0);
        }
        return [0.0, 0.0, 0.0];
    }
    
    /**
     * Reconstruct accelerometer array back to string format
     * @param {Array} accArray - [x, y, z] numeric array
     * @returns {string} - "x y z" format string
     */
    reconstructAccelerometer(accArray) {
        if (Array.isArray(accArray)) {
            return accArray.map(val => parseFloat(val).toFixed(4)).join(' ');
        } else if (typeof accArray === 'string') {
            return accArray; // Already in string format
        }
        return "0.0000 0.0000 0.0000";
    }
    
    /**
     * Format numeric values to string with specified precision
     * @param {number} value - Numeric value
     * @param {number} decimals - Number of decimal places
     * @returns {string} - Formatted string
     */
    formatFloat(value, decimals = 2) {
        if (typeof value === 'number') {
            return value.toFixed(decimals);
        } else if (typeof value === 'string') {
            const num = parseFloat(value);
            return isNaN(num) ? "0.00" : num.toFixed(decimals);
        }
        return "0.00";
    }
    
    /**
     * Format values to string with optional padding
     * @param {any} value - Value to format
     * @param {string} defaultValue - Default if value is undefined
     * @param {number} padLength - Pad length for zero-padding
     * @returns {string} - Formatted string
     */
    formatToString(value, defaultValue = "0", padLength = 0) {
        let strValue;
        
        if (value !== undefined && value !== null) {
            strValue = value.toString();
        } else {
            strValue = defaultValue;
        }
        
        if (padLength > 0) {
            return strValue.padStart(padLength, '0');
        }
        
        return strValue;
    }
    
    /**
     * Get compression statistics for a payload
     * @param {Object} originalData - Original sensor data
     * @param {Buffer} compressedBuffer - Compressed data buffer
     * @returns {Object} - Compression statistics
     */
    getCompressionStats(originalData, compressedBuffer) {
        const originalSize = JSON.stringify(originalData).length;
        const compressedSize = compressedBuffer.length;
        const compressionRatio = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        const bytesReduced = originalSize - compressedSize;
        
        return {
            originalSize,
            compressedSize,
            compressionRatio,
            bytesReduced,
            astrocastCompatible: compressedSize <= 160,
            compressionType: 'cbor'
        };
    }
    
    /**
     * Test CBOR compression with sample maritime data
     */
    testCompression() {
        console.log('🧪 Testing CBOR compression...');
        
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
        
        try {
            // Test compression
            const compressionResult = this.compressMaritimeData(sampleData);
            
            // Test decompression
            const decompressedData = this.decompressMaritimeData(compressionResult.compressedBuffer);
            
            // Verify data integrity
            const isDataIntact = JSON.stringify(sampleData) === JSON.stringify(decompressedData);
            
            console.log('🔍 Test Results:');
            console.log(`   Data integrity: ${isDataIntact ? '✅ PASSED' : '❌ FAILED'}`);
            console.log(`   Original size: ${compressionResult.originalSize} bytes`);
            console.log(`   Compressed size: ${compressionResult.compressedSize} bytes`);
            console.log(`   Compression ratio: ${compressionResult.compressionRatio}%`);
            console.log(`   Astrocast compatible: ${compressionResult.astrocastCompatible ? '✅ YES' : '❌ NO'}`);
            
            if (!isDataIntact) {
                console.log('📊 Data comparison:');
                console.log('   Original:', JSON.stringify(sampleData, null, 2));
                console.log('   Reconstructed:', JSON.stringify(decompressedData, null, 2));
            }
            
            return {
                success: isDataIntact,
                compressionResult,
                decompressedData
            };
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Format bytes for human-readable display
     * @param {number} bytes - Number of bytes
     * @param {number} decimals - Decimal places
     * @returns {string} - Formatted string
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

module.exports = MaritimeCompressionHandler; 
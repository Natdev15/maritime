const cbor = require('cbor');

/**
 * Extreme Astrocast CBOR Compression
 * Removes non-essential fields and uses minimal data
 * Pipeline: ESP32 (encode) -> Astrocast -> Slave (decompress + headers) -> Mobius
 */
class ExtremeAstrocastCBOR {
    constructor() {
        this.ASTROCAST_LIMIT = 160;
        
        // Only essential fields for maritime tracking
        this.essentialFields = [
            'msisdn', 'time', 'latitude', 'longitude', 
            'temperature', 'humidity', 'bat-soc', 'door'
        ];
        
        // Ultra-short mapping
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
        
        this.reverseKeyMap = {};
        for (const [original, shortened] of Object.entries(this.keyMap)) {
            this.reverseKeyMap[shortened] = original;
        }
    }

    /**
     * Extreme optimization - only essential fields
     */
    extremeOptimize(sensorData) {
        try {
            console.log('🔥 Extreme Astrocast Optimization Starting...');
            
            // Step 1: Extract only essential fields
            const essentialData = this.extractEssentialData(sensorData);
            
            // Step 2: Create minimal payload
            const minimalPayload = this.createMinimalPayload(essentialData);
            
            // Step 3: CBOR encode
            const cborBuffer = cbor.encode(minimalPayload);
            
            // Step 4: Calculate metrics
            const originalSize = JSON.stringify(sensorData).length;
            const compressedSize = cborBuffer.length;
            const compressionRatio = Math.round(((originalSize - compressedSize) / originalSize) * 100);
            const astrocastCompatible = compressedSize <= this.ASTROCAST_LIMIT;
            
            console.log('📊 Extreme Optimization Results:');
            console.log(`   Original: ${originalSize} bytes`);
            console.log(`   Compressed: ${compressedSize} bytes`);
            console.log(`   Compression: ${compressionRatio}% saved`);
            console.log(`   Astrocast Compatible: ${astrocastCompatible ? '✅' : '❌'}`);
            console.log(`   Bytes Remaining: ${this.ASTROCAST_LIMIT - compressedSize}`);
            console.log(`   Fields Included: ${Object.keys(minimalPayload).length}/${Object.keys(sensorData).length}`);
            
            return {
                success: true,
                compressedData: cborBuffer,
                originalSize,
                compressedSize,
                compressionRatio,
                astrocastCompatible,
                bytesRemaining: this.ASTROCAST_LIMIT - compressedSize,
                fieldsIncluded: Object.keys(minimalPayload).length,
                totalFields: Object.keys(sensorData).length
            };
            
        } catch (error) {
            console.error('❌ Extreme optimization failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Extract only essential fields
     */
    extractEssentialData(sensorData) {
        const essential = {};
        
        for (const field of this.essentialFields) {
            if (sensorData[field] !== undefined) {
                essential[field] = sensorData[field];
            }
        }
        
        return essential;
    }

    /**
     * Create minimal payload with extreme optimizations
     */
    createMinimalPayload(essentialData) {
        const minimal = {};
        
        for (const [key, value] of Object.entries(essentialData)) {
            const shortKey = this.keyMap[key] || key;
            minimal[shortKey] = this.extremeOptimizeValue(key, value);
        }
        
        return minimal;
    }

    /**
     * Extreme value optimization
     */
    extremeOptimizeValue(key, value) {
        switch (key) {
            case 'msisdn':
                // Keep only last 6 digits
                return value.replace(/^39/, '').slice(-6);
                
            case 'time':
                // Convert to compact format: YYMMDDHH
                const timeStr = value.replace(/[^0-9]/g, '');
                return timeStr.substring(0, 8);
                
            case 'latitude':
            case 'longitude':
                // Reduce to 2 decimal places
                const coord = parseFloat(value);
                return Math.round(coord * 100) / 100;
                
            case 'temperature':
            case 'humidity':
                // Convert to integer
                return Math.round(parseFloat(value));
                
            case 'bat-soc':
                // Keep as integer
                return parseInt(value) || 0;
                
            case 'door':
                // Keep as single character
                return value.charAt(0);
                
            default:
                return value;
        }
    }

    /**
     * Decompress extreme optimized data
     */
    extremeDecompress(compressedBuffer) {
        try {
            console.log('🔄 Extreme Decompression Starting...');
            
            // Step 1: CBOR decode
            const compressedData = cbor.decode(compressedBuffer);
            
            // Step 2: Reconstruct with defaults
            const reconstructed = this.extremeReconstruct(compressedData);
            
            console.log('✅ Extreme decompression completed');
            
            return {
                success: true,
                decompressedData: reconstructed,
                originalCompressedSize: compressedBuffer.length
            };
            
        } catch (error) {
            console.error('❌ Extreme decompression failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Reconstruct with reasonable defaults
     */
    extremeReconstruct(compressedData) {
        const reconstructed = {};
        
        for (const [shortKey, value] of Object.entries(compressedData)) {
            const originalKey = this.reverseKeyMap[shortKey] || shortKey;
            reconstructed[originalKey] = this.extremeReconstructValue(originalKey, value);
        }
        
        return reconstructed;
    }

    /**
     * Reconstruct values with defaults
     */
    extremeReconstructValue(key, value) {
        switch (key) {
            case 'msisdn':
                // Restore country code
                return `39${value}`;
                
            case 'time':
                // Restore time format
                const timeStr = value.toString();
                if (timeStr.length >= 8) {
                    return `${timeStr.substring(0, 6)} ${timeStr.substring(6, 8)}00.0`;
                }
                return value;
                
            case 'latitude':
            case 'longitude':
                // Restore float format
                return parseFloat(value).toFixed(4);
                
            case 'temperature':
            case 'humidity':
                // Restore float format
                return parseFloat(value).toFixed(2);
                
            case 'bat-soc':
                // Convert back to string
                return value.toString();
                
            case 'door':
                // Restore door status
                return value.toUpperCase();
                
            default:
                return value;
        }
    }

    /**
     * Test with sample data
     */
    testExtremeOptimization(sampleData) {
        console.log('🧪 Extreme Astrocast Test');
        console.log('=========================');
        console.log('Essential fields only:', this.essentialFields.join(', '));
        console.log('');
        
        const result = this.extremeOptimize(sampleData);
        
        if (result.success) {
            console.log('\n📋 Extreme Optimization Report:');
            console.log('===============================');
            console.log(`Payload Size: ${result.compressedSize}/${this.ASTROCAST_LIMIT} bytes`);
            console.log(`Compatible: ${result.astrocastCompatible ? '✅ YES' : '❌ NO'}`);
            console.log(`Compression: ${result.compressionRatio}%`);
            console.log(`Bytes Remaining: ${result.bytesRemaining}`);
            console.log(`Fields: ${result.fieldsIncluded}/${result.totalFields}`);
            
            // Test decompression
            const decompressResult = this.extremeDecompress(result.compressedData);
            if (decompressResult.success) {
                console.log('\n🔄 Decompression Test:');
                console.log('Essential Original:', JSON.stringify(this.extractEssentialData(sampleData)));
                console.log('Decompressed:', JSON.stringify(decompressResult.decompressedData));
            }
            
            if (result.astrocastCompatible) {
                console.log('\n🎉 SUCCESS: Ready for Astrocast!');
                console.log('Pipeline: ESP32 → Astrocast → Slave → Mobius');
            } else {
                console.log('\n⚠️  Still needs optimization');
            }
        }
        
        return result;
    }
}

module.exports = ExtremeAstrocastCBOR; 
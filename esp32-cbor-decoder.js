/**
 * ESP32 CBOR Decoder Gateway for Hybrid TN/NTN IoT Pipeline
 * 
 * This microservice decodes CBOR payloads from ESP32 devices,
 * applies de-quantization, enriches with metadata, and forwards to Mobius (oneM2M)
 */

const express = require('express');
const cbor = require('cbor');
const axios = require('axios');
const cors = require('cors');

class ESP32CBORDecoder {
    constructor() {
        // Field ID mappings (matching encoder)
        this.fieldMapping = {
            0: 'msisdn',
            1: 'iso6346',
            2: 'time',
            3: 'rssi',
            4: 'cgi',
            5: 'bat-soc',
            6: 'acc',
            7: 'temperature',
            8: 'humidity',
            9: 'pressure',
            10: 'door',
            11: 'latitude',
            12: 'longitude',
            13: 'altitude',
            14: 'speed',
            15: 'heading'
            // Removed: ble-m, gnss, nsat, hdop for space
        };
        
        // Quantization factors (matching encoder)
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
        
        // CBOR version and codec support
        this.supportedVersions = [0x01];
        this.supportedCodecs = [0x01];
    }
    
    /**
     * De-quantize numeric values
     */
    dequantizeValue(fieldName, quantizedValue) {
        const factor = this.quantizationFactors[fieldName];
        if (factor) {
            return quantizedValue / factor;
        }
        return quantizedValue;
    }
    
    /**
     * Reconstruct MSISDN from optimized value
     */
    reconstructMSISDN(optimizedValue) {
        if (typeof optimizedValue === 'number') {
            // Handle 4-digit format (more aggressive encoding)
            const lastDigits = String(optimizedValue).padStart(4, '0');
            return `39331553${lastDigits}`; // Reconstruct with common prefix
        }
        return optimizedValue;
    }
    
    /**
     * Reconstruct time from optimized value
     */
    reconstructTime(optimizedValue) {
        const timeStr = optimizedValue.toString().padStart(8, '0');
        // Convert "20042300" back to "200423 002014.0" format
        const date = timeStr.substring(0, 6); // YYMMDD
        const hour = timeStr.substring(6, 8); // HH
        return `${date} ${hour}0014.0`; // Approximate reconstruction
    }
    
    /**
     * Reconstruct CGI from array components
     */
    reconstructCGI(cgiArray) {
        if (Array.isArray(cgiArray) && cgiArray.length === 4) {
            const [mcc, mnc, lac, cellid] = cgiArray;
            // Convert cellid back to hex
            const cellidHex = cellid.toString(16).toUpperCase();
            return `${mcc}-${mnc.toString().padStart(2, '0')}-${lac}-${cellidHex}`;
        }
        return cgiArray; // Return as-is if not array
    }
    
    /**
     * Reconstruct accelerometer data from quantized array
     */
    reconstructAccelerometer(accArray) {
        if (Array.isArray(accArray) && accArray.length === 3) {
            const [x, y, z] = accArray;
            // Use dequantizeValue for proper dequantization
            const x_val = this.dequantizeValue('acc', x).toFixed(4);
            const y_val = this.dequantizeValue('acc', y).toFixed(4);
            const z_val = this.dequantizeValue('acc', z).toFixed(4);
            return `${x_val} ${y_val} ${z_val}`;
        }
        return accArray;
    }
    
    /**
     * Decode CBOR payload from ESP32
     */
    decodeCBORPayload(cborBuffer) {
        try {
            console.log('🔄 Decoding ESP32 CBOR payload...');
            
            // Decode CBOR
            const decoded = cbor.decode(cborBuffer);
            
            if (!decoded || typeof decoded !== 'object') {
                throw new Error('Invalid CBOR payload structure');
            }
            
            console.log('🔍 Decoded CBOR structure:', Object.keys(decoded));
            
            // Check version and codec compatibility
            const version = decoded[0xFF]; // Version field (0xFF)
            const codec = decoded[0xFE];   // Codec field (0xFE)
            
            console.log('📋 Version:', version, 'Codec:', codec);
            
            if (!this.supportedVersions.includes(version)) {
                throw new Error(`Unsupported CBOR version: ${version}`);
            }
            
            if (!this.supportedCodecs.includes(codec)) {
                throw new Error(`Unsupported codec: ${codec}`);
            }
            
            // Map field IDs to human-readable names and de-quantize
            const decodedData = {};
            
            for (const [fieldId, value] of Object.entries(decoded)) {
                const fieldName = this.fieldMapping[parseInt(fieldId)];
                
                if (fieldName) {
                    let processedValue = value;
                    
                    // Apply field-specific processing
                    switch (fieldName) {
                        case 'msisdn':
                            processedValue = this.reconstructMSISDN(value);
                            break;
                            
                        case 'time':
                            processedValue = this.reconstructTime(value);
                            break;
                            
                        case 'cgi':
                            processedValue = this.reconstructCGI(value);
                            break;
                            
                        case 'acc':
                            processedValue = this.reconstructAccelerometer(value);
                            break;
                            
                        case 'temperature':
                        case 'humidity':
                        case 'pressure':
                        case 'altitude':
                        case 'speed':
                        case 'heading':
                        case 'latitude':
                        case 'longitude':
                        case 'hdop':
                            processedValue = this.dequantizeValue(fieldName, value);
                            break;
                    }
                    
                    decodedData[fieldName] = processedValue;
                }
            }
            
            console.log('✅ CBOR decoding successful');
            console.log('📊 Decoded fields:', Object.keys(decodedData));
            return decodedData;
            
        } catch (error) {
            console.error('❌ CBOR decoding failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Enrich decoded data with metadata
     */
    enrichData(decodedData, metadata = {}) {
        const enrichedData = {
            ...decodedData,
            // Add metadata
            deviceId: metadata.deviceId || 'ESP32_MARITIME_001',
            networkType: metadata.networkType || 'astrocast',
            timestamp: metadata.timestamp || new Date().toISOString(),
            protocol: 'CBOR',
            version: '1.0',
            source: 'ESP32',
            // Add accelerometer as string if it's an object
            ...(decodedData.acc && typeof decodedData.acc === 'object' && {
                acc: `${decodedData.acc.x.toFixed(4)} ${decodedData.acc.y.toFixed(4)} ${decodedData.acc.z.toFixed(4)}`
            })
        };
        
        return enrichedData;
    }
    
    /**
     * Send enriched data to Mobius platform
     */
    async sendToMobius(enrichedData, mobiusConfig) {
        try {
            console.log('📤 Sending to Mobius platform...');
            
            // Send data directly as content instance with correct oneM2M headers
            const response = await axios.post(mobiusConfig.url, enrichedData, {
                headers: {
                    'Content-Type': 'application/json;ty=4',
                    'X-M2M-Ri': `maritime-${Date.now()}`,
                    'X-M2M-ORIGIN': mobiusConfig.origin || 'Natesh'
                },
                timeout: 10000
            });

            console.log('✅ Mobius transmission successful');
            console.log('📊 Response status:', response.status);
            return response.data;

        } catch (error) {
            console.error('❌ Mobius transmission failed:', error.message);
            if (error.response) {
                console.error('📋 Response status:', error.response.status);
                console.error('📋 Response data:', error.response.data);
            }
            throw error;
        }
    }
    
    /**
     * Process complete pipeline: decode → enrich → send to Mobius
     */
    async processPipeline(cborBuffer, metadata = {}, mobiusConfig = {}) {
        const startTime = Date.now();
        
        try {
            // Step 1: Decode CBOR
            const decodedData = this.decodeCBORPayload(cborBuffer);
            
            // Step 2: Enrich with metadata
            const enrichedData = this.enrichData(decodedData, metadata);
            
            // Step 3: Send to Mobius (if configured)
            let mobiusResult = null;
            if (mobiusConfig.url) {
                mobiusResult = await this.sendToMobius(enrichedData, mobiusConfig);
            }
            
            const processingTime = Date.now() - startTime;
            
            return {
                success: true,
                processingTime,
                decodedData,
                enrichedData,
                mobiusResult,
                stats: {
                    originalSize: cborBuffer.length,
                    decodedFields: Object.keys(decodedData).length,
                    totalFields: Object.keys(this.fieldMapping).length
                }
            };
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            return {
                success: false,
                error: error.message,
                processingTime
            };
        }
    }
}

// Express server setup
const app = express();
const decoder = new ESP32CBORDecoder();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api/esp32-cbor', express.raw({ type: 'application/octet-stream', limit: '1mb' }));

// Configuration
const PORT = process.env.PORT || 3001;  // Changed to 3001 for VM
const MOBIUS_URL = process.env.MOBIUS_URL || 'http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4';
const MOBIUS_ORIGIN = process.env.MOBIUS_ORIGIN || 'Natesh';

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ESP32 CBOR Decoder Gateway',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Main ESP32 CBOR processing endpoint
app.post('/api/esp32-cbor', async (req, res) => {
    try {
        console.log('📥 Received ESP32 CBOR payload');
        
        const cborBuffer = req.body;
        const metadata = {
            deviceId: req.headers['device-id'] || 'ESP32_MARITIME_001',
            networkType: req.headers['network-type'] || 'astrocast',
            timestamp: req.headers['timestamp'] || new Date().toISOString(),
            originalSize: req.headers['original-size']
        };
        
        const mobiusConfig = {
            url: MOBIUS_URL,
            origin: MOBIUS_ORIGIN
        };
        
        const result = await decoder.processPipeline(cborBuffer, metadata, mobiusConfig);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'ESP32 CBOR payload processed successfully',
                processingTime: result.processingTime,
                stats: result.stats,
                mobiusResult: result.mobiusResult
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                processingTime: result.processingTime
            });
        }
        
    } catch (error) {
        console.error('❌ ESP32 CBOR processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint with sample data
app.post('/api/test-esp32-cbor', async (req, res) => {
    try {
        console.log('🧪 Testing ESP32 CBOR decoder with sample data');
        
        // Create sample CBOR payload (this would normally come from ESP32)
        const sampleData = {
            0x01: 0x01, // Version
            0x02: 0x01, // Codec
            0: 3315537896, // MSISDN (optimized)
            1: "LMCU1231230", // ISO6346
            2: 20042300, // Time (optimized)
            3: 26, // RSSI
            4: [999, 1, 1, 0x31D41], // CGI array
            5: 0, // BLE-M
            6: 92, // Battery SOC
            7: [-1010040, -1464, -4394], // Accelerometer (quantized)
            8: 1700, // Temperature (quantized)
            9: 4400, // Humidity (quantized)
            10: 101250430, // Pressure (quantized)
            11: "D", // Door
            12: 1, // GNSS
            13: 3189, // Latitude (quantized)
            14: 2870, // Longitude (quantized)
            15: 3810, // Altitude (quantized)
            16: 273, // Speed (quantized)
            17: 12531, // Heading (quantized)
            18: 6, // NSAT
            19: 180 // HDOP (quantized)
        };
        
        const cborBuffer = cbor.encode(sampleData);
        
        const result = await decoder.processPipeline(cborBuffer, {
            deviceId: 'ESP32_TEST_001',
            networkType: 'test'
        });
        
        res.json({
            success: true,
            testResult: result,
            sampleCborSize: cborBuffer.length
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 ESP32 CBOR Decoder Gateway running on port ${PORT}`);
    console.log(`📡 Mobius URL: ${MOBIUS_URL}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📥 ESP32 CBOR endpoint: http://localhost:${PORT}/api/esp32-cbor`);
    console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test-esp32-cbor`);
});

module.exports = { ESP32CBORDecoder, app }; 
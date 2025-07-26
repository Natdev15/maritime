/**
 * ESP32 Encoder (Master Node) - Single Consolidated File
 * 
 * This file combines:
 * 1. CBOR encoding logic for ESP32 sensor data
 * 2. Express server to receive JSON and send CBOR to decoder
 * 3. Load testing capabilities
 */

const express = require('express');
const cbor = require('cbor');
const axios = require('axios');
const cors = require('cors');

class ESP32Encoder {
    constructor() {
        // Complete field ID mappings for CBOR encoding (ALL fields)
        this.fieldMapping = {
            'msisdn': 0, 'iso6346': 1, 'time': 2, 'rssi': 3, 'cgi': 4,
            'bat-soc': 5, 'acc': 6, 'temperature': 7, 'humidity': 8,
            'pressure': 9, 'door': 10, 'latitude': 11, 'longitude': 12,
            'altitude': 13, 'speed': 14, 'heading': 15,
            'ble-m': 16, 'gnss': 17, 'nsat': 18, 'hdop': 19
        };
        
        // Maximum quantization factors for extreme size optimization
        this.quantizationFactors = {
            temperature: 100, humidity: 100, pressure: 1000, acc: 100,
            latitude: 1000, longitude: 1000, altitude: 10, speed: 10, heading: 10,
            hdop: 10
        };
        
        this.CBOR_VERSION = 0x01;
        this.CBOR_CODEC_ID = 0x01;
        this.ASTROCAST_LIMIT = 160;
        
        // Decoder URL (VM)
        this.decoderUrl = process.env.DECODER_URL || 'http://172.25.1.78:3001';
    }

    /**
     * Quantize numeric values for maximum size reduction
     */
    quantizeValue(fieldName, value) {
        const factor = this.quantizationFactors[fieldName];
        if (factor && typeof value === 'number') {
            return Math.round(value * factor);
        }
        return value;
    }

    /**
     * Extreme MSISDN optimization (keep last 2 digits only)
     */
    optimizeMSISDN(msisdn) {
        if (typeof msisdn === 'string') {
            return parseInt(msisdn.slice(-2));
        }
        return msisdn;
    }

    /**
     * Extreme time optimization (YYYYMMDD only)
     */
    optimizeTime(timeStr) {
        if (typeof timeStr === 'string') {
            const digits = timeStr.replace(/[^0-9]/g, '');
            return parseInt(digits.substring(0, 8));
        }
        return timeStr;
    }

    /**
     * Parse CGI string into compact array
     */
    parseCGI(cgiStr) {
        if (typeof cgiStr === 'string') {
            const parts = cgiStr.split('-');
            if (parts.length === 4) {
                return [
                    parseInt(parts[0]), // MCC
                    parseInt(parts[1]), // MNC
                    parseInt(parts[2]), // LAC
                    parseInt(parts[3], 16) % 1000 // Cell ID (modulo for smaller numbers)
                ];
            }
        }
        return cgiStr;
    }

    /**
     * Parse accelerometer string into highly quantized array
     */
    parseAccelerometer(accStr) {
        if (typeof accStr === 'string') {
            const parts = accStr.split(' ');
            if (parts.length === 3) {
                return [
                    Math.round(parseFloat(parts[0]) * 100), // X (factor 100)
                    Math.round(parseFloat(parts[1]) * 100), // Y (factor 100)
                    Math.round(parseFloat(parts[2]) * 100)  // Z (factor 100)
                ];
            }
        }
        return accStr;
    }

    /**
     * Encode sensor data to CBOR with maximum optimization (no size limit)
     */
    encodeSensorData(sensorData) {
        try {
            // Define field priority (most critical first)
            const fieldPriority = [
                'msisdn', 'iso6346', 'time', 'latitude', 'longitude', 'temperature',
                'humidity', 'pressure', 'bat-soc', 'rssi', 'cgi', 'acc',
                'speed', 'heading', 'altitude', 'door', 'gnss', 'nsat', 'ble-m', 'hdop'
            ];
            
            // Encode with all fields (no size limit)
            let encodedData = this.createEncodedData(sensorData, fieldPriority);
            let cborBuffer = cbor.encode(encodedData);
            
            const originalSize = JSON.stringify(sensorData).length;
            const compressionRatio = ((originalSize - cborBuffer.length) / originalSize) * 100;
            
            return {
                success: true,
                cborBuffer,
                size: cborBuffer.length,
                compressionRatio,
                originalSize
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create encoded data with all fields
     */
    createEncodedData(sensorData, fieldPriority) {
        const encodedData = {};
        
        // Add version and codec identifiers
        encodedData[0xFF] = this.CBOR_VERSION;
        encodedData[0xFE] = this.CBOR_CODEC_ID;
        
        // Encode each field with maximum optimization
        for (const fieldName of fieldPriority) {
            const fieldId = this.fieldMapping[fieldName];
            const value = sensorData[fieldName];
            
            if (value !== undefined) {
                let encodedValue = value;
                
                // Apply field-specific optimizations
                switch (fieldName) {
                    case 'msisdn':
                        encodedValue = this.optimizeMSISDN(value);
                        break;
                    case 'time':
                        encodedValue = this.optimizeTime(value);
                        break;
                    case 'cgi':
                        encodedValue = this.parseCGI(value);
                        break;
                    case 'acc':
                        encodedValue = this.parseAccelerometer(value);
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
                        encodedValue = this.quantizeValue(fieldName, value);
                        break;
                    case 'rssi':
                    case 'bat-soc':
                        encodedValue = parseInt(value);
                        break;
                    case 'ble-m':
                    case 'gnss':
                    case 'nsat':
                        encodedValue = parseInt(value);
                        break;
                    case 'door':
                        encodedValue = value;
                        break;
                }
                
                encodedData[fieldId] = encodedValue;
            }
        }
        
        return encodedData;
    }

    /**
     * Create extremely optimized encoded data (minimal fields only)
     */
    createExtremeEncodedData(sensorData) {
        const encodedData = {};
        
        // Add version and codec identifiers
        encodedData[0xFF] = this.CBOR_VERSION;
        encodedData[0xFE] = this.CBOR_CODEC_ID;
        
        // Include more fields to match Postman payload structure
        const criticalFields = [
            'msisdn', 'iso6346', 'time', 'latitude', 'longitude', 'temperature', 
            'humidity', 'pressure', 'bat-soc', 'rssi', 'cgi', 'acc',
            'speed', 'heading', 'altitude', 'door', 'gnss', 'nsat', 'ble-m', 'hdop'
        ];
        
        for (const fieldName of criticalFields) {
            const fieldId = this.fieldMapping[fieldName];
            const value = sensorData[fieldName];
            
            if (value !== undefined) {
                let encodedValue = value;
                
                // Apply extreme optimizations
                switch (fieldName) {
                    case 'msisdn':
                        encodedValue = this.optimizeMSISDN(value);
                        break;
                    case 'time':
                        encodedValue = this.optimizeTime(value);
                        break;
                    case 'temperature':
                    case 'humidity':
                        encodedValue = Math.round(parseFloat(value) * 100);
                        break;
                    case 'pressure':
                        encodedValue = Math.round(parseFloat(value) * 1000);
                        break;
                    case 'latitude':
                    case 'longitude':
                        encodedValue = Math.round(parseFloat(value) * 1000);
                        break;
                    case 'altitude':
                    case 'speed':
                    case 'heading':
                    case 'hdop':
                        encodedValue = Math.round(parseFloat(value) * 10);
                        break;
                    case 'acc':
                        encodedValue = this.parseAccelerometer(value);
                        break;
                    case 'cgi':
                        encodedValue = this.parseCGI(value);
                        break;
                    case 'bat-soc':
                    case 'rssi':
                    case 'ble-m':
                    case 'gnss':
                    case 'nsat':
                        encodedValue = parseInt(value);
                        break;
                    case 'door':
                        encodedValue = value;
                        break;
                }
                
                encodedData[fieldId] = encodedValue;
            }
        }
        
        return encodedData;
    }

    /**
     * Send CBOR payload to decoder
     */
    async sendToDecoder(cborBuffer, metadata = {}) {
        try {
            const response = await axios.post(`${this.decoderUrl}/api/esp32-cbor`, cborBuffer, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'device-id': metadata.deviceId || 'ESP32_ENCODER',
                    'network-type': metadata.networkType || 'astrocast',
                    'timestamp': metadata.timestamp || new Date().toISOString()
                },
                timeout: 10000
            });
            
            return {
                success: true,
                response: response.data
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process complete pipeline: JSON → CBOR → Decoder
     */
    async processPipeline(sensorData, metadata = {}) {
        const startTime = Date.now();
        
        try {
            // Step 1: Encode to CBOR
            const encodeResult = this.encodeSensorData(sensorData);
            if (!encodeResult.success) {
                return {
                    success: false,
                    error: encodeResult.error,
                    processingTime: Date.now() - startTime,
                    encodeResult
                };
            }
            
            // Step 2: Send to decoder
            const decoderResult = await this.sendToDecoder(encodeResult.cborBuffer, metadata);
            if (!decoderResult.success) {
                return {
                    success: false,
                    error: `Decoder transmission failed: ${decoderResult.error}`,
                    processingTime: Date.now() - startTime,
                    encodeResult
                };
            }
            
            const processingTime = Date.now() - startTime;
            
            return {
                success: true,
                processingTime,
                encodeResult,
                decoderResult,
                stats: {
                    originalSize: encodeResult.originalSize,
                    encodedSize: encodeResult.size,
                    compressionRatio: encodeResult.compressionRatio
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

    /**
     * Generate sample sensor data with ALL fields
     */
    generateExampleData() {
        const now = new Date();
        const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.0`;
        
        return {
            msisdn: "393315537896",
            iso6346: "LMCU1231230",
            time: timeStr,
            rssi: "26",
            cgi: "999-01-1-31D41",
            "ble-m": "0",
            "bat-soc": "92",
            acc: "-1010.0407 -1.4649 -4.3947",
            temperature: "17.00",
            humidity: "44.00",
            pressure: "1012.5043",
            door: "D",
            gnss: "1",
            latitude: "31.8910",
            longitude: "28.7041",
            altitude: "38.10",
            speed: "27.3",
            heading: "125.31",
            nsat: "06",
            hdop: "1.8"
        };
    }
}

// Express server setup
const app = express();
const encoder = new ESP32Encoder();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Configuration
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ESP32 Encoder (Master Node)',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        decoderUrl: encoder.decoderUrl
    });
});

// Main encoding endpoint
app.post('/api/encode', async (req, res) => {
    try {
        console.log('📥 Received JSON payload for encoding');
        
        const sensorData = req.body;
        const metadata = {
            deviceId: req.headers['device-id'] || 'ESP32_ENCODER',
            networkType: req.headers['network-type'] || 'astrocast',
            timestamp: req.headers['timestamp'] || new Date().toISOString()
        };
        
        const result = await encoder.processPipeline(sensorData, metadata);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'JSON payload encoded and sent to decoder successfully',
                processingTime: result.processingTime,
                stats: result.stats,
                decoderResponse: result.decoderResult.response
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                processingTime: result.processingTime
            });
        }
        
    } catch (error) {
        console.error('❌ Encoding error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint
app.post('/api/test', async (req, res) => {
    try {
        console.log('🧪 Testing encoder with sample data');
        
        const sampleData = encoder.generateExampleData();
        const result = await encoder.processPipeline(sampleData, {
            deviceId: 'ESP32_TEST',
            networkType: 'test'
        });
        
        res.json({
            success: true,
            testResult: result,
            sampleData
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
    console.log(`🚀 ESP32 Encoder (Master Node) running on port ${PORT}`);
    console.log(`📡 Decoder URL: ${encoder.decoderUrl}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📥 Encode endpoint: http://localhost:${PORT}/api/encode`);
    console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
});

module.exports = { ESP32Encoder, app }; 
/**
 * ESP32 CBOR Decoder (Slave Node)
 * 
 * Decodes CBOR payloads from ESP32 devices and forwards to Mobius platform
 */

const express = require('express');
const cbor = require('cbor');
const axios = require('axios');
const cors = require('cors');

class ESP32CBORDecoder {
    constructor() {
        // Complete field ID mappings for CBOR decoding (ALL fields)
        this.fieldMapping = {
            0: 'msisdn', 1: 'iso6346', 2: 'time', 3: 'rssi', 4: 'cgi',
            5: 'bat-soc', 6: 'acc', 7: 'temperature', 8: 'humidity',
            9: 'pressure', 10: 'door', 11: 'latitude', 12: 'longitude',
            13: 'altitude', 14: 'speed', 15: 'heading',
            16: 'ble-m', 17: 'gnss', 18: 'nsat', 19: 'hdop'
        };
        
        // Maximum quantization factors (matching encoder)
        this.quantizationFactors = {
            temperature: 100, humidity: 100, pressure: 1000, acc: 100,
            latitude: 1000, longitude: 1000, altitude: 10, speed: 10, heading: 10,
            hdop: 10
        };
        
        // Mobius configuration
        this.mobiusUrl = process.env.MOBIUS_URL || 'http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4';
        this.mobiusOrigin = process.env.MOBIUS_ORIGIN || 'Natesh';
    }

    /**
     * De-quantize numeric values
     */
    dequantizeValue(fieldName, value) {
        const factor = this.quantizationFactors[fieldName];
        if (factor && typeof value === 'number') {
            return value / factor;
        }
        return value;
    }

    /**
     * Reconstruct MSISDN from optimized format
     */
    reconstructMSISDN(optimizedValue) {
        if (typeof optimizedValue === 'number') {
            // Add back the "39" prefix and pad to full length
            return `393315537${String(optimizedValue).padStart(2, '0')}`;
        }
        return optimizedValue;
    }

    /**
     * Reconstruct time from optimized format
     */
    reconstructTime(optimizedValue) {
        if (typeof optimizedValue === 'number') {
            const timeStr = String(optimizedValue);
            const year = timeStr.substring(0, 4);
            const month = timeStr.substring(4, 6);
            const day = timeStr.substring(6, 8);
            return `${year}${month}${day} 000000.0`;
        }
        return optimizedValue;
    }

    /**
     * Reconstruct CGI from array format
     */
    reconstructCGI(cgiArray) {
        if (Array.isArray(cgiArray) && cgiArray.length === 4) {
            const [mcc, mnc, lac, cellId] = cgiArray;
            return `${mcc}-${mnc}-${lac}-${cellId.toString(16).toUpperCase()}`;
        }
        return cgiArray;
    }

    /**
     * Reconstruct accelerometer from quantized array
     */
    reconstructAccelerometer(accArray) {
        if (Array.isArray(accArray) && accArray.length === 3) {
            const [x, y, z] = accArray;
            return `${(x / 100).toFixed(4)} ${(y / 100).toFixed(4)} ${(z / 100).toFixed(4)}`;
        }
        return accArray;
    }

    /**
     * Decode CBOR payload to JSON
     */
    decodeCBORPayload(cborBuffer) {
        try {
            // Decode CBOR
            const decodedData = cbor.decode(cborBuffer);
            
            // Extract version and codec
            const version = decodedData[0xFF];
            const codec = decodedData[0xFE];
            
            console.log('📋 Version:', version);
            console.log('📋 Codec:', codec);
            
            // Reconstruct original data
            const reconstructedData = {};
            
            for (const [fieldId, fieldName] of Object.entries(this.fieldMapping)) {
                const value = decodedData[fieldId];
                
                if (value !== undefined) {
                    let reconstructedValue = value;
                    
                    // Apply field-specific reconstruction
                    switch (fieldName) {
                        case 'msisdn':
                            reconstructedValue = this.reconstructMSISDN(value);
                            break;
                        case 'time':
                            reconstructedValue = this.reconstructTime(value);
                            break;
                        case 'cgi':
                            reconstructedValue = this.reconstructCGI(value);
                            break;
                        case 'acc':
                            reconstructedValue = this.reconstructAccelerometer(value);
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
                            reconstructedValue = this.dequantizeValue(fieldName, value);
                            break;
                        case 'rssi':
                        case 'bat-soc':
                        case 'ble-m':
                        case 'gnss':
                        case 'nsat':
                            reconstructedValue = String(value);
                            break;
                        case 'door':
                            reconstructedValue = String(value);
                            break;
                    }
                    
                    reconstructedData[fieldName] = reconstructedValue;
                }
            }
            
            return {
                success: true,
                decodedData: reconstructedData,
                version,
                codec,
                decodedFields: Object.keys(reconstructedData).length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send data to Mobius platform
     */
    async sendToMobius(enrichedData, mobiusConfig) {
        try {
            console.log('📤 Sending to Mobius platform...');
            const payload = {
                "m2m:cin": {
                    "con": enrichedData
                }
            };
            const response = await axios.post(mobiusConfig.url, payload, {
                headers: {
                    'Content-Type': 'application/json;ty=4',
                    'X-M2M-RI': `maritime_${Date.now()}`,
                    'X-M2M-Origin': 'Natesh',
                    'Accept': 'application/json'
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
     * Process complete pipeline: CBOR → JSON → Mobius
     */
    async processPipeline(cborBuffer, metadata = {}, mobiusConfig = {}) {
        const startTime = Date.now();
        
        try {
            // Step 1: Decode CBOR
            const decodeResult = this.decodeCBORPayload(cborBuffer);
            if (!decodeResult.success) {
                throw new Error(`Decoding failed: ${decodeResult.error}`);
            }
            
            // Step 2: Enrich data with metadata
            const enrichedData = {
                ...decodeResult.decodedData,
                deviceId: metadata.deviceId || 'ESP32_UNKNOWN',
                networkType: metadata.networkType || 'TN/NTN',
                timestamp: metadata.timestamp || new Date().toISOString(),
                protocol: 'CBOR',
                version: '1.0',
                source: 'ESP32'
            };
            
            // Step 3: Send to Mobius
            const mobiusResult = await this.sendToMobius(enrichedData, {
                url: mobiusConfig.url || this.mobiusUrl,
                origin: mobiusConfig.origin || this.mobiusOrigin
            });
            
            const processingTime = Date.now() - startTime;
            
            return {
                success: true,
                processingTime,
                decodeResult,
                enrichedData,
                mobiusResult,
                stats: {
                    decodedFields: decodeResult.decodedFields,
                    totalFields: Object.keys(enrichedData).length
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

// In-memory retry queue for failed Mobius transmissions
const retryQueue = [];
const RETRY_INTERVAL_MS = 15000; // 15 seconds

// Retry worker
async function retryWorker() {
    if (retryQueue.length === 0) return;
    console.log(`🔄 Retrying ${retryQueue.length} queued Mobius transmissions...`);
    for (let i = 0; i < retryQueue.length; i++) {
        const { enrichedData, mobiusConfig } = retryQueue[i];
        try {
            await decoder.sendToMobius(enrichedData, mobiusConfig);
            console.log('✅ Queued Mobius transmission successful');
            retryQueue.splice(i, 1); // Remove from queue
            i--;
        } catch (err) {
            console.log('❌ Queued Mobius transmission failed, will retry.');
        }
    }
}
setInterval(retryWorker, RETRY_INTERVAL_MS);

// Middleware
app.use(cors());
app.use(express.raw({ type: 'application/octet-stream', limit: '1mb' }));

// Configuration
const PORT = process.env.PORT || 3001;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ESP32 CBOR Decoder (Slave Node)',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        mobiusUrl: decoder.mobiusUrl,
        retryQueueLength: retryQueue.length
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 ESP32 CBOR Decoder (Slave Node) running on port ${PORT}`);
});

// Main CBOR decoding endpoint
app.post('/api/esp32-cbor', async (req, res) => {
    try {
        console.log('📥 Received ESP32 CBOR payload');
        const cborBuffer = req.body;
        // Log compressed CBOR payload size
        if (cborBuffer && cborBuffer.length !== undefined) {
            console.log(`📦 Compressed data size: ${cborBuffer.length} bytes`);
        }

        const metadata = {
            deviceId: req.headers['device-id'] || 'ESP32_UNKNOWN',
            networkType: req.headers['network-type'] || 'astrocast',
            timestamp: req.headers['timestamp'] || new Date().toISOString()
        };

        const result = await decoder.processPipeline(cborBuffer, metadata);

        if (result.success) {
            // Mobius acknowledgment logging
            if (result.mobiusResult) {
                const mobiusAck = JSON.stringify(result.mobiusResult);
                console.log(`📥 Mobius acknowledgment size: ${Buffer.byteLength(mobiusAck)} bytes`);
            }
            if (result.mobiusResult && result.mobiusResult['m2m:cin']) {
                // Try to log HTTP status if available (may need to adjust based on Mobius response)
                if (result.mobiusResult.status) {
                    console.log(`🔔 Mobius HTTP status: ${result.mobiusResult.status}`);
                } else {
                    console.log('🔔 Mobius HTTP status: (see response headers/logs)');
                }
            }
            res.json({
                success: true,
                message: 'CBOR payload decoded and sent to Mobius successfully',
                processingTime: result.processingTime,
                stats: result.stats,
                mobiusResponse: result.mobiusResult
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                processingTime: result.processingTime
            });
        }
    } catch (error) {
        console.error('❌ Decoding error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

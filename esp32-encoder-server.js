/**
 * ESP32 Encoder Server
 * Runs on local machine to generate CBOR payloads and send to VM decoder
 */

const express = require('express');
const { ESP32JSCBOREncoder } = require('./esp32-js-encoder.js');
const axios = require('axios');

class ESP32EncoderServer {
    constructor() {
        this.app = express();
        this.encoder = new ESP32JSCBOREncoder();
        this.decoderUrl = process.env.DECODER_URL || 'http://172.25.1.78:3001';
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '1mb' }));
        this.app.use(express.raw({ type: 'application/octet-stream', limit: '1mb' }));
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'ESP32-Encoder',
                timestamp: new Date().toISOString(),
                decoderUrl: this.decoderUrl
            });
        });

        // Generate and send single payload
        this.app.post('/api/generate-and-send', async (req, res) => {
            try {
                const sensorData = req.body;
                console.log('📤 Generating and sending payload...');
                
                // Encode to CBOR
                const encodeResult = this.encoder.encodeSensorData(sensorData);
                if (!encodeResult.success) {
                    return res.status(400).json({
                        error: 'Encoding failed',
                        details: encodeResult.error
                    });
                }

                // Send to VM decoder
                const response = await axios.post(`${this.decoderUrl}/api/esp32-cbor`, encodeResult.cborBuffer, {
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    },
                    timeout: 10000
                });

                res.json({
                    success: true,
                    message: 'Payload sent successfully',
                    encodedSize: encodeResult.size,
                    compressionRatio: encodeResult.compressionRatio,
                    decoderResponse: response.data
                });

            } catch (error) {
                console.error('❌ Send failed:', error.message);
                res.status(500).json({
                    error: 'Send failed',
                    details: error.message
                });
            }
        });

        // Generate CBOR only (for testing)
        this.app.post('/api/generate', (req, res) => {
            try {
                const sensorData = req.body;
                console.log('🔄 Generating CBOR payload...');
                
                const result = this.encoder.encodeSensorData(sensorData);
                
                if (result.success) {
                    res.json({
                        success: true,
                        cborSize: result.size,
                        compressionRatio: result.compressionRatio,
                        astrocastCompatible: result.size <= 160
                    });
                } else {
                    res.status(400).json({
                        error: 'Encoding failed',
                        details: result.error
                    });
                }

            } catch (error) {
                console.error('❌ Generation failed:', error.message);
                res.status(500).json({
                    error: 'Generation failed',
                    details: error.message
                });
            }
        });

        // Bulk test endpoint
        this.app.post('/api/bulk-test', async (req, res) => {
            try {
                const { count = 10, delay = 100 } = req.body;
                console.log(`🚀 Starting bulk test: ${count} payloads`);
                
                const results = [];
                let successCount = 0;
                let failureCount = 0;

                for (let i = 1; i <= count; i++) {
                    try {
                        const sensorData = this.encoder.generateRandomSensorData();
                        const encodeResult = this.encoder.encodeSensorData(sensorData);
                        
                        if (!encodeResult.success) {
                            throw new Error(`Encoding failed: ${encodeResult.error}`);
                        }

                        const response = await axios.post(`${this.decoderUrl}/api/esp32-cbor`, encodeResult.cborBuffer, {
                            headers: {
                                'Content-Type': 'application/octet-stream'
                            },
                            timeout: 10000
                        });

                        results.push({
                            payloadId: i,
                            success: true,
                            encodedSize: encodeResult.size,
                            compressionRatio: encodeResult.compressionRatio
                        });
                        
                        successCount++;

                        if (i < count && delay > 0) {
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }

                    } catch (error) {
                        results.push({
                            payloadId: i,
                            success: false,
                            error: error.message
                        });
                        failureCount++;
                    }
                }

                res.json({
                    success: true,
                    totalPayloads: count,
                    successCount,
                    failureCount,
                    successRate: ((successCount / count) * 100).toFixed(1) + '%',
                    results
                });

            } catch (error) {
                console.error('❌ Bulk test failed:', error.message);
                res.status(500).json({
                    error: 'Bulk test failed',
                    details: error.message
                });
            }
        });

        // Generate random sensor data
        this.app.get('/api/random-data', (req, res) => {
            const randomData = this.encoder.generateRandomSensorData();
            res.json(randomData);
        });
    }

    start(port = 3000) {
        this.app.listen(port, () => {
            console.log(`🚀 ESP32 Encoder Server running on port ${port}`);
            console.log(`📡 Decoder URL: ${this.decoderUrl}`);
            console.log(`🔗 Health check: http://localhost:${port}/health`);
        });
    }
}

// Export for use
module.exports = { ESP32EncoderServer };

// Start server if run directly
if (require.main === module) {
    const server = new ESP32EncoderServer();
    const port = process.env.PORT || 3000;
    server.start(port);
} 
const express = require('express');
const axios = require('axios');
const ExtremeAstrocastCBOR = require('./extreme-astrocast-cbor');

const app = express();

// Environment configuration
const NODE_MODE = process.env.NODE_MODE || 'master';
const PORT = NODE_MODE === 'master' ? 3000 : 3001;
const MOBIUS_URL = process.env.MOBIUS_URL || 'http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4';
const SLAVE_URL = process.env.SLAVE_URL || 'http://172.25.1.78:3001/api/receive-compressed';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use('/api/receive-compressed', express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Initialize Astrocast CBOR service
const astrocastService = new ExtremeAstrocastCBOR();

// Master Node Handler
class AstrocastMasterHandler {
    
    async compressForAstrocast(sensorData) {
        try {
            console.log('🛰️  Master: Compressing for Astrocast...');
            
            const result = astrocastService.extremeOptimize(sensorData);
            
            if (!result.success) {
                throw new Error(`Astrocast compression failed: ${result.error}`);
            }
            
            console.log(`✅ Master: Astrocast compression successful (${result.compressedSize}/${astrocastService.ASTROCAST_LIMIT} bytes)`);
            
            return {
                compressedData: result.compressedData,
                optimizationReport: {
                    originalSize: result.originalSize,
                    compressedSize: result.compressedSize,
                    compressionRatio: result.compressionRatio,
                    astrocastCompatible: result.astrocastCompatible,
                    bytesRemaining: result.bytesRemaining,
                    fieldsIncluded: result.fieldsIncluded,
                    totalFields: result.totalFields
                }
            };
            
        } catch (error) {
            console.error('❌ Master: Astrocast compression failed:', error);
            throw error;
        }
    }
    
    async sendToSlave(compressedBuffer, metadata) {
        try {
            console.log('📤 Master: Sending to Slave node...');
            console.log('🎯 Slave URL:', SLAVE_URL);
            console.log('📊 Compressed size:', compressedBuffer.length, 'bytes');
            
            const response = await axios.post(SLAVE_URL, compressedBuffer, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Device-ID': metadata.deviceId || 'ESP32_MARITIME_001',
                    'Network-Type': metadata.networkType || 'astrocast',
                    'Compression-Type': 'astrocast-cbor',
                    'Original-Size': metadata.originalSize?.toString() || '378',
                    'Astrocast-Compatible': 'true'
                },
                timeout: 30000
            });
            
            console.log(`✅ Master: Slave Response: ${response.status} ${response.statusText}`);
            
            return {
                success: true,
                status: response.status,
                data: response.data
            };
            
        } catch (error) {
            console.error('❌ Master: Failed to send to Slave:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Slave Node Handler
class AstrocastSlaveHandler {
    
    async decompressFromAstrocast(compressedBuffer) {
        try {
            console.log('🔄 Slave: Decompressing Astrocast data...');
            
            const result = astrocastService.extremeDecompress(compressedBuffer);
            
            if (!result.success) {
                throw new Error(`Astrocast decompression failed: ${result.error}`);
            }
            
            console.log('✅ Slave: Astrocast decompression successful');
            
            return {
                decompressedData: result.decompressedData,
                originalCompressedSize: result.originalCompressedSize
            };
            
        } catch (error) {
            console.error('❌ Slave: Astrocast decompression failed:', error);
            throw error;
        }
    }
    
    async sendToMobius(sensorData, deviceId = 'ESP32_MARITIME_001') {
        try {
            console.log('📤 Slave: Sending to Mobius...');
            console.log('🎯 Mobius URL:', MOBIUS_URL);
            
            // Create oneM2M payload with proper structure (like http-client.js)
            const mobiusPayload = {
                "m2m:cin": {
                    "con": sensorData
                }
            };
            
            // Generate unique request ID (like http-client.js)
            const timestamp = Date.now();
            const requestId = `req-${timestamp}`;
            
            const response = await axios.post(MOBIUS_URL, mobiusPayload, {
                headers: {
                    'Content-Type': 'application/json;ty=4',
                    'X-M2M-RI': requestId,
                    'X-M2M-Origin': deviceId,
                    'Accept': 'application/json'
                },
                timeout: 30000
            });
            
            console.log(`✅ Slave: Mobius Response: ${response.status} ${response.statusText}`);
            
            // Handle different response statuses (like http-client.js)
            if (response.status >= 200 && response.status < 300) {
                console.log('✅ Slave: Successfully sent to Mobius');
            } else if (response.status === 409) {
                console.log('⚠️  Slave: Resource already exists (409) - treated as success');
            } else {
                console.log(`⚠️  Slave: Unexpected status: ${response.status}`);
            }
            
            return {
                success: true,
                status: response.status,
                data: response.data,
                requestId: requestId
            };
            
        } catch (error) {
            console.error('❌ Slave: Failed to send to Mobius:', error.message);
            
            // Handle specific error cases (like http-client.js)
            if (error.response?.status === 409) {
                console.log('✅ Slave: 409 Conflict - Resource already exists (treated as success)');
                return {
                    success: true,
                    status: 409,
                    error: 'Resource already exists',
                    alreadyExists: true
                };
            }
            
            return {
                success: false,
                error: error.message,
                status: error.response?.status || null
            };
        }
    }
}

// Initialize handlers
const masterHandler = new AstrocastMasterHandler();
const slaveHandler = new AstrocastSlaveHandler();

// Routes based on node mode
if (NODE_MODE === 'master') {
    // Master Node Routes
    app.post('/api/container', async (req, res) => {
        try {
            console.log('📨 Master: Received container data');
            
            const { con, metadata } = req.body;
            
            if (!con) {
                return res.status(400).json({ error: 'Missing con field' });
            }
            
            // Step 1: Compress for Astrocast
            const compressionResult = await masterHandler.compressForAstrocast(con);
            
            // Step 2: Send to Slave
            const slaveResult = await masterHandler.sendToSlave(
                compressionResult.compressedData,
                {
                    ...metadata,
                    originalSize: compressionResult.optimizationReport.originalSize
                }
            );
            
            if (!slaveResult.success) {
                return res.status(500).json({ 
                    error: 'Failed to send to Slave',
                    details: slaveResult.error
                });
            }
            
            res.json({
                success: true,
                message: 'Container processed successfully',
                optimization: compressionResult.optimizationReport,
                slaveResponse: slaveResult.data
            });
            
        } catch (error) {
            console.error('❌ Master: Error processing container:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
} else {
    // Slave Node Routes
    app.post('/api/receive-compressed', async (req, res) => {
        try {
            console.log('📨 Slave: Received compressed data');
            
            const compressedBuffer = req.body;
            const deviceId = req.headers['device-id'] || 'ESP32_MARITIME_001';
            const networkType = req.headers['network-type'] || 'astrocast';
            
            console.log('📊 Slave: Compressed data size:', compressedBuffer.length, 'bytes');
            console.log('📱 Slave: Device ID:', deviceId);
            console.log('🌐 Slave: Network Type:', networkType);
            
            // Step 1: Decompress Astrocast data
            const decompressionResult = await slaveHandler.decompressFromAstrocast(compressedBuffer);
            
            // Step 2: Send to Mobius
            const mobiusResult = await slaveHandler.sendToMobius(
                decompressionResult.decompressedData,
                deviceId
            );
            
            if (!mobiusResult.success) {
                return res.status(500).json({ 
                    error: 'Failed to send to Mobius',
                    details: mobiusResult.error
                });
            }
            
            res.json({
                success: true,
                message: 'Data processed and sent to Mobius',
                decompression: {
                    originalCompressedSize: decompressionResult.originalCompressedSize,
                    decompressedFields: Object.keys(decompressionResult.decompressedData).length
                },
                mobiusResponse: mobiusResult.data
            });
            
        } catch (error) {
            console.error('❌ Slave: Error processing compressed data:', error);
            res.status(500).json({ error: error.message });
        }
    });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        nodeType: NODE_MODE,
        timestamp: new Date().toISOString(),
        astrocastCompatible: true,
        compressionType: 'extreme-cbor',
        payloadLimit: astrocastService.ASTROCAST_LIMIT
    });
});

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        service: 'astrocast-maritime-server',
        mode: NODE_MODE,
        port: PORT,
        astrocastOptimization: true,
        essentialFields: astrocastService.essentialFields,
        pipeline: 'ESP32 → Astrocast → Slave → Mobius'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚢 Astrocast Maritime Server running in ${NODE_MODE} mode`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🛰️  Astrocast Compatible: ✅`);
    console.log(`🗜️  Compression: Extreme CBOR`);
    console.log(`📊 Payload Limit: ${astrocastService.ASTROCAST_LIMIT} bytes`);
    console.log(`🔧 Essential Fields: ${astrocastService.essentialFields.join(', ')}`);
    console.log(`🌐 Pipeline: ESP32 → Astrocast → Slave → Mobius`);
});

module.exports = app; 
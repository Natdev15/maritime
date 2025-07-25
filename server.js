const express = require('express');
const cbor = require('cbor');
const axios = require('axios');

const app = express();

// Environment configuration
const NODE_MODE = process.env.NODE_MODE || 'master'; // 'master' or 'slave'
const PORT = NODE_MODE === 'master' ? 3000 : 3001;
const MOBIUS_URL = process.env.MOBIUS_URL || 'http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4';
const SLAVE_URL = process.env.SLAVE_URL || 'http://localhost:3001/api/receive-compressed';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use('/api/receive-compressed', express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// CBOR Compression Handler for Master Node
class MasterCompressionHandler {
    
    compressMaritimePayload(conData) {
        try {
            // Compress the "con" payload with CBOR using optimized keys
            const optimizedPayload = {
                "ms": conData.msisdn,
                "iso": conData.iso6346,
                "t": conData.time,
                "rssi": parseInt(conData.rssi),
                "cgi": conData.cgi,
                "bl": parseInt(conData["ble-m"]),
                "ba": parseInt(conData["bat-soc"]),
                "a": conData.acc.split(' ').map(val => parseFloat(val)),
                "te": parseFloat(conData.temperature),
                "h": parseInt(conData.humidity),
                "p": parseFloat(conData.pressure),
                "d": conData.door,
                "g": parseInt(conData.gnss),
                "lat": parseFloat(conData.latitude),
                "lon": parseFloat(conData.longitude),
                "alt": parseFloat(conData.altitude),
                "s": parseFloat(conData.speed),
                "hd": parseFloat(conData.heading),
                "n": parseInt(conData.nsat),
                "hp": parseFloat(conData.hdop)
            };
            
            // CBOR encode the optimized payload
            const cborBuffer = cbor.encode(optimizedPayload);
            
            // Calculate compression metrics
            const originalSize = JSON.stringify(conData).length;
            const compressedSize = cborBuffer.length;
            const compressionRatio = Math.round(((originalSize - compressedSize) / originalSize) * 100);
            
            console.log(`🗜️  CBOR compression completed:`);
            console.log(`   Original size: ${originalSize} bytes`);
            console.log(`   Compressed size: ${compressedSize} bytes`);
            console.log(`   Compression ratio: ${compressionRatio}% saved`);
            
            return {
                compressedData: cborBuffer,
                originalSize,
                compressedSize,
                compressionRatio
            };
            
        } catch (error) {
            console.error('❌ CBOR compression failed:', error);
            throw new Error(`CBOR compression failed: ${error.message}`);
        }
    }
    
    async sendToSlave(compressedBuffer, metadata) {
        try {
            console.log('📤 Sending compressed data to Slave node...');
            console.log('🎯 Slave URL:', SLAVE_URL);
            console.log('📊 Compressed data size:', compressedBuffer.length, 'bytes');
            
            const response = await axios.post(SLAVE_URL, compressedBuffer, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Device-ID': metadata.deviceId || 'ESP32_MARITIME_001',
                    'Network-Type': metadata.networkType || 'cellular',
                    'Compression-Type': 'cbor',
                    'Original-Size': metadata.originalSize?.toString() || '378'
                },
                timeout: 30000
            });
            
            console.log(`✅ Slave Response: ${response.status} ${response.statusText}`);
            
            return {
                success: true,
                status: response.status,
                data: response.data
            };
            
        } catch (error) {
            console.error('❌ Failed to send to Slave:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// CBOR Decompression Handler for Slave Node
class SlaveCompressionHandler {
    
    decompressMaritimePayload(compressedBuffer) {
        try {
            // Decode CBOR binary data
            const decompressed = cbor.decode(compressedBuffer);
            
            console.log('🔓 CBOR decompression completed');
            console.log('📊 Decompressed keys:', Object.keys(decompressed));
            
            // Reconstruct original JSON format for Mobius
            const reconstructed = {
                "msisdn": decompressed.ms || decompressed.msisdn,
                "iso6346": decompressed.iso || decompressed.iso6346,
                "time": decompressed.t || decompressed.time,
                "rssi": decompressed.rssi?.toString() || "0",
                "cgi": decompressed.cgi || "",
                "ble-m": decompressed.bl !== undefined ? decompressed.bl.toString() : "0",
                "bat-soc": decompressed.ba !== undefined ? decompressed.ba.toString() : "0",
                "acc": this.reconstructAccelerometer(decompressed.a || decompressed.acc),
                "temperature": this.formatFloat(decompressed.te || decompressed.temperature),
                "humidity": this.formatFloat(decompressed.h || decompressed.humidity),
                "pressure": this.formatFloat(decompressed.p || decompressed.pressure),
                "door": decompressed.d || decompressed.door || "D",
                "gnss": decompressed.g !== undefined ? decompressed.g.toString() : "1",
                "latitude": this.formatFloat(decompressed.lat || decompressed.latitude),
                "longitude": this.formatFloat(decompressed.lon || decompressed.longitude),
                "altitude": this.formatFloat(decompressed.alt || decompressed.altitude),
                "speed": this.formatFloat(decompressed.s || decompressed.speed),
                "heading": this.formatFloat(decompressed.hd || decompressed.heading),
                "nsat": decompressed.n !== undefined ? decompressed.n.toString().padStart(2, '0') : "06",
                "hdop": this.formatFloat(decompressed.hp || decompressed.hdop)
            };
            
            console.log('✅ Successfully reconstructed maritime payload');
            
            return reconstructed;
        } catch (error) {
            throw new Error(`CBOR decompression failed: ${error.message}`);
        }
    }
    
    reconstructAccelerometer(accData) {
        if (Array.isArray(accData)) {
            return accData.map(val => val.toFixed(4)).join(' ');
        } else if (typeof accData === 'string') {
            return accData;
        }
        return "0.0000 0.0000 0.0000";
    }
    
    formatFloat(value) {
        if (typeof value === 'number') {
            return value.toFixed(2);
        }
        return value?.toString() || "0.00";
    }
    
    async sendToMobius(sensorData, deviceId = 'ESP32_MARITIME_001') {
        try {
            // Create oneM2M payload structure (exactly as Mobius expects)
            const oneM2MPayload = {
                "m2m:cin": {
                    "con": sensorData
                }
            };
            
            console.log('📤 Sending reconstructed data to Mobius...');
            console.log('🎯 Mobius URL:', MOBIUS_URL);
            console.log('📊 oneM2M payload size:', JSON.stringify(oneM2MPayload).length, 'bytes');
            console.log('📦 Content ("con") size:', JSON.stringify(sensorData).length, 'bytes');
            
            const response = await axios.post(MOBIUS_URL, oneM2MPayload, {
                headers: {
                    'Content-Type': 'application/json;ty=4',
                    'X-M2M-RI': `${Date.now()}`,
                    'X-M2M-Origin': 'Natesh'
                },
                timeout: 30000
            });
            
            console.log(`✅ Mobius Response: ${response.status} ${response.statusText}`);
            
            // Log the oneM2M response structure (matching user's expected logs)
            if (response.data && response.data['m2m:cin']) {
                const cin = response.data['m2m:cin'];
                console.log('📋 Mobius Created Resource:');
                console.log(`   Resource Name: ${cin.rn}`);
                console.log(`   Resource ID: ${cin.ri}`);
                console.log(`   Content Size: ${cin.cs} bytes`);
                console.log(`   Creation Time: ${cin.ct}`);
                console.log(`   State Tag: ${cin.st}`);
                console.log(`   Creator: ${cin.cr}`);
                
                // Log the full response (as shown in user's Mobius logs)
                console.log('🗂️  Full Mobius Response:');
                console.log(JSON.stringify(response.data, null, 2));
            }
            
            return {
                success: true,
                status: response.status,
                data: response.data,
                contentSize: response.data?.['m2m:cin']?.cs || null
            };
            
        } catch (error) {
            console.error('❌ Failed to send to Mobius:', error.message);
            
            if (error.response) {
                console.error(`📊 Mobius Error Response: ${error.response.status} ${error.response.statusText}`);
                console.error(`📦 Error Data:`, error.response.data);
            }
            
            return {
                success: false,
                status: error.response?.status || null,
                error: error.message
            };
        }
    }
}

// Initialize handlers
const masterHandler = new MasterCompressionHandler();
const slaveHandler = new SlaveCompressionHandler();

// =============================================================================
// MASTER NODE ROUTES
// =============================================================================

if (NODE_MODE === 'master') {
    
    // Receive raw JSON data from test-load.js and compress with CBOR
    app.post('/api/container', async (req, res) => {
        try {
            const { con, metadata } = req.body;
            const deviceId = req.headers['device-id'] || metadata?.deviceId || 'ESP32_MARITIME_001';
            const networkType = req.headers['network-type'] || metadata?.networkType || 'cellular';
            
            console.log(`📨 Received raw JSON payload from ${deviceId}`);
            console.log('📊 Network type:', networkType);
            console.log('📦 Original payload size:', JSON.stringify(con).length, 'bytes');
            
            // Compress the "con" payload with CBOR
            const compressionResult = masterHandler.compressMaritimePayload(con);
            
            // Send compressed data to Slave node
            const slaveResponse = await masterHandler.sendToSlave(compressionResult.compressedData, {
                deviceId,
                networkType,
                originalSize: compressionResult.originalSize,
                compressedSize: compressionResult.compressedSize,
                compressionRatio: compressionResult.compressionRatio
            });
            
            if (slaveResponse.success) {
                console.log('✅ Successfully processed and forwarded to Slave');
                res.status(200).json({
                    success: true,
                    message: 'Data compressed and forwarded to Slave successfully',
                    deviceId,
                    networkType,
                    originalSize: compressionResult.originalSize,
                    compressedSize: compressionResult.compressedSize,
                    compressionRatio: compressionResult.compressionRatio,
                    slaveStatus: slaveResponse.status,
                    mobiusStatus: slaveResponse.data?.mobiusStatus || null
                });
            } else {
                throw new Error(`Slave forwarding failed: ${slaveResponse.error}`);
            }
            
        } catch (error) {
            console.error('❌ Error processing raw JSON data:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    // Health check for Master node
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'healthy',
            service: 'maritime-master-node',
            mode: 'master',
            timestamp: new Date().toISOString(),
            features: [
                'cbor-compression',
                'raw-json-processing', 
                'slave-forwarding'
            ]
        });
    });
}

// =============================================================================
// SLAVE NODE ROUTES
// =============================================================================

if (NODE_MODE === 'slave') {
    
    // Receive compressed CBOR data from Master node
    app.post('/api/receive-compressed', async (req, res) => {
        try {
            const compressedBuffer = req.body;
            const deviceId = req.headers['device-id'] || 'unknown';
            const networkType = req.headers['network-type'] || 'cellular';
            const compressionType = req.headers['compression-type'] || 'cbor';
            const originalSize = parseInt(req.headers['original-size']) || 378;
            
            console.log(`📨 Received compressed data from Master`);
            console.log(`📊 Device: ${deviceId}, Network: ${networkType}`);
            console.log(`📊 Compressed size: ${compressedBuffer.length} bytes`);
            console.log(`🗜️  Compression type: ${compressionType}`);
            console.log(`📏 Original size: ${originalSize} bytes`);
            
            // Decompress CBOR payload
            const decompressedData = slaveHandler.decompressMaritimePayload(compressedBuffer);
            
            const compressionRatio = Math.round(((originalSize - compressedBuffer.length) / originalSize) * 100);
            console.log(`📊 Compression ratio: ${compressionRatio}% saved`);
            
            // Forward to Mobius with oneM2M headers
            const mobiusResponse = await slaveHandler.sendToMobius(decompressedData, deviceId);
            
            if (mobiusResponse.success) {
                res.status(200).json({
                    success: true,
                    message: 'Data decompressed and forwarded to Mobius successfully',
                    deviceId,
                    networkType,
                    compressedSize: compressedBuffer.length,
                    decompressedSize: originalSize,
                    compressionRatio,
                    mobiusStatus: mobiusResponse.status,
                    mobiusContentSize: mobiusResponse.contentSize
                });
            } else {
                throw new Error(`Mobius forwarding failed: ${mobiusResponse.error}`);
            }
            
        } catch (error) {
            console.error('❌ Error processing compressed data:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    // Health check for Slave node
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'healthy',
            service: 'maritime-slave-node',
            mode: 'slave',
            timestamp: new Date().toISOString(),
            features: [
                'cbor-decompression',
                'mobius-forwarding',
                'onem2m-integration'
            ]
        });
    });
}

// =============================================================================
// COMMON ROUTES
// =============================================================================

// Status endpoint for both modes
app.get('/api/status', (req, res) => {
    res.json({
        service: 'maritime-compression-server',
        mode: NODE_MODE,
        port: PORT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        endpoints: NODE_MODE === 'master' 
            ? ['/api/container', '/api/health', '/api/status']
            : ['/api/receive-compressed', '/api/health', '/api/status']
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Server error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚢 Maritime Compression Server running on port ${PORT}`);
    console.log(`🔧 Mode: ${NODE_MODE.toUpperCase()}`);
    
    if (NODE_MODE === 'master') {
        console.log('✅ CBOR compression enabled');
        console.log('✅ Raw JSON processing ready');
        console.log(`🎯 Slave URL: ${SLAVE_URL}`);
        console.log('📡 Endpoints: POST /api/container');
    } else {
        console.log('✅ CBOR decompression enabled');
        console.log('✅ Mobius oneM2M integration configured');
        console.log(`🎯 Mobius URL: ${MOBIUS_URL}`);
        console.log('📡 Endpoints: POST /api/receive-compressed');
    }
    
    console.log('📋 Health check: GET /api/health');
    console.log('📊 Status: GET /api/status');
}); 
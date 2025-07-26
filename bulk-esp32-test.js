/**
 * Bulk ESP32 Testing Script
 * Send single or multiple CBOR payloads to the decoder for testing
 */

const axios = require('axios');
const { ESP32JSCBOREncoder } = require('./esp32-js-encoder.js');
const fs = require('fs');

class BulkESP32Tester {
    constructor(decoderUrl = 'http://172.25.1.78:3001') {  // Updated to VM URL
        this.decoderUrl = decoderUrl;
        this.encoder = new ESP32JSCBOREncoder();
    }

    /**
     * Generate random sensor data for testing
     */
    generateRandomSensorData() {
        const now = new Date();
        const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.0`;
        
        return {
            "msisdn": `39${Math.floor(Math.random() * 900000000) + 100000000}`,
            "iso6346": `LMCU${Math.floor(Math.random() * 900000) + 100000}`,
            "time": timeStr,
            "rssi": String(Math.floor(Math.random() * 50) - 100),
            "cgi": `${Math.floor(Math.random() * 999) + 1}-${Math.floor(Math.random() * 99) + 1}-${Math.floor(Math.random() * 999) + 1}-${Math.floor(Math.random() * 999999) + 1}`,
            "ble-m": String(Math.floor(Math.random() * 2)),
            "bat-soc": String(Math.floor(Math.random() * 40) + 60),
            "acc": `${(Math.random() * 2000 - 1000).toFixed(4)} ${(Math.random() * 2000 - 1000).toFixed(4)} ${(Math.random() * 2000 - 1000).toFixed(4)}`,
            "temperature": (Math.random() * 40 - 10).toFixed(2),
            "humidity": (Math.random() * 60 + 20).toFixed(2),
            "pressure": (Math.random() * 100 + 950).toFixed(4),
            "door": Math.random() > 0.5 ? "O" : "D",
            "gnss": String(Math.floor(Math.random() * 2) + 1),
            "latitude": (Math.random() * 180 - 90).toFixed(4),
            "longitude": (Math.random() * 360 - 180).toFixed(4),
            "altitude": (Math.random() * 1000).toFixed(2),
            "speed": (Math.random() * 50).toFixed(1),
            "heading": (Math.random() * 360).toFixed(2),
            "nsat": String(Math.floor(Math.random() * 12) + 4).padStart(2, '0'),
            "hdop": (Math.random() * 5 + 0.5).toFixed(1)
        };
    }

    /**
     * Send single CBOR payload to decoder
     */
    async sendSinglePayload(sensorData = null) {
        try {
            // Generate data if not provided
            if (!sensorData) {
                sensorData = this.encoder.generateExampleData();
            }

            console.log('📤 Sending single payload to decoder...');
            console.log('📋 Original JSON data:');
            console.log(JSON.stringify(sensorData, null, 2));

            // Encode to CBOR
            const encodeResult = this.encoder.encodeSensorData(sensorData);
            if (!encodeResult.success) {
                throw new Error(`Encoding failed: ${encodeResult.error}`);
            }

            // Send to decoder
            const response = await axios.post(`${this.decoderUrl}/api/esp32-cbor`, encodeResult.cborBuffer, {
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                timeout: 10000
            });

            console.log('✅ Single payload test successful!');
            console.log('📊 Response:', response.data);

            return {
                success: true,
                originalData: sensorData,
                encodedSize: encodeResult.size,
                compressionRatio: encodeResult.compressionRatio,
                decoderResponse: response.data
            };

        } catch (error) {
            console.error('❌ Single payload test failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send bulk CBOR payloads to decoder
     */
    async sendBulkPayloads(count = 10, delayMs = 100) {
        console.log(`🚀 Starting bulk test: ${count} payloads`);
        console.log('=====================================');

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        for (let i = 1; i <= count; i++) {
            try {
                console.log(`\n📦 Sending payload ${i}/${count}...`);
                
                const sensorData = this.generateRandomSensorData();
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

                console.log(`✅ Payload ${i} successful: ${encodeResult.size} bytes`);
                
                results.push({
                    payloadId: i,
                    success: true,
                    encodedSize: encodeResult.size,
                    compressionRatio: encodeResult.compressionRatio,
                    decoderResponse: response.data
                });
                
                successCount++;

                // Add delay between requests
                if (i < count && delayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

            } catch (error) {
                console.error(`❌ Payload ${i} failed:`, error.message);
                results.push({
                    payloadId: i,
                    success: false,
                    error: error.message
                });
                failureCount++;
            }
        }

        // Generate report
        const report = this.generateBulkReport(results, successCount, failureCount);
        console.log('\n📊 BULK TEST REPORT');
        console.log('===================');
        console.log(report);

        return {
            success: failureCount === 0,
            totalPayloads: count,
            successCount,
            failureCount,
            results,
            report
        };
    }

    /**
     * Generate bulk test report
     */
    generateBulkReport(results, successCount, failureCount) {
        const successfulResults = results.filter(r => r.success);
        const avgSize = successfulResults.length > 0 
            ? successfulResults.reduce((sum, r) => sum + r.encodedSize, 0) / successfulResults.length 
            : 0;
        const avgCompression = successfulResults.length > 0 
            ? successfulResults.reduce((sum, r) => sum + parseFloat(r.compressionRatio), 0) / successfulResults.length 
            : 0;

        return `
Total Payloads: ${results.length}
✅ Successful: ${successCount}
❌ Failed: ${failureCount}
📊 Success Rate: ${((successCount / results.length) * 100).toFixed(1)}%
📦 Average Size: ${avgSize.toFixed(1)} bytes
🗜️  Average Compression: ${avgCompression.toFixed(1)}%
🚀 Astrocast Compatible: ${avgSize <= 160 ? '✅' : '❌'}
        `.trim();
    }

    /**
     * Load and send CBOR file
     */
    async sendCBORFile(filePath) {
        try {
            console.log(`📁 Loading CBOR file: ${filePath}`);
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const cborBuffer = fs.readFileSync(filePath);
            
            console.log('📤 Sending CBOR file to decoder...');
            
            const response = await axios.post(`${this.decoderUrl}/api/esp32-cbor`, cborBuffer, {
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                timeout: 10000
            });

            console.log('✅ CBOR file test successful!');
            console.log('📊 Response:', response.data);

            return {
                success: true,
                fileSize: cborBuffer.length,
                decoderResponse: response.data
            };

        } catch (error) {
            console.error('❌ CBOR file test failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use
module.exports = { BulkESP32Tester };

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const tester = new BulkESP32Tester();

    async function main() {
        if (args.length === 0) {
            console.log('🧪 ESP32 Bulk Testing Tool');
            console.log('==========================');
            console.log('Usage:');
            console.log('  node bulk-esp32-test.js single                    # Send single payload');
            console.log('  node bulk-esp32-test.js bulk [count] [delay]      # Send bulk payloads');
            console.log('  node bulk-esp32-test.js file <path>               # Send CBOR file');
            console.log('');
            console.log('Examples:');
            console.log('  node bulk-esp32-test.js single');
            console.log('  node bulk-esp32-test.js bulk 50 200');
            console.log('  node bulk-esp32-test.js file test-esp32-payload.cbor');
            return;
        }

        const command = args[0];

        switch (command) {
            case 'single':
                await tester.sendSinglePayload();
                break;
            case 'bulk':
                const count = parseInt(args[1]) || 10;
                const delay = parseInt(args[2]) || 100;
                await tester.sendBulkPayloads(count, delay);
                break;
            case 'file':
                const filePath = args[1];
                if (!filePath) {
                    console.error('❌ Please provide a file path');
                    return;
                }
                await tester.sendCBORFile(filePath);
                break;
            default:
                console.error('❌ Unknown command:', command);
                break;
        }
    }

    main().catch(console.error);
} 
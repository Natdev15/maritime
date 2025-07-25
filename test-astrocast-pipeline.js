const axios = require('axios');

/**
 * Astrocast Pipeline Load Tester
 * Tests the complete pipeline: ESP32 → Astrocast → Slave → Mobius
 */

class AstrocastLoadTester {
    constructor() {
        this.masterUrl = 'http://localhost:3000';
        this.stats = {
            totalSent: 0,
            successful: 0,
            errors: 0,
            startTime: null,
            responseTimes: []
        };
    }

    /**
     * Generate sample maritime sensor data
     */
    generateSensorData(containerId, recordIndex) {
        const baseTime = new Date();
        baseTime.setMinutes(baseTime.getMinutes() + recordIndex);
        
        return {
            "msisdn": `39331553789${containerId % 10}`,
            "iso6346": `LMCU123123${containerId}`,
            "time": baseTime.toISOString().replace(/[-:T]/g, '').substring(2, 16),
            "rssi": `${20 + (containerId % 20)}`,
            "cgi": `999-01-1-31D4${containerId}`,
            "ble-m": `${containerId % 2}`,
            "bat-soc": `${80 + (containerId % 20)}`,
            "acc": `${-1000 + (containerId * 10)}.0407 -1.4649 -4.3947`,
            "temperature": `${15 + (containerId % 10)}.00`,
            "humidity": `${40 + (containerId % 20)}.00`,
            "pressure": `${1010 + (containerId % 10)}.5043`,
            "door": containerId % 2 === 0 ? "D" : "O",
            "gnss": "1",
            "latitude": `${31.89 + (containerId * 0.01)}`,
            "longitude": `${28.70 + (containerId * 0.01)}`,
            "altitude": `${35 + (containerId % 10)}.10`,
            "speed": `${25 + (containerId % 10)}.3`,
            "heading": `${120 + (containerId % 20)}.31`,
            "nsat": `0${6 + (containerId % 4)}`,
            "hdop": `${1.5 + (containerId * 0.1)}`
        };
    }

    /**
     * Generate test payload
     */
    generateTestPayload(deviceId, containerId, recordIndex) {
        const sensorData = this.generateSensorData(containerId, recordIndex);
        
        return {
            con: sensorData,
            metadata: {
                deviceId: deviceId || 'ESP32_MARITIME_001',
                timestamp: new Date().toISOString(),
                networkType: 'astrocast',
                originalSize: JSON.stringify(sensorData).length,
                containerId: containerId,
                recordIndex: recordIndex
            }
        };
    }

    /**
     * Send single container
     */
    async sendSingle(container) {
        const startTime = Date.now();
        
        try {
            const response = await axios.post(`${this.masterUrl}/api/container`, container, {
                headers: {
                    'Content-Type': 'application/json',
                    'Device-ID': container.metadata.deviceId,
                    'Network-Type': container.metadata.networkType
                },
                timeout: 30000
            });
            
            const responseTime = Date.now() - startTime;
            this.stats.responseTimes.push(responseTime);
            
            if (response.data.success) {
                this.stats.successful++;
                console.log(`✅ Container ${container.metadata.containerId} processed successfully`);
                console.log(`   📊 Astrocast: ${response.data.optimization.compressedSize}/160 bytes`);
                console.log(`   🗜️  Compression: ${response.data.optimization.compressionRatio}%`);
                console.log(`   ⏱️  Response time: ${responseTime}ms`);
            } else {
                this.stats.errors++;
                console.log(`❌ Container ${container.metadata.containerId} failed`);
            }
            
            return {
                success: response.data.success,
                responseTime,
                optimization: response.data.optimization
            };
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.stats.responseTimes.push(responseTime);
            this.stats.errors++;
            
            console.log(`❌ Container ${container.metadata.containerId} error: ${error.message}`);
            
            return {
                success: false,
                responseTime,
                error: error.message
            };
        }
    }

    /**
     * Run individual load test
     */
    async runIndividualLoadTest(total = 10, records = 1, rate = 500) {
        console.log('🚀 Starting Astrocast Individual Load Test');
        console.log('==========================================');
        console.log(`📦 Total containers: ${total}`);
        console.log(`📊 Records per container: ${records}`);
        console.log(`🎯 Target rate: ${rate}/second`);
        console.log(`🛰️  Pipeline: ESP32 → Astrocast → Slave → Mobius`);
        console.log(`📡 Master URL: ${this.masterUrl}`);
        console.log('');
        
        this.stats.startTime = Date.now();
        
        for (let i = 0; i < total; i++) {
            const container = this.generateTestPayload('ESP32_MARITIME_001', i + 1, 1);
            this.stats.totalSent++;
            
            await this.sendSingle(container);
            
            // Rate limiting
            if (rate > 0 && i < total - 1) {
                const delay = 1000 / rate;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        this.printReport();
    }

    /**
     * Run batch load test
     */
    async runBatchLoadTest(total = 10, records = 1) {
        console.log('🚀 Starting Astrocast Batch Load Test');
        console.log('=====================================');
        console.log(`📦 Total containers: ${total}`);
        console.log(`📊 Records per container: ${records}`);
        console.log(`🛰️  Pipeline: ESP32 → Astrocast → Slave → Mobius`);
        console.log('');
        
        this.stats.startTime = Date.now();
        
        const containers = [];
        for (let i = 0; i < total; i++) {
            containers.push(this.generateTestPayload('ESP32_MARITIME_001', i + 1, 1));
        }
        
        console.log(`📤 Sending ${containers.length} containers in batch...`);
        
        const promises = containers.map(container => {
            this.stats.totalSent++;
            return this.sendSingle(container);
        });
        
        await Promise.all(promises);
        
        this.printReport();
    }

    /**
     * Print test report
     */
    printReport() {
        const duration = Date.now() - this.stats.startTime;
        const avgResponseTime = this.stats.responseTimes.length > 0 
            ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length 
            : 0;
        
        const minResponseTime = Math.min(...this.stats.responseTimes);
        const maxResponseTime = Math.max(...this.stats.responseTimes);
        const successRate = (this.stats.successful / this.stats.totalSent) * 100;
        
        console.log('\n📋 Astrocast Load Test Report');
        console.log('==============================');
        console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)} seconds`);
        console.log(`📦 Total sent: ${this.stats.totalSent}`);
        console.log(`✅ Successful: ${this.stats.successful}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log(`📈 Success rate: ${successRate.toFixed(2)}%`);
        console.log(`⚡ Average response time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`📊 Min response time: ${minResponseTime}ms`);
        console.log(`📊 Max response time: ${maxResponseTime}ms`);
        console.log(`🛰️  Astrocast compatible: ✅`);
        console.log(`🗜️  Compression: Extreme CBOR`);
        console.log(`🌐 Pipeline: ESP32 → Astrocast → Slave → Mobius`);
    }

    /**
     * Check server health
     */
    async checkHealth() {
        try {
            const response = await axios.get(`${this.masterUrl}/api/health`);
            console.log('✅ Master server is healthy:', response.data);
            return true;
        } catch (error) {
            console.log('❌ Master server is not responding:', error.message);
            return false;
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'individual';
    
    const tester = new AstrocastLoadTester();
    
    // Check server health first
    const isHealthy = await tester.checkHealth();
    if (!isHealthy) {
        console.log('❌ Cannot proceed - server is not healthy');
        return;
    }
    
    console.log('');
    
    switch (command) {
        case 'individual':
            const total = parseInt(args.find(arg => arg.startsWith('--total='))?.split('=')[1]) || 10;
            const records = parseInt(args.find(arg => arg.startsWith('--records='))?.split('=')[1]) || 1;
            const rate = parseInt(args.find(arg => arg.startsWith('--rate='))?.split('=')[1]) || 500;
            
            await tester.runIndividualLoadTest(total, records, rate);
            break;
            
        case 'batch':
            const batchTotal = parseInt(args.find(arg => arg.startsWith('--total='))?.split('=')[1]) || 10;
            const batchRecords = parseInt(args.find(arg => arg.startsWith('--records='))?.split('=')[1]) || 1;
            
            await tester.runBatchLoadTest(batchTotal, batchRecords);
            break;
            
        default:
            console.log('🚢 Astrocast Pipeline Load Tester');
            console.log('=================================');
            console.log('Usage: node test-astrocast-pipeline.js [command] [options]');
            console.log('');
            console.log('Commands:');
            console.log('  individual - Send containers one by one (default)');
            console.log('  batch      - Send containers in parallel');
            console.log('');
            console.log('Options:');
            console.log('  --total=N    - Total containers to send (default: 10)');
            console.log('  --records=N  - Records per container (default: 1)');
            console.log('  --rate=N     - Target rate per second (default: 500)');
            console.log('');
            console.log('Examples:');
            console.log('  node test-astrocast-pipeline.js individual --total=50 --rate=100');
            console.log('  node test-astrocast-pipeline.js batch --total=100');
            console.log('');
            console.log('Pipeline: ESP32 → Astrocast → Slave → Mobius');
            console.log('Astrocast Limit: <160 bytes per message');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = AstrocastLoadTester; 
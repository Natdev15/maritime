const axios = require('axios');

// Master node endpoint configuration
const MASTER_URL = process.env.MASTER_URL || 'http://localhost:3000/api/container';

// Maritime sensor data generator (same payload as Mobius receives)
function generateMaritimeSensorData() {
    const baseTime = new Date();
    const timeString = baseTime.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    
    return {
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
}

// Generate test payload with "con" structure (as expected by Mobius)
function generateTestPayload(deviceId = 'ESP32_MARITIME_001') {
    return {
        "con": generateMaritimeSensorData(),
        "metadata": {
            "deviceId": deviceId,
            "timestamp": new Date().toISOString(),
            "networkType": "cellular", // or "satellite"
            "originalSize": 378 // approximate JSON size
        }
    };
}

// Send raw JSON data to Master node for compression
async function sendRawDataToMaster(payload) {
    try {
        console.log('📱 Sending raw JSON payload to Master node...');
        console.log('🎯 Master URL:', MASTER_URL);
        console.log('📊 Payload size:', JSON.stringify(payload).length, 'bytes');
        
        const response = await axios.post(MASTER_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Device-ID': payload.metadata?.deviceId || 'ESP32_MARITIME_001',
                'Network-Type': payload.metadata?.networkType || 'cellular'
            },
            timeout: 30000
        });
        
        console.log(`✅ Master Response: ${response.status} ${response.statusText}`);
        
        if (response.data) {
            console.log('📋 Master Processing Result:');
            console.log(`   Success: ${response.data.success}`);
            console.log(`   Original Size: ${response.data.originalSize} bytes`);
            console.log(`   Compressed Size: ${response.data.compressedSize} bytes`);
            console.log(`   Compression Ratio: ${response.data.compressionRatio}%`);
            console.log(`   Slave Status: ${response.data.slaveStatus}`);
        }
        
        return response.data;
        
    } catch (error) {
        console.error('❌ Failed to send to Master:', error.message);
        
        if (error.response) {
            console.error(`📊 Master Error: ${error.response.status} ${error.response.statusText}`);
            console.error(`📦 Error Details:`, error.response.data);
        }
        
        throw error;
    }
}

// Load testing functions
async function singleTest() {
    console.log('🧪 Running single payload test...\n');
    
    const payload = generateTestPayload();
    console.log('📦 Generated payload:');
    console.log(JSON.stringify(payload.con, null, 2));
    console.log('');
    
    try {
        const result = await sendRawDataToMaster(payload);
        console.log('\n✅ Single test completed successfully!');
        return result;
    } catch (error) {
        console.log('\n❌ Single test failed!');
        throw error;
    }
}

async function loadTest(numberOfRequests = 10, concurrency = 5) {
    console.log(`🔥 Running load test: ${numberOfRequests} requests with ${concurrency} concurrent...\n`);
    
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    // Create batches for controlled concurrency
    const batches = [];
    for (let i = 0; i < numberOfRequests; i += concurrency) {
        const batch = [];
        for (let j = i; j < Math.min(i + concurrency, numberOfRequests); j++) {
            batch.push(j);
        }
        batches.push(batch);
    }
    
    // Execute batches
    for (const batch of batches) {
        const batchPromises = batch.map(async (index) => {
            try {
                const payload = generateTestPayload(`ESP32_MARITIME_${index.toString().padStart(3, '0')}`);
                const result = await sendRawDataToMaster(payload);
                successCount++;
                return { index, success: true, result };
            } catch (error) {
                errorCount++;
                return { index, success: false, error: error.message };
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        console.log(`📊 Batch completed: ${batch.length} requests`);
    }
    
    const totalTime = Date.now() - startTime;
    const rps = (numberOfRequests / totalTime) * 1000;
    
    console.log('\n📈 Load Test Results:');
    console.log(`   Total Requests: ${numberOfRequests}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${errorCount}`);
    console.log(`   Total Time: ${totalTime}ms`);
    console.log(`   Requests/Second: ${rps.toFixed(2)}`);
    console.log(`   Success Rate: ${((successCount / numberOfRequests) * 100).toFixed(2)}%`);
    
    return results;
}

// Performance test with different payload sizes
async function performanceTest() {
    console.log('⚡ Running performance test...\n');
    
    const testCases = [
        { name: 'Single Payload', count: 1 },
        { name: 'Small Load', count: 10 },
        { name: 'Medium Load', count: 50 },
        { name: 'Large Load', count: 100 }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n🎯 Testing: ${testCase.name} (${testCase.count} requests)`);
        
        try {
            const startTime = Date.now();
            await loadTest(testCase.count, Math.min(testCase.count, 10));
            const duration = Date.now() - startTime;
            
            console.log(`✅ ${testCase.name} completed in ${duration}ms`);
        } catch (error) {
            console.log(`❌ ${testCase.name} failed:`, error.message);
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'single';
    
    console.log('🚢 Maritime Data Load Tester');
    console.log('📡 Target: Master Node for CBOR Compression');
    console.log(`🎯 Master URL: ${MASTER_URL}\n`);
    
    try {
        switch (command) {
            case 'single':
                await singleTest();
                break;
                
            case 'load':
                const requests = parseInt(args[1]) || 10;
                const concurrency = parseInt(args[2]) || 5;
                await loadTest(requests, concurrency);
                break;
                
            case 'performance':
                await performanceTest();
                break;
                
            default:
                console.log('Usage:');
                console.log('  node test-load.js single                    # Single test');
                console.log('  node test-load.js load [requests] [concurrent] # Load test');
                console.log('  node test-load.js performance               # Performance test');
                process.exit(1);
        }
        
        console.log('\n🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('\n💥 Test failed:', error.message);
        process.exit(1);
    }
}

// Export functions for programmatic use
module.exports = {
    generateMaritimeSensorData,
    generateTestPayload,
    sendRawDataToMaster,
    singleTest,
    loadTest,
    performanceTest
};

// Run if called directly
if (require.main === module) {
    main();
} 
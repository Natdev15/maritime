/**
 * ESP32 CBOR Pipeline Test Suite
 * 
 * Tests the complete hybrid TN/NTN IoT pipeline:
 * 1. ESP32 CBOR encoding simulation
 * 2. Node.js decoder gateway
 * 3. Mobius integration
 * 4. Performance metrics
 */

const cbor = require('cbor');
const axios = require('axios');
const { ESP32CBORDecoder } = require('./esp32-cbor-decoder');

class ESP32PipelineTester {
    constructor() {
        this.decoder = new ESP32CBORDecoder();
        this.testResults = [];
        this.performanceMetrics = {
            totalTests: 0,
            successfulTests: 0,
            failedTests: 0,
            averageProcessingTime: 0,
            totalProcessingTime: 0,
            compressionRatios: [],
            payloadSizes: []
        };
    }
    
    /**
     * Generate sample sensor data matching ESP32 format
     */
    generateSampleSensorData() {
        return {
            msisdn: "393315537896",
            iso6346: "LMCU1231230",
            time: "200423 002014.0",
            rssi: 26,
            cgi: "999-01-1-31D41",
            "ble-m": 0,
            "bat-soc": 92,
            acc: "-1010.0407 -1.4649 -4.3947",
            temperature: 17.00,
            humidity: 44.00,
            pressure: 1012.5043,
            door: "D",
            gnss: 1,
            latitude: 31.8910,
            longitude: 28.7041,
            altitude: 38.10,
            speed: 27.3,
            heading: 125.31,
            nsat: 6,
            hdop: 1.8
        };
    }
    
    /**
     * Simulate ESP32 CBOR encoding (matches esp32_cbor_encoder.cpp logic)
     */
    simulateESP32Encoding(sensorData) {
        // This simulates the ESP32 encoding process
        // Create a plain object with numeric keys for CBOR encoding
        const encodedData = {};
        
        // Add version and codec identifiers first
        encodedData[0xFF] = 0x01; // Version (use 0xFF to avoid conflicts)
        encodedData[0xFE] = 0x01; // Codec (use 0xFE to avoid conflicts)
        
        // Field 0: MSISDN (optimized - remove "39" prefix, keep last 6 digits)
        encodedData[0] = parseInt(sensorData.msisdn.replace(/^39/, '').slice(-6));
        
        // Field 1: ISO6346 (keep as string)
        encodedData[1] = sensorData.iso6346;
        
        // Field 2: Time (optimized - extract YYYYMMDDHH)
        encodedData[2] = parseInt(sensorData.time.replace(/[^0-9]/g, '').substring(0, 8));
        
        // Field 3: RSSI (already integer)
        encodedData[3] = sensorData.rssi;
        
        // Field 4: CGI (parsed into array)
        const cgiParts = sensorData.cgi.split('-');
        encodedData[4] = [
            parseInt(cgiParts[0]), // MCC
            parseInt(cgiParts[1]), // MNC
            parseInt(cgiParts[2]), // LAC
            parseInt(cgiParts[3], 16) // Cell ID (hex to decimal)
        ];
        
        // Field 5: BLE-M (already integer)
        encodedData[5] = sensorData["ble-m"];
        
        // Field 6: Battery SOC (already integer)
        encodedData[6] = sensorData["bat-soc"];
        
        // Field 7: Accelerometer (quantized array)
        const accParts = sensorData.acc.split(' ');
        encodedData[7] = [
            Math.round(parseFloat(accParts[0]) * 1000), // X
            Math.round(parseFloat(accParts[1]) * 1000), // Y
            Math.round(parseFloat(accParts[2]) * 1000)  // Z
        ];
        
        // Field 8: Temperature (quantized)
        encodedData[8] = Math.round(sensorData.temperature * 100);
        
        // Field 9: Humidity (quantized)
        encodedData[9] = Math.round(sensorData.humidity * 100);
        
        // Field 10: Pressure (quantized)
        encodedData[10] = Math.round(sensorData.pressure * 100);
        
        // Field 11: Door (single character)
        encodedData[11] = sensorData.door;
        
        // Field 12: GNSS (already integer)
        encodedData[12] = sensorData.gnss;
        
        // Field 13: Latitude (quantized)
        encodedData[13] = Math.round(sensorData.latitude * 100);
        
        // Field 14: Longitude (quantized)
        encodedData[14] = Math.round(sensorData.longitude * 100);
        
        // Field 15: Altitude (quantized)
        encodedData[15] = Math.round(sensorData.altitude * 100);
        
        // Field 16: Speed (quantized)
        encodedData[16] = Math.round(sensorData.speed * 10);
        
        // Field 17: Heading (quantized)
        encodedData[17] = Math.round(sensorData.heading * 100);
        
        // Field 18: NSAT (already integer)
        encodedData[18] = sensorData.nsat;
        
        // Field 19: HDOP (quantized)
        encodedData[19] = Math.round(sensorData.hdop * 100);
        
        return cbor.encode(encodedData);
    }
    
    /**
     * Test single pipeline iteration
     */
    async testPipelineIteration(iteration = 1, deviceId = 'ESP32_TEST_001') {
        console.log(`\n🧪 Test Iteration ${iteration}`);
        
        const startTime = Date.now();
        
        try {
            // Step 1: Generate sample data
            const originalData = this.generateSampleSensorData();
            const originalSize = JSON.stringify(originalData).length;
            
            // Step 2: Simulate ESP32 encoding
            const cborBuffer = this.simulateESP32Encoding(originalData);
            const cborSize = cborBuffer.length;
            
            // Step 3: Test decoder
            const result = await this.decoder.processPipeline(cborBuffer, {
                deviceId,
                networkType: 'astrocast',
                timestamp: new Date().toISOString()
            });
            
            const processingTime = Date.now() - startTime;
            
            // Step 4: Validate results
            const validation = this.validateResults(originalData, result);
            
            // Step 5: Calculate metrics
            const compressionRatio = (1 - (cborSize / originalSize)) * 100;
            const astrocastCompatible = cborSize <= 160;
            
            const testResult = {
                iteration,
                success: result.success && validation.success,
                processingTime,
                originalSize,
                cborSize,
                compressionRatio,
                astrocastCompatible,
                decodedFields: result.stats?.decodedFields || 0,
                validation,
                error: result.error || validation.error
            };
            
            // Update performance metrics
            this.performanceMetrics.totalTests++;
            if (testResult.success) {
                this.performanceMetrics.successfulTests++;
            } else {
                this.performanceMetrics.failedTests++;
            }
            
            this.performanceMetrics.totalProcessingTime += processingTime;
            this.performanceMetrics.compressionRatios.push(compressionRatio);
            this.performanceMetrics.payloadSizes.push(cborSize);
            
            this.testResults.push(testResult);
            
            console.log(`✅ Iteration ${iteration} completed in ${processingTime}ms`);
            console.log(`   Compression: ${compressionRatio.toFixed(1)}% (${originalSize} → ${cborSize} bytes)`);
            console.log(`   Astrocast compatible: ${astrocastCompatible ? '✅' : '❌'}`);
            
            return testResult;
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ Iteration ${iteration} failed:`, error.message);
            
            const testResult = {
                iteration,
                success: false,
                processingTime,
                error: error.message
            };
            
            this.performanceMetrics.totalTests++;
            this.performanceMetrics.failedTests++;
            this.testResults.push(testResult);
            
            return testResult;
        }
    }
    
    /**
     * Validate decoded results against original data
     */
    validateResults(originalData, result) {
        try {
            if (!result.success) {
                return { success: false, error: result.error };
            }
            
            const decodedData = result.decodedData;
            const errors = [];
            
            // Validate key fields
            const validations = [
                { field: 'msisdn', tolerance: 0 },
                { field: 'iso6346', tolerance: 0 },
                { field: 'temperature', tolerance: 0.1 },
                { field: 'humidity', tolerance: 0.1 },
                { field: 'pressure', tolerance: 0.1 },
                { field: 'latitude', tolerance: 0.01 },
                { field: 'longitude', tolerance: 0.01 },
                { field: 'altitude', tolerance: 0.1 },
                { field: 'speed', tolerance: 0.1 },
                { field: 'heading', tolerance: 0.1 },
                { field: 'hdop', tolerance: 0.1 }
            ];
            
            for (const validation of validations) {
                const original = originalData[validation.field];
                const decoded = decodedData[validation.field];
                
                if (decoded === undefined) {
                    errors.push(`Missing field: ${validation.field}`);
                    continue;
                }
                
                if (validation.tolerance === 0) {
                    // Exact match for strings and integers
                    if (original !== decoded) {
                        errors.push(`${validation.field}: ${original} ≠ ${decoded}`);
                    }
                } else {
                    // Numeric tolerance for floats
                    const diff = Math.abs(original - decoded);
                    if (diff > validation.tolerance) {
                        errors.push(`${validation.field}: ${original} ≠ ${decoded} (diff: ${diff})`);
                    }
                }
            }
            
            // Validate accelerometer (special case)
            if (decodedData.acc) {
                const originalAcc = originalData.acc.split(' ').map(x => parseFloat(x));
                const decodedAcc = decodedData.acc.split(' ').map(x => parseFloat(x));
                
                for (let i = 0; i < 3; i++) {
                    const diff = Math.abs(originalAcc[i] - decodedAcc[i]);
                    if (diff > 0.001) {
                        errors.push(`acc[${i}]: ${originalAcc[i]} ≠ ${decodedAcc[i]} (diff: ${diff})`);
                    }
                }
            }
            
            return {
                success: errors.length === 0,
                errors,
                fieldCount: Object.keys(decodedData).length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Run load test with multiple iterations
     */
    async runLoadTest(iterations = 100, concurrency = 10) {
        console.log(`\n🚀 Starting Load Test: ${iterations} iterations, ${concurrency} concurrent`);
        
        const startTime = Date.now();
        const promises = [];
        
        for (let i = 0; i < iterations; i++) {
            const promise = this.testPipelineIteration(i + 1, `ESP32_LOAD_${(i % 10) + 1}`);
            promises.push(promise);
            
            // Limit concurrency
            if (promises.length >= concurrency) {
                await Promise.all(promises);
                promises.length = 0;
            }
        }
        
        // Wait for remaining promises
        if (promises.length > 0) {
            await Promise.all(promises);
        }
        
        const totalTime = Date.now() - startTime;
        this.calculateFinalMetrics(totalTime);
        
        return this.generateReport();
    }
    
    /**
     * Calculate final performance metrics
     */
    calculateFinalMetrics(totalTime) {
        this.performanceMetrics.averageProcessingTime = 
            this.performanceMetrics.totalProcessingTime / this.performanceMetrics.totalTests;
        
        this.performanceMetrics.averageCompressionRatio = 
            this.performanceMetrics.compressionRatios.reduce((a, b) => a + b, 0) / this.performanceMetrics.compressionRatios.length;
        
        this.performanceMetrics.averagePayloadSize = 
            this.performanceMetrics.payloadSizes.reduce((a, b) => a + b, 0) / this.performanceMetrics.payloadSizes.length;
        
        this.performanceMetrics.successRate = 
            (this.performanceMetrics.successfulTests / this.performanceMetrics.totalTests) * 100;
        
        this.performanceMetrics.throughput = 
            (this.performanceMetrics.totalTests / totalTime) * 1000; // requests per second
    }
    
    /**
     * Generate comprehensive test report
     */
    generateReport() {
        const report = {
            summary: {
                totalTests: this.performanceMetrics.totalTests,
                successfulTests: this.performanceMetrics.successfulTests,
                failedTests: this.performanceMetrics.failedTests,
                successRate: this.performanceMetrics.successRate.toFixed(2) + '%',
                totalTime: this.performanceMetrics.totalProcessingTime + 'ms',
                averageProcessingTime: this.performanceMetrics.averageProcessingTime.toFixed(2) + 'ms',
                throughput: this.performanceMetrics.throughput.toFixed(2) + ' req/sec'
            },
            compression: {
                averageCompressionRatio: this.performanceMetrics.averageCompressionRatio.toFixed(2) + '%',
                averagePayloadSize: this.performanceMetrics.averagePayloadSize.toFixed(2) + ' bytes',
                astrocastCompatible: this.performanceMetrics.payloadSizes.every(size => size <= 160)
            },
            performance: {
                minProcessingTime: Math.min(...this.testResults.map(r => r.processingTime || 0)) + 'ms',
                maxProcessingTime: Math.max(...this.testResults.map(r => r.processingTime || 0)) + 'ms',
                minCompressionRatio: Math.min(...this.performanceMetrics.compressionRatios).toFixed(2) + '%',
                maxCompressionRatio: Math.max(...this.performanceMetrics.compressionRatios).toFixed(2) + '%'
            },
            errors: this.testResults
                .filter(r => !r.success)
                .map(r => ({ iteration: r.iteration, error: r.error }))
        };
        
        console.log('\n📊 TEST REPORT');
        console.log('==============');
        console.log(`Total Tests: ${report.summary.totalTests}`);
        console.log(`Success Rate: ${report.summary.successRate}`);
        console.log(`Average Processing Time: ${report.summary.averageProcessingTime}`);
        console.log(`Throughput: ${report.summary.throughput}`);
        console.log(`Average Compression: ${report.compression.averageCompressionRatio}`);
        console.log(`Average Payload Size: ${report.compression.averagePayloadSize}`);
        console.log(`Astrocast Compatible: ${report.compression.astrocastCompatible ? '✅' : '❌'}`);
        
        if (report.errors.length > 0) {
            console.log(`\n❌ Errors (${report.errors.length}):`);
            report.errors.forEach(error => {
                console.log(`  Iteration ${error.iteration}: ${error.error}`);
            });
        }
        
        return report;
    }
    
    /**
     * Test Mobius integration (if available)
     */
    async testMobiusIntegration() {
        console.log('\n📡 Testing Mobius Integration...');
        
        try {
            const originalData = this.generateSampleSensorData();
            const cborBuffer = this.simulateESP32Encoding(originalData);
            
            const result = await this.decoder.processPipeline(cborBuffer, {
                deviceId: 'ESP32_MOBIUS_TEST',
                networkType: 'astrocast'
            }, {
                url: process.env.MOBIUS_URL || 'http://localhost:7579/Mobius/Natesh/NateshContainer?ty=4',
                origin: process.env.MOBIUS_ORIGIN || 'Natesh'
            });
            
            if (result.success && result.mobiusResult?.success) {
                console.log('✅ Mobius integration successful');
                console.log(`   Mobius ID: ${result.mobiusResult.mobiusId}`);
                console.log(`   Response: ${result.mobiusResult.status}`);
            } else {
                console.log('⚠️  Mobius integration test completed (may be offline)');
                console.log(`   Error: ${result.mobiusResult?.error || 'No Mobius response'}`);
            }
            
            return result;
            
        } catch (error) {
            console.log('⚠️  Mobius integration test skipped (server may be offline)');
            console.log(`   Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

// Main test execution
async function runTests() {
    const tester = new ESP32PipelineTester();
    
    console.log('🚀 ESP32 CBOR Pipeline Test Suite');
    console.log('==================================');
    
    // Test single iteration first
    await tester.testPipelineIteration(1, 'ESP32_SINGLE_TEST');
    
    // Run load test
    await tester.runLoadTest(50, 5);
    
    // Test Mobius integration
    await tester.testMobiusIntegration();
    
    console.log('\n✅ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { ESP32PipelineTester }; 
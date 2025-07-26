/**
 * Docker Setup Test
 * Test the Docker deployment and network connectivity
 */

const axios = require('axios');

class DockerSetupTester {
    constructor() {
        this.localEncoderUrl = 'http://localhost:3000';
        this.vmDecoderUrl = 'http://172.25.1.78:3001';
        this.vmMobiusUrl = 'http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4';
    }

    async testLocalEncoder() {
        console.log('🧪 Testing Local Encoder...');
        try {
            const response = await axios.get(`${this.localEncoderUrl}/health`, { timeout: 5000 });
            console.log('✅ Local encoder is running');
            console.log('📊 Status:', response.data);
            return true;
        } catch (error) {
            console.log('❌ Local encoder is not running');
            console.log('💡 Start with: npm run deploy-local');
            return false;
        }
    }

    async testVMDecoder() {
        console.log('\n🧪 Testing VM Decoder...');
        try {
            const response = await axios.get(`${this.vmDecoderUrl}/health`, { timeout: 5000 });
            console.log('✅ VM decoder is running');
            console.log('📊 Status:', response.data);
            return true;
        } catch (error) {
            console.log('❌ VM decoder is not running');
            console.log('💡 Start with: npm run deploy-vm (on VM)');
            return false;
        }
    }

    async testVMMobius() {
        console.log('\n🧪 Testing VM Mobius...');
        try {
            const response = await axios.get(this.vmMobiusUrl, { timeout: 5000 });
            console.log('✅ VM Mobius is running');
            console.log('📊 Status:', response.status);
            return true;
        } catch (error) {
            console.log('❌ VM Mobius is not accessible');
            console.log('💡 Ensure Mobius is running on VM');
            return false;
        }
    }

    async testEndToEnd() {
        console.log('\n🧪 Testing End-to-End Pipeline...');
        try {
            // Generate test data
            const testData = {
                "msisdn": "393315537896",
                "iso6346": "LMCU1231230",
                "time": "200423 002014.0",
                "rssi": "26",
                "cgi": "999-01-1-31D41",
                "bat-soc": "92",
                "acc": "-1010.0407 -1.4649 -4.3947",
                "temperature": "17.00",
                "humidity": "44.00",
                "pressure": "1012.5043",
                "door": "D",
                "latitude": "31.8910",
                "longitude": "28.7041",
                "altitude": "38.10",
                "speed": "27.3",
                "heading": "125.31"
            };

            const response = await axios.post(`${this.localEncoderUrl}/api/generate-and-send`, testData, {
                timeout: 10000
            });

            console.log('✅ End-to-end test successful!');
            console.log('📊 Response:', response.data);
            return true;

        } catch (error) {
            console.log('❌ End-to-end test failed');
            console.log('💡 Error:', error.message);
            return false;
        }
    }

    async runAllTests() {
        console.log('🚀 Docker Setup Test');
        console.log('===================');
        
        const results = {
            localEncoder: await this.testLocalEncoder(),
            vmDecoder: await this.testVMDecoder(),
            vmMobius: await this.testVMMobius(),
            endToEnd: false
        };

        // Only test end-to-end if both encoder and decoder are running
        if (results.localEncoder && results.vmDecoder) {
            results.endToEnd = await this.testEndToEnd();
        }

        console.log('\n📊 Test Results Summary');
        console.log('=======================');
        console.log(`Local Encoder: ${results.localEncoder ? '✅' : '❌'}`);
        console.log(`VM Decoder: ${results.vmDecoder ? '✅' : '❌'}`);
        console.log(`VM Mobius: ${results.vmMobius ? '✅' : '❌'}`);
        console.log(`End-to-End: ${results.endToEnd ? '✅' : '❌'}`);

        const allPassed = Object.values(results).every(result => result);
        
        if (allPassed) {
            console.log('\n🎉 All tests passed! Docker setup is working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Check the deployment.');
            console.log('\n📋 Quick Fixes:');
            console.log('1. Local Machine: npm run deploy-local');
            console.log('2. VM: npm run deploy-vm');
            console.log('3. Check docker-compose.yml configuration');
        }

        return results;
    }
}

// Export for use
module.exports = { DockerSetupTester };

// Run tests if called directly
if (require.main === module) {
    const tester = new DockerSetupTester();
    tester.runAllTests().catch(console.error);
} 
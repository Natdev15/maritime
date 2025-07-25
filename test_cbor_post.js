const axios = require('axios');
const cbor = require('cbor');

// Sample container batch (simulate ESP32/master/Locust)
const containers = [
  {
    containerId: 'CBOR0001',
    data: {
      msisdn: '393315537800',
      iso6346: 'CBOR0001',
      time: '250725 120000.0',
      rssi: '25',
      cgi: '999-01-1-31D41',
      'ble-m': '0',
      'bat-soc': '80',
      acc: '0.1234 0.5678 0.9101',
      temperature: '22.5',
      humidity: '55.0',
      pressure: '1013.25',
      door: 'O',
      gnss: '1',
      latitude: '31.1234',
      longitude: '28.5678',
      altitude: '12.34',
      speed: '5.0',
      heading: '90.0',
      nsat: '08',
      hdop: '1.2',
      timestamp: new Date().toISOString()
    }
  },
  {
    containerId: 'CBOR0002',
    data: {
      msisdn: '393315537801',
      iso6346: 'CBOR0002',
      time: '250725 120005.0',
      rssi: '27',
      cgi: '999-01-1-31D41',
      'ble-m': '0',
      'bat-soc': '78',
      acc: '0.2234 0.6678 0.8101',
      temperature: '23.1',
      humidity: '54.0',
      pressure: '1012.80',
      door: 'D',
      gnss: '1',
      latitude: '31.2234',
      longitude: '28.6678',
      altitude: '13.34',
      speed: '6.0',
      heading: '91.0',
      nsat: '09',
      hdop: '1.1',
      timestamp: new Date().toISOString()
    }
  }
];

async function main() {
  // CBOR encode the batch
  const cborBuffer = cbor.encode(containers);
  const base64 = cborBuffer.toString('base64');

  // Prepare metadata
  const metadata = {
    compressionType: 'cbor',
    originalSize: JSON.stringify(containers).length,
    encodedSize: cborBuffer.length,
    encodingRatio: (JSON.stringify(containers).length / cborBuffer.length).toFixed(2),
    timestamp: new Date().toISOString(),
    sourceNode: 'test_cbor_post.js'
  };

  // POST to slave endpoint
  try {
    const response = await axios.post('http://localhost:3001/api/receive-compressed', {
      compressedData: base64,
      metadata
    });
    console.log('✅ Server response:', response.data);
  } catch (err) {
    if (err.response) {
      console.error('❌ Server error:', err.response.status, err.response.data);
    } else {
      console.error('❌ Request failed:', err.message);
    }
  }
}

main(); 
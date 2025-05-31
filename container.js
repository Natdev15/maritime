// container-real.js
require('dotenv').config();
const axios = require('axios');

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000/ingest';

// the actual JSON payload from your container
const payload = {
  msisdn:      "393315537896",
  iso6346:     "LMCU1231230",
  time:        "200423002014.0",
  rssi:        "26",
  cgi:         "999-01-1-31D41",
  "ble-m":     "0",
  "bat-soc":   "92",
  acc:         "-1010.0407-1.4649-4.3947",
  temperature: "17.00",
  humidity:    "44.00",
  pressure:    "1012.5043",
  door:        "D",
  gnss:        "1",
  latitude:    "31.8910",
  longitude:   "28.7041",
  altitude:    "38.10",
  speed:       "27.3",
  heading:     "125.31",
  nsat:        "06",
  hdop:        "1.8"
};

(async () => {
  try {
    const res = await axios.post(GATEWAY, payload);
    console.log('→ Sent real payload to gateway');
  } catch (err) {
    console.error('✖ Failed to send payload:', err.message);
  }
})();

// simulate500.js
console.log('🟢 50-container simulator starting…');

require('dotenv').config();
const axios = require('axios');

const GATEWAY_URL    = process.env.GATEWAY_URL    || 'http://localhost:3000/ingest';
const FLUSH_ENDPOINT = process.env.FLUSH_URL      || 'http://localhost:3000/flush';
const NUM_CONTAINERS = parseInt(process.env.NUM_CONTAINERS, 10) || 50;

// build one payload
function makePayload(id) {
  return {
    msisdn:      `3933155378${id}`,
    iso6346:     `LMCU123123${String(id).padStart(2,'0')}`,
    time:        "200423002014.0",
    rssi:        String(Math.floor(Math.random() * 100)),
    cgi:         "999-01-1-31D41",
    "ble-m":     "0",
    "bat-soc":   String(Math.floor(Math.random() * 100)),
    acc:         `${(-1000 + Math.random()*200).toFixed(4)}${(-1.5 + Math.random()*3).toFixed(4)}${(-5 + Math.random()*5).toFixed(4)}`,
    temperature: (15 + Math.random() * 10).toFixed(2),
    humidity:    (30 + Math.random() * 50).toFixed(2),
    pressure:    (1000 + Math.random() * 20).toFixed(4),
    door:        "D",
    gnss:        "1",
    latitude:    (31 + Math.random()).toFixed(4),
    longitude:   (28 + Math.random()).toFixed(4),
    altitude:    (30 + Math.random() * 10).toFixed(2),
    speed:       (20 + Math.random() * 10).toFixed(1),
    heading:     (100 + Math.random() * 100).toFixed(2),
    nsat:        String(Math.floor(4 + Math.random()*8)).padStart(2,'0'),
    hdop:        (0.5 + Math.random() * 2).toFixed(1),
    containerId: id
  };
}

async function sendAll() {
  console.log(`→ Sending ${NUM_CONTAINERS} payloads to ${GATEWAY_URL}`);
  const all = [];
  for (let i = 1; i <= NUM_CONTAINERS; i++) {
    all.push(
      axios.post(GATEWAY_URL, makePayload(i))
        .then(() => {
          if (i % 50 === 0) console.log(`  • sent container ${i}`);
        })
        .catch(err => {
          console.error(`✖ container ${i} error:`, err.code || err.message);
        })
    );
  }
  await Promise.all(all);
  console.log(`✅ All ${NUM_CONTAINERS} ingests done, waiting 1 s before flush…`);
  await new Promise(r => setTimeout(r, 1000));

  console.log(`🔄 Triggering flush at ${FLUSH_ENDPOINT}`);
  try {
    await axios.post(FLUSH_ENDPOINT);
    console.log('✅ Flush triggered');
  } catch (err) {
    console.error('✖ Flush error:', err.code || err.message);
  }
}

sendAll();

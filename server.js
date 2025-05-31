// server.js
require('dotenv').config();

const mqtt   = require('mqtt');
const cbor   = require('cbor');
const zlib   = require('zlib');
const fs     = require('fs');

const TOPIC  = 'upstream/containers';
const MQTT_URL = process.env.MQTT_BROKER_URL;

const clientOpts  = {};
if (process.env.ASTRO_USER) clientOpts.username = process.env.ASTRO_USER;
if (process.env.ASTRO_PASS) clientOpts.password = process.env.ASTRO_PASS;

// Store chunks by batchId
const batches = new Map();

// 1) Connect and subscribe
const client = mqtt.connect(MQTT_URL, clientOpts);

client.on('connect', () => {
  console.log('▶ Server MQTT connected to', MQTT_URL);
  client.subscribe(TOPIC, err => {
    if (err) console.error('✖ Subscribe error', err);
    else      console.log(`✔ Subscribed to ${TOPIC}`);
  });
});

client.on('error', err => {
  console.error('✖ Server MQTT error', err);
});

// 2) Handle incoming chunks
client.on('message', (topic, message) => {
  console.log(`→ Received ${message.length} bytes on ${topic}`);

  // parse our 4-byte header
  const batchId    = message.readUInt16BE(0);
  const chunkIndex = message.readUInt8(2);
  const isLast     = message.readUInt8(3) === 1;
  const chunk      = message.slice(4);

  console.log(`   • batchId=${batchId}, chunkIndex=${chunkIndex}, isLast=${isLast}`);

  // collect chunks
  if (!batches.has(batchId)) {
    batches.set(batchId, []);
  }
  batches.get(batchId)[chunkIndex] = chunk;

  // when last arrives, reassemble & decode
  if (isLast) {
    const all = Buffer.concat(batches.get(batchId));
    batches.delete(batchId);
    console.log(`   ↳ Reassembled batch ${batchId}, ${all.length} bytes total`);

    try {
      const serialized = zlib.inflateSync(all);
      const data = cbor.decode(serialized);
      console.log('   ✔ Decoded:', data);
      saveToDB(data);
    } catch (e) {
      console.error(`✖ Error decompressing/decoding batch ${batchId}:`, e);
    }
  }
});

// 3) Persist decoded JSON to a line-delimited file
function saveToDB(batchArray) {
  batchArray.forEach(obj => {
    fs.appendFileSync('data.log', JSON.stringify(obj) + '\n');
  });
  console.log(`   ▶ Appended ${batchArray.length} records to data.log`);
}

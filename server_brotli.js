// server.js
require('dotenv').config();

const mqtt = require('mqtt');
const cbor = require('cbor');
const zlib = require('zlib');
const fs   = require('fs');

const MQTT_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const TOPIC    = 'upstream/containers';

const clientOpts = {};
if (process.env.ASTRO_USER) clientOpts.username = process.env.ASTRO_USER;
if (process.env.ASTRO_PASS) clientOpts.password = process.env.ASTRO_PASS;

const client = mqtt.connect(MQTT_URL, clientOpts);
client.on('connect', () => {
  console.log('▶ Server MQTT connected to', MQTT_URL);
  client.subscribe(TOPIC, (err) => {
    if (err) console.error('✖ Subscribe error', err);
    else      console.log(`✔ Subscribed to ${TOPIC}`);
  });
});
client.on('error', (e) => console.error('✖ Server MQTT error', e));

// buffer structure: Map<batchId, { total: number, chunks: Map<idx,Buffer> }>
const batches = new Map();

client.on('message', (topic, message) => {
  // 1) parse 4-byte header
  const batchId     = message.readUInt16BE(0);
  const chunkIndex  = message.readUInt8(2);
  const totalChunks = message.readUInt8(3);
  const chunkBuf    = message.slice(4);

  console.log(`→ Got chunk ${chunkIndex + 1}/${totalChunks} for batch ${batchId} (${chunkBuf.length} B)`);

  // 2) stash chunk
  if (!batches.has(batchId)) {
    batches.set(batchId, { total: totalChunks, chunks: new Map() });
  }
  const entry = batches.get(batchId);
  if (!entry.chunks.has(chunkIndex)) {
    entry.chunks.set(chunkIndex, chunkBuf);
    console.log(`  • collected ${entry.chunks.size}/${entry.total} chunks`);
  }

  // 3) once we have them all, reassemble + decode
  if (entry.chunks.size === entry.total) {
    console.log(`  ↳ ALL ${entry.total} chunks received for batch ${batchId} — reassembling…`);

    // order by chunkIndex
    const buffers = [];
    for (let i = 0; i < entry.total; i++) {
      buffers.push(entry.chunks.get(i));
    }
    const compressed = Buffer.concat(buffers);
    batches.delete(batchId);
    console.log(`    • reassembled payload: ${compressed.length} bytes`);

    // 4) Brotli-decompress
    let raw;
    try {
      raw = zlib.brotliDecompressSync(compressed);
      console.log(`    • brotliDecompress → ${raw.length} bytes of CBOR`);
    } catch (e) {
      return console.error('✖ brotliDecompressSync failed:', e);
    }

    // 5) CBOR decode
    let records;
    try {
      records = cbor.decode(raw);
      console.log(`    • cbor.decode → ${records.length} record(s)`);
    } catch (e) {
      return console.error('✖ CBOR.decode failed:', e);
    }

    // 6) persist (line-delimited JSON)
    records.forEach(obj => {
      fs.appendFileSync('data.log', JSON.stringify(obj) + '\n');
    });
    console.log(`    • Appended ${records.length} records to data.log`);
  }
});

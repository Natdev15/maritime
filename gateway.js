// gateway.js
require('dotenv').config();

const express    = require('express');
const bodyParser = require('body-parser');
const mqtt       = require('mqtt');
const cbor       = require('cbor');
const zlib       = require('zlib');

const app         = express();
app.use(bodyParser.json());

const MQTT_URL    = process.env.MQTT_BROKER_URL;
const TOPIC       = 'upstream/containers';
const MTU_BYTES   = 800;

const clientOpts  = {};
if (process.env.ASTRO_USER) clientOpts.username = process.env.ASTRO_USER;
if (process.env.ASTRO_PASS) clientOpts.password = process.env.ASTRO_PASS;

const client = mqtt.connect(MQTT_URL, clientOpts);

client.on('connect', () => {
  console.log('▶ Gateway MQTT connected to', MQTT_URL);
});
client.on('error', err => {
  console.error('✖ Gateway MQTT error', err);
});

// In-memory buffer of incoming JSONs
let buffer = [];
const MAX_BATCH = 200;
const FLUSH_MS  = 30_000; // 30 seconds

// Batch ID counter for chunk headers
let batchCounter = 0;

// 1) Ingest endpoint
app.post('/ingest', (req, res) => {
  buffer.push(req.body);
  if (buffer.length >= MAX_BATCH) flush();
  res.sendStatus(204);
});

// 2) Manual flush (dev only)
app.post('/flush', (req, res) => {
  console.log(`🔄 Manual flush requested (${buffer.length} messages buffered)`);
  flush();
  res.sendStatus(204);
});

// 3) Flush logic: serialize → compress → chunk → publish
function flush() {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];

  console.log(`🚀 Flushing ${batch.length} messages`);

  // a) CBOR‐encode the array of JSON
  const serialized = cbor.encode(batch);

  // b) DEFLATE‐compress
  const compressed = zlib.deflateSync(serialized);

  // c) Chunk into MTU‐sized pieces with a 4-byte header
  const batchId     = batchCounter++ & 0xFFFF;
  const totalChunks = Math.ceil(compressed.length / MTU_BYTES);

  for (let i = 0; i < totalChunks; i++) {
    const start  = i * MTU_BYTES;
    const chunk  = compressed.slice(start, start + MTU_BYTES);
    const header = Buffer.alloc(4);

    header.writeUInt16BE(batchId, 0);                 // bytes 0–1: batchId
    header.writeUInt8(i,     2);                      // byte 2: chunk index
    header.writeUInt8(i === totalChunks - 1 ? 1 : 0, 3); // byte 3: isLast flag

    client.publish(TOPIC, Buffer.concat([header, chunk]));
  }
}

// d) Auto-flush on interval
setInterval(flush, FLUSH_MS);

// e) Start HTTP server
const port = process.env.INGEST_PORT || 3000;
app.listen(port, () => {
  console.log(`▶ Gateway HTTP listening on http://localhost:${port}`);
});

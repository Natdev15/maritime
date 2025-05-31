// gateway.js
require('dotenv').config();
const fs         = require('fs');
const yaml       = require('js-yaml');
const express    = require('express');
const bodyParser = require('body-parser');
const mqtt       = require('mqtt');
const cbor       = require('cbor');
const zlib       = require('zlib');

// —– load YAML config —–
const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));

// express + MQTT setup
const app       = express();
app.use(bodyParser.json());

const MQTT_URL  = config.mqttBrokerUrl;
const TOPIC     = config.topic;
const MTU_BYTES = config.mtuBytes;

const clientOpts = {};
if (process.env.ASTRO_USER) clientOpts.username = process.env.ASTRO_USER;
if (process.env.ASTRO_PASS) clientOpts.password = process.env.ASTRO_PASS;
const client = mqtt.connect(MQTT_URL, clientOpts);

client.on('connect', () => console.log('▶ MQTT connected to', MQTT_URL));
client.on('error', e => console.error('✖ MQTT error', e));

// in-memory buffer
let buffer       = [];
const MAX_BATCH  = config.batchSize;
const FLUSH_MS   = config.flushIntervalMs;
let batchCounter = 0;

// ingest endpoint
app.post('/ingest', (req, res) => {
  buffer.push(req.body);
  if (buffer.length >= MAX_BATCH) flush();
  res.sendStatus(204);
});

// manual flush
app.post('/flush', (req, res) => {
  console.log(`🔄 Manual flush requested (${buffer.length} msgs)`);
  flush();
  res.sendStatus(204);
});

function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0);

  console.log(`🚀 Flushing ${batch.length} messages`);

  // 1) raw JSON size
  const rawJson = JSON.stringify(batch);
  const rawSize = Buffer.byteLength(rawJson, 'utf8');
  console.log(` • Raw JSON size: ${rawSize} bytes`);

  // 2) CBOR encode
  const serialized = cbor.encode(batch);
  console.log(` • CBOR size:      ${serialized.length} bytes`);

  // 3) Brotli compress
  const compressed = zlib.brotliCompressSync(serialized, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: config.brotli.quality,
      [zlib.constants.BROTLI_PARAM_MODE]:    zlib.constants[
        `BROTLI_MODE_${config.brotli.mode.toUpperCase()}`
      ]
    }
  });
  console.log(` • Brotli size:    ${compressed.length} bytes`);

  // 4) chunk & publish
  const batchId      = batchCounter++ & 0xFFFF;
  const totalChunks = Math.ceil(compressed.length / MTU_BYTES);
  console.log(` → Sending ${totalChunks} chunk(s), MTU ${MTU_BYTES} bytes`);

  for (let i = 0; i < totalChunks; i++) {
    const start  = i * MTU_BYTES;
    const chunk  = compressed.slice(start, start + MTU_BYTES);
    const header = Buffer.alloc(4);

    header.writeUInt16BE(batchId, 0);      // bytes 0–1: batchId
    header.writeUInt8(i,          2);      // byte  2: chunkIndex
    header.writeUInt8(totalChunks, 3);     // byte  3: totalChunks

    client.publish(TOPIC, Buffer.concat([header, chunk]));
  }
}

setInterval(flush, FLUSH_MS);

app.listen(config.ingestPort, () => {
  console.log(`▶ HTTP listening on http://localhost:${config.ingestPort}`);
});

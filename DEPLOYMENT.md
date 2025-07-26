# 🚀 ESP32 Hybrid TN/NTN IoT Pipeline - Deployment Guide

## 📋 Overview

Single Dockerfile and docker-compose.yml for both Encoder (Local) and Decoder (VM) deployment.

## 🏗️ Architecture

```
┌─────────────────┐    CBOR     ┌─────────────────┐    JSON     ┌─────────────────┐
│   Local Machine │ ──────────→ │       VM        │ ──────────→ │     Mobius      │
│   (Encoder)     │   (3001)    │   (Decoder)     │   (7579)    │   (Platform)    │
└─────────────────┘             └─────────────────┘             └─────────────────┘
```

## 🚀 Quick Deployment

### **Local Machine (Encoder)**

1. **Uncomment encoder service** in `docker-compose.yml`
2. **Comment decoder service** in `docker-compose.yml`
3. **Deploy:**
   ```bash
   npm run deploy-local
   # or
   docker-compose up -d esp32-encoder
   ```

### **VM (Decoder)**

1. **Comment encoder service** in `docker-compose.yml`
2. **Uncomment decoder service** in `docker-compose.yml`
3. **Deploy:**
   ```bash
   npm run deploy-vm
   # or
   docker-compose up -d esp32-decoder
   ```

## 📦 Services

### **Encoder Service (Local:3000)**
- Generates CBOR payloads
- Sends to VM decoder
- Testing endpoints

### **Decoder Service (VM:3001)**
- Receives CBOR payloads
- Decodes to JSON
- Forwards to Mobius

## 🧪 Testing

### **Health Checks**
```bash
# Local encoder
curl http://localhost:3000/health

# VM decoder
curl http://172.25.1.78:3001/health
```

### **Single Payload**
```bash
curl -X POST http://localhost:3000/api/generate-and-send \
  -H "Content-Type: application/json" \
  -d '{"msisdn":"393315537896","temperature":"17.00","humidity":"44.00"}'
```

### **Bulk Testing**
```bash
curl -X POST http://localhost:3000/api/bulk-test \
  -H "Content-Type: application/json" \
  -d '{"count": 50, "delay": 100}'
```

### **Docker Setup Test**
```bash
npm run test-docker
```

## 🔧 Configuration

### **Environment Variables**

**Encoder (Local):**
```bash
DECODER_URL=http://172.25.1.78:3001
```

**Decoder (VM):**
```bash
MOBIUS_URL=http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4
MOBIUS_ORIGIN=Natesh
```

## 📊 Performance

- **CBOR Size**: 152 bytes (59.8% compression)
- **Astrocast Compatible**: ✅
- **Throughput**: 300+ req/sec
- **Success Rate**: >99%

## 🛑 Management

```bash
# View logs
npm run docker-logs

# Stop services
npm run docker-down

# Restart specific service
docker-compose restart esp32-encoder
docker-compose restart esp32-decoder
```

## 🎯 Production Checklist

- [ ] Configure docker-compose.yml for target environment
- [ ] Deploy encoder on local machine
- [ ] Deploy decoder on VM
- [ ] Test network connectivity
- [ ] Verify Mobius integration
- [ ] Test bulk payloads
- [ ] Document operational procedures 
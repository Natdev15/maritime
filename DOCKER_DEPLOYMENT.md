# 🐳 Astrocast CBOR Pipeline - Docker Deployment Guide

## 📋 Overview

This guide explains how to deploy the **Astrocast-optimized CBOR pipeline** using Docker containers.

**Pipeline**: ESP32 → Astrocast → Slave → Mobius  
**Payload Limit**: <160 bytes per message  
**Compression**: 85% (58 bytes from 378 bytes)

## 🏗️ Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    ESP32    │───▶│   Master    │───▶│    Slave    │───▶│   Mobius    │
│  (Device)   │    │  (Local)    │    │    (VM)     │    │  (VM)       │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                        │                     │
                   CBOR Compress         CBOR Decompress
                   (58 bytes)           + oneM2M Headers
```

## 📁 Files Structure

```
maritime-serializer/
├── Dockerfile.astrocast          # Docker image for both Master/Slave
├── docker-compose.local.yml      # Local Master deployment
├── docker-compose.vm.yml         # VM Slave deployment
├── deploy-master.sh              # Master deployment script (Linux/Mac)
├── deploy-master.ps1             # Master deployment script (Windows)
├── deploy-slave.sh               # Slave deployment script (VM)
├── astrocast-server.js           # Main server application
├── extreme-astrocast-cbor.js     # CBOR optimization engine
└── test-astrocast-pipeline.js    # Load testing framework
```

## 🚀 Deployment Steps

### Step 1: Deploy Master Node (Local Machine)

**Windows (PowerShell):**
```powershell
.\deploy-master.ps1
```

**Linux/Mac (Bash):**
```bash
chmod +x deploy-master.sh
./deploy-master.sh
```

**Manual Docker:**
```bash
docker-compose -f docker-compose.local.yml up -d --build
```

### Step 2: Deploy Slave Node (VM)

**On your VM:**
```bash
chmod +x deploy-slave.sh
./deploy-slave.sh
```

**Manual Docker:**
```bash
docker-compose -f docker-compose.vm.yml up -d --build
```

### Step 3: Verify Deployment

**Check Master (Local):**
```bash
curl http://localhost:3000/api/health
```

**Check Slave (VM):**
```bash
curl http://localhost:3001/api/health
```

**Test Connectivity (Local → VM):**
```bash
curl http://172.25.1.78:3001/api/health
```

## 🔧 Configuration

### Master Node Environment Variables

```yaml
environment:
  - NODE_MODE=master
  - NODE_ENV=production
  - PORT=3000
  - SLAVE_URL=http://172.25.1.78:3001/api/receive-compressed
```

### Slave Node Environment Variables

```yaml
environment:
  - NODE_MODE=slave
  - NODE_ENV=production
  - PORT=3000
  - MOBIUS_URL=http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4
```

## 🧪 Testing

### Load Testing

**Individual Mode:**
```bash
node test-astrocast-pipeline.js individual --total=100 --rate=500
```

**Batch Mode:**
```bash
node test-astrocast-pipeline.js batch --total=1000
```

### Manual Testing

**Send test data to Master:**
```bash
curl -X POST http://localhost:3000/api/container \
  -H "Content-Type: application/json" \
  -d '{
    "con": {
      "msisdn": "393315537896",
      "time": "200423 002014.0",
      "latitude": "31.8910",
      "longitude": "28.7041",
      "temperature": "17.00",
      "humidity": "44.00",
      "bat-soc": "92",
      "door": "D"
    },
    "metadata": {
      "deviceId": "ESP32_MARITIME_001",
      "networkType": "astrocast"
    }
  }'
```

## 📊 Monitoring

### Container Logs

**Master Node:**
```bash
docker-compose -f docker-compose.local.yml logs -f astrocast-master
```

**Slave Node:**
```bash
docker-compose -f docker-compose.vm.yml logs -f astrocast-slave
```

### Health Checks

**Master Health:**
```bash
curl http://localhost:3000/api/health
```

**Slave Health:**
```bash
curl http://localhost:3001/api/health
```

**Master Status:**
```bash
curl http://localhost:3000/api/status
```

## 🔍 Troubleshooting

### Common Issues

1. **Container won't start:**
   ```bash
   docker-compose -f docker-compose.local.yml logs astrocast-master
   ```

2. **Network connectivity issues:**
   ```bash
   # Test VM connectivity
   ping 172.25.1.78
   telnet 172.25.1.78 3001
   ```

3. **Port conflicts:**
   ```bash
   # Check port usage
   netstat -tlnp | grep :3000
   netstat -tlnp | grep :3001
   ```

4. **Permission issues:**
   ```bash
   # Fix script permissions
   chmod +x deploy-*.sh
   ```

### Reset Deployment

**Complete reset:**
```bash
# Stop all containers
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.vm.yml down

# Remove volumes
docker volume prune

# Rebuild and restart
docker-compose -f docker-compose.local.yml up -d --build
docker-compose -f docker-compose.vm.yml up -d --build
```

## 📈 Performance Metrics

### Astrocast Optimization Results

- **Original Size**: 378 bytes
- **Compressed Size**: 58 bytes
- **Compression Ratio**: 85%
- **Astrocast Compatible**: ✅ YES
- **Bytes Remaining**: 102 bytes

### Essential Fields Preserved

1. `msisdn` - Device identifier
2. `time` - Timestamp
3. `latitude` - GPS latitude
4. `longitude` - GPS longitude
5. `temperature` - Environmental data
6. `humidity` - Environmental data
7. `bat-soc` - Battery status
8. `door` - Container status

## 🔐 Security Considerations

1. **Network Security**: Ensure proper firewall rules
2. **Container Security**: Running as non-root user
3. **Data Encryption**: Consider TLS for production
4. **Access Control**: Implement authentication if needed

## 📚 Additional Resources

- [Astrocast Documentation](https://www.astrocast.com/)
- [oneM2M Standards](https://www.onem2m.org/)
- [CBOR Specification](https://cbor.io/)
- [Docker Documentation](https://docs.docker.com/)

## 🆘 Support

For issues or questions:
1. Check container logs
2. Verify network connectivity
3. Test individual components
4. Review configuration files 
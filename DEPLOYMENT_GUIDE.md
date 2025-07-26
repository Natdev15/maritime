# 🚢 Astrocast Maritime Pipeline - Deployment Guide

## 📋 Overview

This guide explains how to deploy the Astrocast Maritime Pipeline using a single `docker-compose.yml` file for both Master and Slave nodes.

## 🏗️ Architecture

```
ESP32 → Astrocast → Master Node (Local) → Slave Node (VM) → Mobius
```

## 📁 Files Required

- `docker-compose.yml` (single file for both deployments)
- `astrocast-server.js`
- `extreme-astrocast-cbor.js`
- `Dockerfile.astrocast`
- `package.json`
- `test-astrocast-pipeline.js`

## 🚀 Deployment Instructions

### **Option 1: Local Development (Both Master & Slave)**

**For testing both nodes locally:**

1. **Keep the current configuration** (Master active, Slave commented)
2. **Run the pipeline:**
   ```bash
   docker-compose up -d --build
   ```
3. **Test the pipeline:**
   ```bash
   node test-astrocast-pipeline.js individual --total=10 --rate=1000
   ```

### **Option 2: Production Deployment (Master Local, Slave VM)**

#### **Step 1: Deploy Master Node (Local Machine)**

1. **Keep current configuration** (Master active, Slave commented)
2. **Deploy Master:**
   ```bash
   docker-compose up -d --build
   ```
3. **Verify Master is running:**
   ```bash
   curl http://localhost:3000/api/health
   ```

#### **Step 2: Deploy Slave Node (VM)**

1. **Copy files to VM:**
   ```bash
   scp docker-compose.yml user@172.25.1.78:/path/to/deployment/
   scp astrocast-server.js user@172.25.1.78:/path/to/deployment/
   scp extreme-astrocast-cbor.js user@172.25.1.78:/path/to/deployment/
   scp Dockerfile.astrocast user@172.25.1.78:/path/to/deployment/
   scp package.json user@172.25.1.78:/path/to/deployment/
   ```

2. **On VM, modify docker-compose.yml:**
   ```bash
   # Comment out Master section
   # astrocast-master:
   #   ...
   
   # Uncomment Slave section
   astrocast-slave:
     build:
       context: .
       dockerfile: Dockerfile.astrocast
     ports:
       - "3001:3000"
     volumes:
       - slave_data:/app/data
     environment:
       - NODE_MODE=slave
       - NODE_ENV=production
       - PORT=3000
       - MOBIUS_URL=http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4
     restart: unless-stopped
     networks:
       - astrocast-local-network
   ```

3. **Deploy Slave on VM:**
   ```bash
   docker-compose up -d --build
   ```

4. **Verify Slave is running:**
   ```bash
   curl http://172.25.1.78:3001/api/health
   ```

#### **Step 3: Update Master Configuration (Local Machine)**

1. **Update SLAVE_URL in docker-compose.yml:**
   ```yaml
   environment:
     - SLAVE_URL=http://172.25.1.78:3001/api/receive-compressed
   ```

2. **Restart Master:**
   ```bash
   docker-compose restart
   ```

#### **Step 4: Test Full Pipeline**

```bash
node test-astrocast-pipeline.js individual --total=10 --rate=1000
```

## 🔧 Configuration Options

### **Master Node Environment Variables:**
- `NODE_MODE=master`
- `PORT=3000`
- `SLAVE_URL=http://astrocast-slave:3000/api/receive-compressed` (local)
- `SLAVE_URL=http://172.25.1.78:3001/api/receive-compressed` (VM)

### **Slave Node Environment Variables:**
- `NODE_MODE=slave`
- `PORT=3000`
- `MOBIUS_URL=http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4`

## 📊 Monitoring

### **Check Container Status:**
```bash
docker-compose ps
```

### **View Logs:**
```bash
# Master logs
docker-compose logs -f astrocast-master

# Slave logs
docker-compose logs -f astrocast-slave
```

### **Health Checks:**
```bash
# Master health
curl http://localhost:3000/api/health

# Slave health
curl http://172.25.1.78:3001/api/health
```

## 🛠️ Troubleshooting

### **Common Issues:**

1. **Port Already in Use:**
   ```bash
   # Check what's using the port
   netstat -tlnp | grep 3000
   
   # Stop conflicting services
   docker-compose down
   ```

2. **Network Connectivity:**
   ```bash
   # Test connectivity to VM
   ping 172.25.1.78
   telnet 172.25.1.78 3001
   ```

3. **Container Not Starting:**
   ```bash
   # Check logs
   docker-compose logs
   
   # Rebuild containers
   docker-compose up -d --build --force-recreate
   ```

## 📈 Performance Metrics

### **Expected Results:**
- **Compression:** 85% (385 → 58 bytes)
- **Astrocast Compatible:** ✅ (<160 bytes)
- **Response Time:** ~130ms average
- **Success Rate:** 100%

### **Load Testing:**
```bash
# Light load
node test-astrocast-pipeline.js individual --total=10 --rate=1000

# Medium load
node test-astrocast-pipeline.js individual --total=100 --rate=5000

# Heavy load
node test-astrocast-pipeline.js individual --total=1000 --rate=10000
```

## 🔄 Quick Switch Commands

### **Switch to Master Only (Local):**
```bash
# Comment out Slave section in docker-compose.yml
docker-compose up -d --build
```

### **Switch to Slave Only (VM):**
```bash
# Comment out Master section, uncomment Slave section
docker-compose up -d --build
```

### **Switch to Both (Local Testing):**
```bash
# Uncomment both sections
docker-compose up -d --build
```

## ✅ Verification Checklist

- [ ] Master container running on port 3000
- [ ] Slave container running on port 3001 (VM)
- [ ] Health endpoints responding
- [ ] Pipeline test successful
- [ ] Mobius receiving data (201 Created)
- [ ] Logs showing successful compression/decompression

---

**🎯 This single docker-compose.yml file provides maximum flexibility for deployment scenarios!** 
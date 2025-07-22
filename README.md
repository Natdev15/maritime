# Maritime Container Tracker

A high-performance maritime container tracking system with master-slave architecture, designed for efficient data collection, compression, and transmission from remote maritime locations to data centers.

## Table of Contents

- [Overview](#overview)
- [Master-Slave Architecture](#master-slave-architecture)
- [Environment Configuration](#environment-configuration)
- [Quick Start](#quick-start)
- [API Endpoints](#api-endpoints)
- [Docker Deployment](#docker-deployment)
- [Error Messages & Troubleshooting](#error-messages--troubleshooting)
- [Monitoring & Statistics](#monitoring--statistics)
- [Testing](#testing)

## Overview

The Maritime Container Tracker supports a master-slave architecture where:

- **Master nodes** collect data from small remote locations (ships, ports) and periodically send compressed data to slaves
- **Slave nodes** receive compressed data, decompress it, and forward it to the main data center

### Key Features

- **Brotli Compression**: Advanced compression for efficient data transmission
- **Automatic Data Cleanup**: Masters delete data after successful transmission
- **Strict Environment Validation**: Won't start without proper configuration
- **Real-time Monitoring**: Health checks and detailed statistics
- **Scheduled Transmission**: Configurable intervals (default: 6 hours)
- **SQLite Storage**: High-performance local data storage with WAL mode

## Master-Slave Architecture

### Data Flow

1. **Master** collects container data via HTTP endpoints
2. **Master** stores data locally with compression
3. **Master** scheduled task (every 6 hours):
   - Retrieves ALL container data from database
   - Decompresses it to original JSON
   - Compresses all data together for efficient transmission
   - Sends to slave via HTTP POST
   - **Deletes all data from database after successful transmission**
4. **Slave** receives compressed data at `/api/receive-compressed`
5. **Slave** decompresses the data
6. **Slave** forwards decompressed data to final destination

### Important Notes

#### Environment Variables are Required

**The application will NOT start without proper environment variables!** If required variables are missing, you'll see a detailed error message with setup instructions.

#### Data Cleanup Behavior

**Master nodes automatically delete all data after successful transmission.** This means:
- Every 6 hours, master compresses and sends ALL data
- After successful transmission, the database is completely cleared
- If transmission fails, data is retained for the next attempt

## Environment Configuration

### Required Configuration

```bash
# Node type - REQUIRED
NODE_TYPE=master  # or "slave"
```

### Master Mode Configuration

When `NODE_TYPE=master`, the following variables are required:

```bash
NODE_TYPE=master
SEND_TO_URL=http://slave-server:3000/api/receive-compressed
```

Optional master configuration:

```bash
# How often to compress and send data (hours, default: 6)
COMPRESSION_SCHEDULE_HOURS=6

# Run compression task immediately on startup (default: false)
RUN_COMPRESSION_ON_START=false

# Server port (default: 3000)
PORT=3000
```

### Slave Mode Configuration

When `NODE_TYPE=slave`, the following variables are required:

```bash
NODE_TYPE=slave
FORWARD_TO_URL=http://data-center:8080/api/containers/bulk
```

Optional slave configuration:

```bash
# Server port (default: 3000)
PORT=3000
```

### Example Configurations

#### Remote Ship Master Node

```bash
# .env file for master node on remote ship
NODE_TYPE=master
SEND_TO_URL=https://datacenter.maritime.com:3000/api/receive-compressed
COMPRESSION_SCHEDULE_HOURS=6
PORT=3000
```

#### Data Center Slave Node

```bash
# .env file for slave node at data center
NODE_TYPE=slave
FORWARD_TO_URL=https://analytics.maritime.com:8080/api/container-data
PORT=3000
```

## Quick Start

### Prerequisites

```bash
npm install
```

### Start Master Node

```bash
NODE_TYPE=master SEND_TO_URL=http://slave:3000/api/receive-compressed npm start
```

### Start Slave Node

```bash
NODE_TYPE=slave FORWARD_TO_URL=http://datacenter:8080/api/data npm start
```

### Using Helper Scripts

```bash
# Smart startup with validation
npm run start-master      # Requires SEND_TO_URL environment variable
npm run start-slave       # Requires FORWARD_TO_URL environment variable
npm run setup-help        # Complete setup guide

# Or use the bash script directly
bash start-examples.sh master
bash start-examples.sh slave
bash start-examples.sh help
```

## API Endpoints

### Master Mode Available Endpoints

- ✅ `POST /api/container` - Single container ingestion
- ✅ `POST /api/containers/bulk` - Bulk container ingestion
- ✅ `POST /api/compress-send` - Manual compression trigger
- ✅ `GET /api/scheduler/stats` - Scheduler statistics
- ✅ `GET /api/containers` - View container data
- ✅ `GET /api/stats` - System statistics
- ✅ `GET /api/health` - Health check

### Slave Mode Available Endpoints

- ✅ `POST /api/receive-compressed` - Receive compressed data from master
- ✅ `GET /api/stats` - System statistics
- ✅ `GET /api/health` - Health check
- 🚫 All master endpoints are disabled (returns 403/404)

### Common Endpoints (Both Modes)

- `GET /api/health` - Health check with node type information
- `GET /api/stats` - System statistics (master includes scheduler stats)

### Data Formats

#### Container Data Input (Master)

```json
{
  "containerId": "CONT000001",
  "iso6346": "LMCU1234567",
  "msisdn": "393315537800",
  "time": "20241201120000",
  "rssi": "85",
  "cgi": "999-01-1-31D41",
  "ble-m": "0",
  "bat-soc": "75",
  "acc": "-1000.1234-1.2345-4.5678",
  "temperature": "22.5",
  "humidity": "65.2",
  "pressure": "1013.25",
  "door": "D",
  "gnss": "1",
  "latitude": "31.2304",
  "longitude": "28.4567",
  "altitude": "30.5",
  "speed": "15.2",
  "heading": "270.5",
  "nsat": "08",
  "hdop": "1.2",
  "timestamp": "2024-12-01T12:00:00.000Z"
}
```

#### Master → Slave (Compressed)

```json
{
  "compressedData": "base64-encoded-brotli-compressed-data",
  "metadata": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "sourceNode": "master",
    "compressionType": "brotli",
    "originalSize": 1048576,
    "compressionRatio": 8.5,
    "containerCount": 1000
  }
}
```

#### Slave → Destination (Decompressed)

```json
{
  "containers": [
    {
      "id": 1,
      "containerId": "CONT000001",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "data": { /* original container data */ }
    }
  ],
  "metadata": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "sourceNode": "slave",
    "containerCount": 1000,
    "processedAt": "2024-01-01T12:00:01.000Z"
  }
}
```

## Docker Deployment

### Quick Start with Docker

#### Option 1: Using Existing Database File

```bash
# Place your database file in the project directory
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f maritime-tracker

# Stop the container
docker-compose down
```

#### Option 2: Using Existing Data Directory

```bash
# Edit docker-compose.yml and uncomment this line:
# - ./data:/app/data

# Then start the container
docker-compose up -d
```

#### Option 3: Fresh Database (Default)

```bash
# Comment out the volume line in docker-compose.yml:
# # - ./maritime_containers.db:/app/data/maritime_containers.db

docker-compose up -d
```

### Using Docker Directly

#### Master Node Container

```bash
# Build the image
docker build -t maritime-tracker .

# Run master node
docker run -d \
  --name maritime-master \
  -p 3000:3000 \
  -e NODE_TYPE=master \
  -e SEND_TO_URL=http://slave-container:3000/api/receive-compressed \
  -v $(pwd)/data:/app/data \
  maritime-tracker
```

#### Slave Node Container

```bash
# Run slave node
docker run -d \
  --name maritime-slave \
  -p 3001:3000 \
  -e NODE_TYPE=slave \
  -e FORWARD_TO_URL=http://datacenter:8080/api/data \
  -v maritime_slave_data:/app/data \
  maritime-tracker
```

### Data Persistence

- **Host Mount**: `./maritime_containers.db` ↔ `/app/data/maritime_containers.db`
- **Volume Mount**: `maritime_data:/app/data`
- **Auto Cleanup**: Master deletes data after successful transmission
- **WAL Mode**: SQLite Write-Ahead Logging for better performance

### Management Commands

```bash
# Remove old containers and rebuild
docker-compose down
docker-compose up --build -d

# View volume location
docker volume inspect maritime_data

# Backup data volume
docker run --rm -v maritime_data:/data -v $(pwd):/backup alpine tar czf /backup/maritime_backup.tar.gz -C /data .

# Restore data volume
docker run --rm -v maritime_data:/data -v $(pwd):/backup alpine tar xzf /backup/maritime_backup.tar.gz -C /data
```

## Error Messages & Troubleshooting

### Missing NODE_TYPE

If you try to start without setting `NODE_TYPE`:

```bash
$ npm start
```

**Error Output:**
```

🚢 Maritime Container Tracker - Configuration Error
============================================================

❌ NODE_TYPE environment variable is missing or invalid

📋 NODE_TYPE must be set to either "master" or "slave"

🔧 Setup Instructions:
   For Master Node (collects data from remote locations):
     NODE_TYPE=master
     SEND_TO_URL=http://slave-server:3000/api/receive-compressed

   For Slave Node (receives and forwards data):
     NODE_TYPE=slave
     FORWARD_TO_URL=http://data-center:8080/api/containers/bulk

📖 For more details, see README.md

============================================================

```

### Master Mode Missing SEND_TO_URL

```bash
$ NODE_TYPE=master npm start
```

**Error Output:**
```

🚢 Maritime Container Tracker - Configuration Error
============================================================

❌ SEND_TO_URL environment variable is required in master mode

📋 Master nodes must specify where to send compressed data

🔧 Setup Instructions:
   Set the SEND_TO_URL environment variable:
     SEND_TO_URL=http://slave-server:3000/api/receive-compressed

   Example master configuration:
     NODE_TYPE=master
     SEND_TO_URL=https://datacenter.maritime.com:3000/api/receive-compressed
     COMPRESSION_SCHEDULE_HOURS=6
     PORT=3000

============================================================

```

### Invalid URL Format

```bash
$ NODE_TYPE=master SEND_TO_URL=invalid-url npm start
```

**Error Output:**
```

🚢 Maritime Container Tracker - Configuration Error
============================================================

❌ SEND_TO_URL must be a valid HTTP/HTTPS URL

📋 Invalid URL: invalid-url

🔧 Setup Instructions:
   SEND_TO_URL must be a complete URL with protocol:
     ✅ http://slave-server:3000/api/receive-compressed
     ✅ https://datacenter.maritime.com:3000/api/receive-compressed
     ❌ slave-server:3000/api/receive-compressed
     ❌ slave-server

============================================================

```

### Slave Mode Missing FORWARD_TO_URL

```bash
$ NODE_TYPE=slave npm start
```

**Error Output:**
```

🚢 Maritime Container Tracker - Configuration Error
============================================================

❌ FORWARD_TO_URL environment variable is required in slave mode

📋 Slave nodes must specify where to forward decompressed data

🔧 Setup Instructions:
   Set the FORWARD_TO_URL environment variable:
     FORWARD_TO_URL=http://data-center:8080/api/containers/bulk

   Example slave configuration:
     NODE_TYPE=slave
     FORWARD_TO_URL=https://analytics.maritime.com:8080/api/container-data
     PORT=3000

============================================================

```

### Successful Startup Examples

#### Master Node
```bash
$ NODE_TYPE=master SEND_TO_URL=http://slave:3000/api/receive-compressed npm start

🚢 Maritime Server initializing in master mode
🔧 Configuration validated: master mode
📤 Will send data to: http://slave:3000/api/receive-compressed
⏰ Compression schedule: every 6 hours
Connected to SQLite database
📦 Queue-based batch processor started (2s intervals)
🎯 Setting up master-specific routes
📅 Starting scheduler: every 6 hours (21600000ms)
✅ Scheduler started successfully

🚢 Maritime Container Server running on port 3000 (master mode)
📊 Dashboard: http://localhost:3000
🔌 API: http://localhost:3000/api
💾 Database: SQLite with Brotli compression
📤 Send to: http://slave:3000/api/receive-compressed
⏰ Compression schedule: every 6 hours
⚡ Ready to handle maritime container data
```

#### Slave Node
```bash
$ NODE_TYPE=slave FORWARD_TO_URL=http://datacenter:8080/api/data npm start

🚢 Maritime Server initializing in slave mode
🔧 Configuration validated: slave mode
📨 Will forward data to: http://datacenter:8080/api/data
Connected to SQLite database
📦 Queue-based batch processor started (2s intervals)
🔗 Setting up slave-specific routes

🚢 Maritime Container Server running on port 3000 (slave mode)
📊 Dashboard: http://localhost:3000
🔌 API: http://localhost:3000/api
💾 Database: SQLite with Brotli compression
📨 Forward to: http://datacenter:8080/api/data
⚡ Ready to handle maritime container data
```

## Monitoring & Statistics

### Health Checks

Both nodes expose health endpoints:

```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "nodeType": "master",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600000,
  "config": {
    "nodeType": "master",
    "port": 3000,
    "isMaster": true,
    "isSlave": false,
    "compressionScheduleHours": 6,
    "sendToUrl": "http://slave:3000/api/receive-compressed",
    "forwardToUrl": null
  }
}
```

### System Statistics

```bash
curl http://localhost:3000/api/stats
```

**Master Response (includes scheduler statistics):**
```json
{
  "totalRequests": 1000,
  "successfulWrites": 950,
  "errors": 5,
  "startTime": 1704110400000,
  "nodeType": "master",
  "uptime": 3600000,
  "scheduler": {
    "totalRuns": 10,
    "successfulRuns": 9,
    "failedRuns": 1,
    "lastRunDuration": 5000,
    "totalDataSent": 10485760,
    "totalContainersProcessed": 10000,
    "totalDataCleaned": 9500,
    "cleanupOperations": 9,
    "isRunning": false,
    "lastRun": "2024-01-01T12:00:00.000Z",
    "nextRun": "2024-01-01T18:00:00.000Z"
  }
}
```

### Manual Operations

#### Trigger Manual Compression (Master Only)

```bash
curl -X POST http://localhost:3000/api/compress-send
```

#### Get Scheduler Statistics (Master Only)

```bash
curl http://localhost:3000/api/scheduler/stats
```

## Testing

### Test Scripts

```bash
# Test master-slave functionality
npm run test-master-slave

# Load testing with container data
npm test

# Get setup help
npm run setup-help
```

### Manual Testing

1. **Start both nodes** with proper environment variables
2. **Add test data** to master:
   ```bash
   curl -X POST http://localhost:3000/api/container \
  -H "Content-Type: application/json" \
  -d '{
       "containerId": "TEST001",
       "temperature": "22.5",
       "latitude": "31.2304",
       "longitude": "28.4567",
       "timestamp": "2024-01-01T12:00:00.000Z"
  }'
```
3. **Trigger manual compression**:
   ```bash
   curl -X POST http://localhost:3000/api/compress-send
   ```
4. **Check slave logs** for received and forwarded data
5. **Verify master database** is cleaned after successful transmission

### Environment Validation

The application requires proper environment variables and will provide detailed error messages if they're missing or invalid. Use the helper scripts for guided setup:

```bash
bash start-examples.sh help
```

## Performance

- **Throughput**: 300+ containers/second ingestion
- **Compression**: 5-10x compression ratios with Brotli
- **Storage**: SQLite with WAL mode for high-performance writes
- **Memory**: Batch processing to minimize memory usage
- **Network**: Efficient binary transmission with base64 encoding

## Security

- **Mode Isolation**: Master/slave endpoints are strictly separated
- **Environment Validation**: Prevents startup with invalid configuration
- **CORS**: Cross-origin resource sharing enabled
- **Helmet**: Security middleware for HTTP headers
- **Input Validation**: Container data validation and sanitization

## License

ISC License

## Support

For issues and questions:
1. Check the error messages for detailed setup instructions
2. Review the configuration examples in this README
3. Use `npm run setup-help` for interactive guidance
4. Test with `npm run test-master-slave`

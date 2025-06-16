# Maritime Container Dashboard

A high-performance maritime container tracking system with individual field storage, real-time monitoring, and comprehensive performance analytics.

## Overview

The Maritime Container Dashboard is a Node.js-based system that efficiently collects, processes, and stores maritime container tracking data. It uses individual field storage in SQLite, queue-based batch processing, and provides real-time performance monitoring for optimal throughput and data integrity.

## Architecture

### Components

1. **Server (`server.js`)** - Express HTTP server with API endpoints for data ingestion and monitoring
2. **Database Service (`database.js`)** - SQLite database with queue-based batch processing for high throughput
3. **Web Dashboard (`public/`)** - Real-time web interface for monitoring containers and performance metrics
4. **Load Tester (`test-load.js`)** - Comprehensive testing tool for performance validation

### Data Flow

```
Container Sensors → HTTP API → Queue System → Batch Processing → SQLite Storage
                [Individual]   [Batching]    [Performance]     [Individual
                [Field]        [System]      [Tracking]        [Fields]
                [Storage]
```

## Features

### Data Storage
- **Individual Field Storage**: All container data fields stored separately for optimal query performance
- **No Compression**: Direct storage of all data fields maintains data integrity and speed
- **Queue-Based Batching**: Configurable batch sizes (default: processed every 2 seconds) with automatic flushing
- **Performance Tracking**: Row size and processing time tracked for each record

### Performance Monitoring
- **Real-time Metrics**: Processing time, row sizes, and throughput monitoring
- **Batch Analytics**: Detailed batch processing statistics and performance trends
- **Queue Status**: Live queue monitoring with size and processing status
- **Performance History**: Historical performance data with averages and trends

### Container Data Schema
The system stores comprehensive maritime container tracking data in individual fields:

```sql
CREATE TABLE container_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id TEXT NOT NULL,
  iso6346 TEXT,
  msisdn TEXT,
  time TEXT,
  rssi TEXT,
  cgi TEXT,
  ble_m TEXT,
  bat_soc TEXT,
  acc TEXT,
  temperature REAL,
  humidity REAL,
  pressure REAL,
  door TEXT,
  gnss TEXT,
  latitude REAL,
  longitude REAL,
  altitude REAL,
  speed REAL,
  heading REAL,
  nsat TEXT,
  hdop REAL,
  timestamp INTEGER NOT NULL,
  row_size INTEGER,
  processing_time_ms INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```



## Installation

```bash
npm install
```

### Dependencies
- **express**: Web server framework
- **sqlite3**: SQLite database driver
- **cors**: Cross-origin resource sharing
- **helmet**: Security middleware
- **axios**: HTTP client for testing

## Usage

### 1. Start the Server
```bash
npm start
# or
node server.js
```

The server will start on port 3000 (configurable via PORT environment variable).

### 2. Access the Dashboard
Open your browser to: `http://localhost:3000`

The dashboard provides:
- Real-time container monitoring
- Performance metrics and analytics
- Queue status and batch processing information
- Individual container detail views with full data history

### 3. Send Container Data

**Single container:**
```bash
curl -X POST http://localhost:3000/api/container \
  -H "Content-Type: application/json" \
  -d '{
    "containerId": "CONT000001",
    "iso6346": "LMCU1231230",
    "msisdn": "393315537896",
    "temperature": 17.5,
    "humidity": 44.2,
    "pressure": 1012.5,
    "latitude": 31.8910,
    "longitude": 28.7041,
    "battery": 92,
    "door": "D",
    "gnss": "1"
  }'
```

**Bulk containers:**
```bash
curl -X POST http://localhost:3000/api/containers/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "containers": [
      {"containerId": "CONT000001", "temperature": 17.5, "latitude": 31.8910, "longitude": 28.7041},
      {"containerId": "CONT000002", "temperature": 18.2, "latitude": 31.8920, "longitude": 28.7051}
    ]
  }'
```

### 4. Load Testing

Run comprehensive load tests:

```bash
# Individual container sending
node test-load.js individual --total=100 --records=50 --rate=100

# Bulk container sending  
node test-load.js bulk --total=1000 --records=100

# High-throughput testing
node test-load.js bulk --total=5000 --records=200 --rate=1000
```

## API Endpoints

### Data Ingestion
- `POST /api/container` - Submit single container data
- `POST /api/containers/bulk` - Submit multiple containers

### Data Retrieval
- `GET /api/containers` - Get recent container data with pagination
- `GET /api/containers/:containerId` - Get specific container history

### Monitoring & Analytics
- `GET /api/stats` - Complete system statistics

- `GET /api/queue` - Current queue status
- `GET /api/health` - System health check

### Maintenance
- `POST /api/maintenance/cleanup` - Clean up old records
- `POST /api/maintenance/optimize` - Optimize database
- `POST /api/queue/process` - Force process current queue

## Performance Characteristics

### Storage Efficiency
- **Individual Fields**: Direct field access for optimal query performance
- **Row Size Tracking**: Monitor storage requirements per record
- **Processing Time**: Track database operation performance
- **Batch Optimization**: Efficient batch processing with transaction control

### Throughput Capabilities
- **Queue-Based Processing**: Handle high-volume data ingestion
- **Batch Processing**: Process thousands of records per batch
- **Real-time Monitoring**: Live performance tracking and analytics
- **Scalable Architecture**: Designed for high-throughput maritime data

### Database Optimization
- **SQLite Optimizations**: WAL mode, increased cache, memory mapping
- **Indexing Strategy**: Optimized indexes for common queries
- **Performance Tuning**: Aggressive SQLite settings for maximum speed
- **Maintenance Tools**: Built-in cleanup and optimization utilities

## Performance Monitoring

### Real-time Dashboard
- Container activity charts
- Performance metrics visualization  
- Queue status monitoring
- System statistics overview

### Performance Metrics
- **Row Sizes**: Average and individual record sizes
- **Processing Times**: Per-record and batch processing times
- **Throughput**: Records per second and batch performance
- **Success Rates**: Error tracking and success ratios

### Analytics Features
- Historical performance trends
- Batch processing analytics
- Container-specific performance data
- System health monitoring

## Development & Testing

### Load Testing Options
```bash
# Light testing (development)
node test-load.js individual --total=10 --records=5 --rate=10

# Medium testing  
node test-load.js bulk --total=100 --records=50 --rate=200

# Heavy testing (production validation)
node test-load.js bulk --total=10000 --records=100 --rate=1000
```

### Database Management
```bash
# Check database status
curl http://localhost:3000/api/stats

# Force process queue
curl -X POST http://localhost:3000/api/queue/process

# Clean up old data (keep 30 days)
curl -X POST http://localhost:3000/api/maintenance/cleanup \
  -H "Content-Type: application/json" \
  -d '{"days": 30}'

# Optimize database
curl -X POST http://localhost:3000/api/maintenance/optimize
```

## Configuration

### Environment Variables
```bash
PORT=3000                    # Server port
NODE_ENV=production         # Environment mode
```

### Database Configuration
The system automatically configures SQLite for optimal performance:
- WAL journaling mode for concurrent access
- Increased cache size (100MB)
- Memory-mapped I/O (1GB)
- Optimized page size (4KB)
- Aggressive performance settings

## Error Handling & Reliability

- **Queue Management**: Automatic queue size limits and overflow protection
- **Transaction Safety**: All batch operations use database transactions
- **Error Recovery**: Graceful error handling with detailed logging
- **Performance Monitoring**: Automatic detection of performance issues
- **Data Integrity**: Row-level validation and processing time tracking

## Deployment

### Production Considerations
- Configure appropriate queue sizes for your data volume
- Monitor database file size and implement regular cleanup
- Use performance metrics to optimize batch processing intervals
- Implement log rotation for long-running deployments

### Monitoring Setup
- Enable real-time dashboard access
- Set up alerts for queue overflow conditions
- Monitor database file size growth
- Track performance degradation trends

## License

ISC License - See package.json for details. 
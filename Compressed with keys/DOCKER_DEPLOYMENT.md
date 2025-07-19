# Docker Deployment Guide

## Quick Start

### Option 1: Using Existing Database File

If you have an existing `maritime_containers.db` file:

```bash
# Place your database file in the project directory
# The docker-compose.yml is configured to mount ./maritime_containers.db

# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f maritime-tracker

# Stop the container
docker-compose down
```

### Option 2: Using Existing Data Directory

If you have a `data` directory with database files:

```bash
# Edit docker-compose.yml and uncomment this line:
# - ./data:/app/data

# Then start the container
docker-compose up -d
```

### Option 3: Fresh Database (Default)

If you don't have an existing database, comment out the volume mount in docker-compose.yml:

```bash
# Comment out the volume line in docker-compose.yml:
# # - ./maritime_containers.db:/app/data/maritime_containers.db

docker-compose up -d
```

### Using Docker directly

```bash
# Build the image
docker build -t maritime-tracker .

# Option 1: Mount existing database file
docker run -d \
  --name maritime-tracker \
  -p 3000:3000 \
  -v $(pwd)/maritime_containers.db:/app/data/maritime_containers.db \
  maritime-tracker

# Option 2: Mount existing data directory
docker run -d \
  --name maritime-tracker \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  maritime-tracker

# Option 3: Create new volume
docker run -d \
  --name maritime-tracker \
  -p 3000:3000 \
  -v maritime_data:/app/data \
  maritime-tracker

# View logs
docker logs -f maritime-tracker

# Stop the container
docker stop maritime-tracker
```

## Access

- **Web Dashboard**: http://localhost:3000
- **API Endpoint**: http://localhost:3000/api/container

## Data Persistence

### Current Configuration (Using Existing Database)
- Database file is mounted from your host system: `./maritime_containers.db`
- Changes are immediately reflected on your host disk
- Data is automatically cleaned up after 7 days
- Database persists between container restarts

### File Locations
- **Host**: `./maritime_containers.db` (in your project directory)
- **Container**: `/app/data/maritime_containers.db`

## Configuration

The container uses these defaults:
- **Port**: 3000
- **Data Retention**: 7 days
- **Database**: SQLite with WAL mode
- **Queue Processing**: Every 2 seconds

## Management Commands

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
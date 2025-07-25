#!/bin/bash

# Astrocast Master Node Deployment Script
# Run this on your local machine

echo "🚢 Deploying Astrocast Master Node..."
echo "====================================="

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.local.yml down

# Build and start the master node
echo "🔨 Building and starting Master node..."
docker-compose -f docker-compose.local.yml up -d --build

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 5

# Check container status
echo "📊 Container status:"
docker-compose -f docker-compose.local.yml ps

# Test health endpoint
echo "🏥 Testing health endpoint..."
curl -s http://localhost:3000/api/health | jq .

echo ""
echo "✅ Master node deployment complete!"
echo "📡 Master URL: http://localhost:3000"
echo "🛰️  Astrocast compatible: ✅"
echo "🗜️  Compression: Extreme CBOR"
echo "🌐 Pipeline: ESP32 → Astrocast → Slave → Mobius"
echo ""
echo "📋 Next steps:"
echo "1. Deploy Slave node on VM using: ./deploy-slave.sh"
echo "2. Test the pipeline using: node test-astrocast-pipeline.js" 
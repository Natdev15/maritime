#!/bin/bash

# Astrocast Slave Node Deployment Script
# Run this on your VM

echo "🛰️  Deploying Astrocast Slave Node..."
echo "====================================="

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.vm.yml down

# Build and start the slave node
echo "🔨 Building and starting Slave node..."
docker-compose -f docker-compose.vm.yml up -d --build

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 5

# Check container status
echo "📊 Container status:"
docker-compose -f docker-compose.vm.yml ps

# Test health endpoint
echo "🏥 Testing health endpoint..."
curl -s http://localhost:3001/api/health | jq .

echo ""
echo "✅ Slave node deployment complete!"
echo "📡 Slave URL: http://localhost:3001"
echo "🛰️  Astrocast compatible: ✅"
echo "🗜️  Compression: Extreme CBOR"
echo "🌐 Pipeline: ESP32 → Astrocast → Slave → Mobius"
echo ""
echo "📋 Configuration:"
echo "   Master URL: http://172.25.1.78:3001/api/receive-compressed"
echo "   Mobius URL: http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4"
echo ""
echo "📋 Next steps:"
echo "1. Test connectivity from Master: curl http://172.25.1.78:3001/api/health"
echo "2. Test the complete pipeline from Master node" 
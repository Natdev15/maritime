# Astrocast Master Node Deployment Script (PowerShell)
# Run this on your Windows local machine

Write-Host "🚢 Deploying Astrocast Master Node..." -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Stop any existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml down

# Build and start the master node
Write-Host "🔨 Building and starting Master node..." -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml up -d --build

# Wait for container to start
Write-Host "⏳ Waiting for container to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check container status
Write-Host "📊 Container status:" -ForegroundColor Cyan
docker-compose -f docker-compose.local.yml ps

# Test health endpoint
Write-Host "🏥 Testing health endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Master node deployment complete!" -ForegroundColor Green
Write-Host "📡 Master URL: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🛰️  Astrocast compatible: ✅" -ForegroundColor Green
Write-Host "🗜️  Compression: Extreme CBOR" -ForegroundColor Cyan
Write-Host "🌐 Pipeline: ESP32 → Astrocast → Slave → Mobius" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Deploy Slave node on VM using: ./deploy-slave.sh" -ForegroundColor White
Write-Host "2. Test the pipeline using: node test-astrocast-pipeline.js" -ForegroundColor White 
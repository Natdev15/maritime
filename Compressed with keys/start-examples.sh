#!/bin/bash

# Maritime Container Tracker - Startup Examples
# This script shows how to properly start master and slave nodes

echo "🚢 Maritime Container Tracker - Startup Examples"
echo "================================================"
echo ""

# Check if any arguments provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 [master|slave|help]"
    echo ""
    echo "Examples:"
    echo "  $0 master    - Start master node (requires SEND_TO_URL)"
    echo "  $0 slave     - Start slave node (requires FORWARD_TO_URL)"
    echo "  $0 help      - Show detailed setup instructions"
    exit 1
fi

case $1 in
    "master")
        echo "🎯 Starting Master Node..."
        echo ""
        if [ -z "$SEND_TO_URL" ]; then
            echo "❌ ERROR: SEND_TO_URL environment variable is required"
            echo ""
            echo "Master node example:"
            echo "  SEND_TO_URL=http://slave-server:3000/api/receive-compressed $0 master"
            echo ""
            echo "Or set the environment variable first:"
            echo "  export SEND_TO_URL=http://slave-server:3000/api/receive-compressed"
            echo "  $0 master"
            exit 1
        fi
        
        echo "✅ Configuration:"
        echo "   NODE_TYPE=master"
        echo "   SEND_TO_URL=$SEND_TO_URL"
        echo "   PORT=${PORT:-3000}"
        echo ""
        
        NODE_TYPE=master npm start
        ;;
        
    "slave")
        echo "🔗 Starting Slave Node..."
        echo ""
        if [ -z "$FORWARD_TO_URL" ]; then
            echo "❌ ERROR: FORWARD_TO_URL environment variable is required"
            echo ""
            echo "Slave node example:"
            echo "  FORWARD_TO_URL=http://data-center:8080/api/containers/bulk $0 slave"
            echo ""
            echo "Or set the environment variable first:"
            echo "  export FORWARD_TO_URL=http://data-center:8080/api/containers/bulk"
            echo "  $0 slave"
            exit 1
        fi
        
        echo "✅ Configuration:"
        echo "   NODE_TYPE=slave"
        echo "   FORWARD_TO_URL=$FORWARD_TO_URL"
        echo "   PORT=${PORT:-3000}"
        echo ""
        
        NODE_TYPE=slave npm start
        ;;
        
    "help")
        echo "📖 Detailed Setup Instructions"
        echo "=============================="
        echo ""
        echo "Master Node (collects data from remote locations):"
        echo "  Required: NODE_TYPE=master, SEND_TO_URL"
        echo "  Example:"
        echo "    SEND_TO_URL=http://192.168.1.100:3000/api/receive-compressed \\"
        echo "    COMPRESSION_SCHEDULE_HOURS=6 \\"
        echo "    PORT=3000 \\"
        echo "    $0 master"
        echo ""
        echo "Slave Node (receives and forwards data):"
        echo "  Required: NODE_TYPE=slave, FORWARD_TO_URL"
        echo "  Example:"
        echo "    FORWARD_TO_URL=http://datacenter.maritime.com:8080/api/data \\"
        echo "    PORT=3001 \\"
        echo "    $0 slave"
        echo ""
        echo "Environment Variables:"
        echo "  NODE_TYPE                 - 'master' or 'slave' (REQUIRED)"
        echo "  SEND_TO_URL              - Where master sends data (master only)"
        echo "  FORWARD_TO_URL           - Where slave forwards data (slave only)"
        echo "  COMPRESSION_SCHEDULE_HOURS - How often to compress/send (default: 6)"
        echo "  RUN_COMPRESSION_ON_START - Run compression on startup (default: false)"
        echo "  PORT                     - Server port (default: 3000)"
        echo ""
        echo "Data Flow:"
        echo "  1. Master collects container data"
        echo "  2. Every 6 hours, master compresses ALL data and sends to slave"
        echo "  3. Master DELETES all data after successful transmission"
        echo "  4. Slave receives compressed data, decompresses it"
        echo "  5. Slave forwards decompressed data to final destination"
        echo ""
        echo "Testing:"
        echo "  npm run test-master-slave  - Test master-slave functionality"
        echo ""
        echo "Documentation:"
        echo "  README.md                  - Complete configuration guide and setup instructions"
        ;;
        
    *)
        echo "❌ Unknown option: $1"
        echo "Usage: $0 [master|slave|help]"
        exit 1
        ;;
esac 
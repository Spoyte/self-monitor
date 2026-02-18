#!/bin/bash
# Start the dashboard API server

cd "$(dirname "$0")"

# Check if already running
if pgrep -f "api-server.js" > /dev/null; then
    echo "Dashboard API server is already running"
    echo "Visit: http://localhost:3456"
    exit 0
fi

echo "Starting Dashboard API server..."
node api-server.js &

sleep 2

echo ""
echo "✓ Dashboard API server started!"
echo "Visit: http://localhost:3456"
echo ""
echo "API endpoints:"
echo "  GET /api/dashboard - Full dashboard data"
echo "  GET /api/system    - System stats only"
echo "  GET /api/activity  - Activity data only"

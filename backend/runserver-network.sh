#!/bin/bash
# Run Django server on network interface (accessible from other devices)
# Usage: ./runserver-network.sh

echo "Starting Django server on network interface..."
echo "Server will be accessible at:"
echo "  - http://localhost:8000 (from this computer)"
echo "  - http://192.168.1.13:8000 (from other devices on network)"
echo ""

cd core
python manage.py runserver 0.0.0.0:8000

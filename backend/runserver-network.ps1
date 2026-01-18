# Run Django server on network interface (accessible from other devices)
# Usage: .\runserver-network.ps1

Write-Host "Starting Django server on network interface..." -ForegroundColor Green
Write-Host "Server will be accessible at:" -ForegroundColor Yellow
Write-Host "  - http://localhost:8000 (from this computer)" -ForegroundColor Cyan
Write-Host "  - http://192.168.1.13:8000 (from other devices on network)" -ForegroundColor Cyan
Write-Host ""

cd core
python manage.py runserver 0.0.0.0:8000

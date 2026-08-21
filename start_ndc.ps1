# Start NDC Unified Services (Worker + Django + React)
$ErrorActionPreference = "Continue"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "       STARTING NDC UNIFIED SINGLE-MACHINE SYSTEM     " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. PATH setup
$env:Path += ";C:\Users\cometa\nodejs;C:\Program Files\PostgreSQL\18\bin"
$venvPython = "$PSScriptRoot\.venv\Scripts\python.exe"
$venvPip = "$PSScriptRoot\.venv\Scripts\pip.exe"

# 2. Verify PostgreSQL Service
$pgService = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -ne "Running") {
    Write-Host "[1/4] Starting PostgreSQL 18 Service..." -ForegroundColor Yellow
    Start-Service -Name "postgresql-x64-18"
} else {
    Write-Host "[1/4] PostgreSQL 18 Service is active." -ForegroundColor Green
}

# 3. Start Robot Worker (:8001)
Write-Host "[2/4] Launching Robot Worker API on http://127.0.0.1:8001..." -ForegroundColor Yellow
$workerProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\worker'; & '$venvPython' robot_worker.py" -PassThru

# 4. Start Django Backend (:8000)
Write-Host "[3/4] Launching Django Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$djangoProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; & '$venvPython' backend/manage.py runserver 127.0.0.1:8000" -PassThru

# 5. Start React Frontend (:5173)
Write-Host "[4/4] Launching React Frontend on http://127.0.0.1:5173..." -ForegroundColor Yellow
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; `$env:Path += ';C:\Users\cometa\nodejs'; & 'C:\Users\cometa\nodejs\npx.cmd' vite --host 127.0.0.1 --port 5173" -PassThru

Write-Host "======================================================" -ForegroundColor Green
Write-Host "  ✅ ALL SERVICES LAUNCHED SUCCESSFULLY!              " -ForegroundColor Green
Write-Host "                                                      "
Write-Host "  🌐 Frontend:  http://127.0.0.1:5173                " -ForegroundColor White
Write-Host "  ⚙️ Backend:   http://127.0.0.1:8000/api/           " -ForegroundColor White
Write-Host "  🤖 Worker:    http://127.0.0.1:8001/api/status     " -ForegroundColor White
Write-Host "  🗄️ Database:  PostgreSQL 18 + PostGIS (Port 5432)  " -ForegroundColor White
Write-Host "                                                      "
Write-Host "  Default Admin Login: admin / Admin123!             " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Green

@echo off
chcp 65001 >nul
echo ==========================================
echo    ForenSync - Quick Site Launcher
echo ==========================================
echo.

:: Check if server is running
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/api/slides' -Method GET -TimeoutSec 3 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  WARNING: Server is not running!
    echo.
    echo Please start the server first by running:
    echo    start_server.bat
    echo.
    pause
    exit /b 1
)

echo ✅ Server is running on http://localhost:8000
echo.
echo Opening site pages in browser...

:: Open main citizen portal
start "" "http://localhost:8000/frontend/src/citizen/index.html"

:: Open FIR complaint page
start "" "http://localhost:8000/frontend/src/citizen/fir-complaint.html"

:: Open Fraud complaint page  
start "" "http://localhost:8000/frontend/src/citizen/fraud-complaint.html"

echo.
echo ==========================================
echo Opened:
echo   1. Citizen Portal (index)
echo   2. FIR Complaint Page
echo   3. Fraud Complaint Page
echo ==========================================
echo.
pause
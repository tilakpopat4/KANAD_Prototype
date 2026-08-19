# PowerShell script to start the Kanad Shield server with proper environment variables
# This script loads .env file and starts the uvicorn server

$ErrorActionPreference = "Stop"

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $scriptDir) { $scriptDir = Get-Location }
Set-Location $scriptDir

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "    Kanad Shield Server Startup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Load environment variables from .env file
$envFile = Join-Path $scriptDir ".env"
if (Test-Path $envFile) {
    Write-Host "Loading environment from .env file..." -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)\s*=\s*(.+)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "  Loaded: $name" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "WARNING: .env file not found at $envFile" -ForegroundColor Yellow
}

# Verify critical environment variables
$requiredVars = @("FORENSYNC_JWT_SECRET", "FORENSYNC_REFRESH_SECRET")
$missingVars = @()

foreach ($var in $requiredVars) {
    $value = [System.Environment]::GetEnvironmentVariable($var, "Process")
    if (-not $value) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "ERROR: Missing required environment variables:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "  - $var" -ForegroundColor Red
    }
    Write-Host "Please check your .env file" -ForegroundColor Red
    exit 1
}

# Show DigiLocker configuration
$digilockerProvider = [System.Environment]::GetEnvironmentVariable("DIGILOCKER_PROVIDER", "Process")
if (-not $digilockerProvider) { $digilockerProvider = "simulated (default)" }
Write-Host "`nDigiLocker Provider: $digilockerProvider" -ForegroundColor Cyan

# Start the server
Write-Host "`nStarting Uvicorn server..." -ForegroundColor Green
Write-Host "URL: http://localhost:8000" -ForegroundColor Yellow
Write-Host "Press CTRL+C to stop`n" -ForegroundColor Gray

# Activate virtual environment if it exists
$venvPath = Join-Path $scriptDir ".venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    . $venvPath
}

# Start the server using Python
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 --log-level info

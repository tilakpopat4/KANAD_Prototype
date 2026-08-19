#Requires -Version 5.1
# ForenSync Quick Site Launcher
# Opens all site pages in browser and verifies API is running

param(
    [switch]$Admin,
    [switch]$Police,
    [switch]$Contact,
    [switch]$All
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "    ForenSync - Quick Site Launcher" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Server check
$serverUrl = "http://localhost:8000"
$serverRunning = $false

try {
    $response = Invoke-WebRequest -Uri "$serverUrl/api/slides" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    $serverRunning = $true
} catch {
    $serverRunning = $false
}

if (-not $serverRunning) {
    Write-Host "⚠️  WARNING: Server is not running!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please start the server first by running:" -ForegroundColor White
    Write-Host "   .\start_server.ps1" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Server is running on $serverUrl" -ForegroundColor Green
Write-Host ""

# Default pages to open
$pages = @()

if ($Admin) {
    $pages += "http://localhost:8000/frontend/src/police/admin.html"
} elseif ($Police) {
    $pages += "http://localhost:8000/frontend/src/police/employee.html"
} elseif ($Contact) {
    $pages += "http://localhost:8000/frontend/public/contact.html"
} elseif ($All) {
    $pages = @(
        "http://localhost:8000/frontend/src/citizen/index.html",
        "http://localhost:8000/frontend/src/citizen/fir-complaint.html",
        "http://localhost:8000/frontend/src/citizen/fraud-complaint.html",
        "http://localhost:8000/frontend/src/police/admin.html",
        "http://localhost:8000/frontend/src/police/employee.html",
        "http://localhost:8000/frontend/public/contact.html"
    )
} else {
    # Default: open main citizen pages
    $pages = @(
        "http://localhost:8000/frontend/src/citizen/index.html",
        "http://localhost:8000/frontend/src/citizen/fir-complaint.html",
        "http://localhost:8000/frontend/src/citizen/fraud-complaint.html"
    )
}

Write-Host "Opening site pages in browser..." -ForegroundColor White
Write-Host ""

$pageNum = 1
foreach ($page in $pages) {
    Write-Host "  $pageNum. Opening: $page" -ForegroundColor Gray
    Start-Process $page
    Start-Sleep -Milliseconds 500
    $pageNum++
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Opened $($pages.Count) page(s):" -ForegroundColor White
foreach ($page in $pages) {
    $pageName = [System.IO.Path]::GetFileNameWithoutExtension($page)
    Write-Host "   • $pageName" -ForegroundColor Gray
}
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to exit"
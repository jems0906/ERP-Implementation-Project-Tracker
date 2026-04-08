Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

Write-Host 'Starting ERP Implementation Project Tracker...' -ForegroundColor Cyan

$nodeVersion = node -v
Write-Host "Node detected: $nodeVersion" -ForegroundColor Green

Start-Process "http://localhost:3000"
npm start

# start-with-tunnel.ps1
# Chạy be-bridge với Cloudflare tunnel (tuỳ chọn)

param(
    [switch]$Tunnel,
    [string]$TunnelToken = ""
)

$ErrorActionPreference = "Stop"

Write-Host "=== BE-BRIDGE STARTER ===" -ForegroundColor Cyan

# Kiểm tra node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "Cài đặt dependencies..." -ForegroundColor Yellow
    npm install
}

# Copy .env.example -> .env nếu chưa có
if (-not (Test-Path ".env")) {
    Write-Host "Tạo .env từ .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# Chạy be-bridge
Write-Host "Khởi động be-bridge..." -ForegroundColor Green

if ($Tunnel -and $TunnelToken) {
    # Chạy với Cloudflare tunnel
    Write-Host "Thiết lập Cloudflare tunnel..." -ForegroundColor Yellow

    # Start be-bridge in background
    $job = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npm start
    }

    # Start tunnel
    cloudflared tunnel --url http://localhost:1122 run $TunnelToken

    # Cleanup
    Stop-Job $job
    Remove-Job $job
} else {
    # Chạy bình thường
    npm start
}

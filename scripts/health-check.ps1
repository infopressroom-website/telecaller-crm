# Health Check & System Monitoring Script
# Monitors application health and reports issues

param(
    [switch]$Watch,
    [int]$Interval = 30
)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "System Health Monitor" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

function Get-ServiceHealth {
    $health = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Status = "Unknown"
        Details = @{}
        Issues = @()
    }
    
    # Check web server
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
        $health.Details.WebServer = "Running ✓"
        $health.Status = "Healthy"
    } catch {
        $health.Details.WebServer = "Not responding ✗"
        $health.Status = "Unhealthy"
        $health.Issues += "Web server is not responding"
    }
    
    # Check database connection
    try {
        $env:PGPASSWORD = "postgres"
        $dbCheck = psql -U postgres -d telecaller_crm -c "SELECT 1;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $health.Details.Database = "Connected ✓"
        } else {
            $health.Details.Database = "Connection failed ✗"
            $health.Status = "Degraded"
            $health.Issues += "Database connection issues"
        }
    } catch {
        $health.Details.Database = "Not available ✗"
        $health.Status = "Degraded"
        $health.Issues += "PostgreSQL not available"
    }
    
    # Check disk space
    $drive = Get-PSDrive -Name C
    $freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
    $totalSpaceGB = [math]::Round(($drive.Free + $drive.Used) / 1GB, 2)
    $freePercent = [math]::Round(($drive.Free / ($drive.Free + $drive.Used)) * 100, 2)
    
    $health.Details.DiskSpace = "$freeSpaceGB GB free ($freePercent%)"
    
    if ($freePercent -lt 10) {
        $health.Status = "Warning"
        $health.Issues += "Low disk space: $freePercent% free"
    }
    
    # Check memory
    $os = Get-CimInstance Win32_OperatingSystem
    $freeMemoryGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    $totalMemoryGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
    $memoryPercent = [math]::Round(($os.FreePhysicalMemory / $os.TotalVisibleMemorySize) * 100, 2)
    
    $health.Details.Memory = "$freeMemoryGB GB free ($memoryPercent%)"
    
    if ($memoryPercent -lt 10) {
        $health.Status = "Warning"
        $health.Issues += "Low memory: $memoryPercent% free"
    }
    
    # Check Node.js process
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $health.Details.NodeProcesses = "$($nodeProcesses.Count) running"
        
        # Check if any process is using too much memory
        foreach ($proc in $nodeProcesses) {
            $memoryMB = [math]::Round($proc.WorkingSet64 / 1MB, 2)
            if ($memoryMB -gt 1024) {
                $health.Issues += "High memory usage by Node process (PID $($proc.Id)): $memoryMB MB"
            }
        }
    } else {
        $health.Details.NodeProcesses = "None running ⚠️"
    }
    
    return $health
}

function Show-Health {
    param($health)
    
    Clear-Host
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "System Health Check" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Time: $($health.Timestamp)" -ForegroundColor Gray
    Write-Host ""
    
    # Status
    $statusColor = switch ($health.Status) {
        "Healthy" { "Green" }
        "Degraded" { "Yellow" }
        "Unhealthy" { "Red" }
        "Warning" { "Yellow" }
        default { "Gray" }
    }
    
    Write-Host "Overall Status: " -NoNewline
    Write-Host $health.Status -ForegroundColor $statusColor
    Write-Host ""
    
    # Details
    Write-Host "Services:" -ForegroundColor Yellow
    foreach ($key in $health.Details.Keys) {
        Write-Host "  $key : $($health.Details[$key])" -ForegroundColor White
    }
    Write-Host ""
    
    # Issues
    if ($health.Issues.Count -gt 0) {
        Write-Host "⚠️  Issues Detected:" -ForegroundColor Red
        foreach ($issue in $health.Issues) {
            Write-Host "  • $issue" -ForegroundColor Yellow
        }
        Write-Host ""
    } else {
        Write-Host "✓ No issues detected" -ForegroundColor Green
        Write-Host ""
    }
    
    if ($Watch) {
        Write-Host "Press Ctrl+C to stop monitoring..." -ForegroundColor Gray
        Write-Host "Next check in $Interval seconds" -ForegroundColor Gray
    }
}

# Main execution
if ($Watch) {
    Write-Host "Starting continuous monitoring (every $Interval seconds)..." -ForegroundColor Yellow
    Write-Host ""
    
    while ($true) {
        $health = Get-ServiceHealth
        Show-Health $health
        Start-Sleep -Seconds $Interval
    }
} else {
    $health = Get-ServiceHealth
    Show-Health $health
    
    # Exit with error code if unhealthy
    if ($health.Status -eq "Unhealthy") {
        exit 1
    }
}

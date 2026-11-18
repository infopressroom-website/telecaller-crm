# Feature Testing Script
# Tests all major features of the CRM

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Telecaller CRM - Feature Tests" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"
$passed = 0
$failed = 0
$skipped = 0

function Test-Endpoint {
    param(
        [string]$name,
        [string]$path,
        [int]$expectedStatus = 200
    )
    
    Write-Host "Testing: $name..." -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$path" -Method GET -UseBasicParsing -ErrorAction Stop
        
        if ($response.StatusCode -eq $expectedStatus) {
            Write-Host " ✓ PASS" -ForegroundColor Green
            return $true
        } else {
            Write-Host " ✗ FAIL (Status: $($response.StatusCode))" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host " ✗ FAIL ($($_.Exception.Message))" -ForegroundColor Red
        return $false
    }
}

function Test-PageLoads {
    param([string]$path)
    
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$path" -Method GET -UseBasicParsing -TimeoutSec 10
        return $response.StatusCode -eq 200 -or $response.StatusCode -eq 302
    } catch {
        return $false
    }
}

Write-Host "Checking if server is running..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/api/health" -Method GET -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Server is running" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ Server is not running!" -ForegroundColor Red
    Write-Host "Please start the server with: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host "Running feature tests..." -ForegroundColor Cyan
Write-Host ""

# Authentication Tests
Write-Host "Authentication & Auth Tests:" -ForegroundColor Yellow
if (Test-PageLoads "/login") { $passed++ } else { $failed++ }
if (Test-PageLoads "/forgot-password") { $passed++ } else { $failed++ }
if (Test-PageLoads "/api/auth/me") { $passed++ } else { $failed++ }
Write-Host ""

# Core Feature Tests
Write-Host "Core Features:" -ForegroundColor Yellow

$features = @(
    @{name="Dashboard"; path="/dashboard"},
    @{name="Leads List"; path="/leads"},
    @{name="Calls List"; path="/calls"},
    @{name="Follow-ups"; path="/follow-ups"},
    @{name="Team Management"; path="/team"},
    @{name="Reports"; path="/reports"},
    @{name="Settings"; path="/settings"},
    @{name="Automation"; path="/automation"},
    @{name="QA System"; path="/qa"},
    @{name="Performance"; path="/performance"},
    @{name="Distribution"; path="/distribution"},
    @{name="Attendance"; path="/attendance"},
    @{name="Audit Log"; path="/audit"},
    @{name="Notifications"; path="/notifications"}
)

foreach ($feature in $features) {
    if (Test-PageLoads $feature.path) { 
        $passed++ 
    } else { 
        $failed++ 
    }
}

Write-Host ""

# API Tests
Write-Host "API Endpoints:" -ForegroundColor Yellow
if (Test-Endpoint "Health Check" "/api/health" 200) { $passed++ } else { $failed++ }
Write-Host ""

# Summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Passed:  $passed" -ForegroundColor Green
Write-Host "Failed:  $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "Skipped: $skipped" -ForegroundColor Gray
Write-Host ""

$total = $passed + $failed + $skipped
$percentage = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 2) } else { 0 }

Write-Host "Success Rate: $percentage%" -ForegroundColor $(if ($percentage -ge 80) { "Green" } elseif ($percentage -ge 60) { "Yellow" } else { "Red" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "🎉 All tests passed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some tests failed. Check the output above." -ForegroundColor Yellow
}

exit $failed

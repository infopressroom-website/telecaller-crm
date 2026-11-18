# Performance Analysis & Optimization Tool
# Analyzes and reports application performance

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Performance Analyzer" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$results = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Checks = @()
    Score = 0
    Issues = @()
    Recommendations = @()
}

function Test-PagePerformance {
    param([string]$url, [string]$name)
    
    Write-Host "Testing $name..." -NoNewline
    
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        $sw.Stop()
        
        $loadTime = $sw.ElapsedMilliseconds
        
        $status = if ($loadTime -lt 1000) { "Excellent" }
                  elseif ($loadTime -lt 2000) { "Good" }
                  elseif ($loadTime -lt 3000) { "Fair" }
                  else { "Poor" }
        
        $color = if ($loadTime -lt 1000) { "Green" }
                 elseif ($loadTime -lt 2000) { "Yellow" }
                 else { "Red" }
        
        Write-Host " $loadTime ms - $status" -ForegroundColor $color
        
        return @{
            Name = $name
            LoadTime = $loadTime
            Status = $status
            Success = $true
        }
    } catch {
        Write-Host " Failed" -ForegroundColor Red
        return @{
            Name = $name
            LoadTime = 0
            Status = "Failed"
            Success = $false
        }
    }
}

function Test-DatabasePerformance {
    Write-Host ""
    Write-Host "Database Performance:" -ForegroundColor Yellow
    
    try {
        $env:PGPASSWORD = "postgres"
        
        # Test connection time
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        psql -U postgres -d telecaller_crm -c "SELECT 1;" 2>&1 | Out-Null
        $sw.Stop()
        
        $connectionTime = $sw.ElapsedMilliseconds
        Write-Host "  Connection: $connectionTime ms" -ForegroundColor $(if ($connectionTime -lt 100) { "Green" } else { "Yellow" })
        
        # Test query performance
        $queries = @(
            @{ Name = "Simple SELECT"; Query = "SELECT COUNT(*) FROM `"User`";" },
            @{ Name = "JOIN query"; Query = "SELECT l.id, u.name FROM `"Lead`" l LEFT JOIN `"User`" u ON l.`ownerId` = u.id LIMIT 100;" },
            @{ Name = "Aggregate"; Query = "SELECT status, COUNT(*) FROM `"Lead`" GROUP BY status;" }
        )
        
        foreach ($q in $queries) {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            psql -U postgres -d telecaller_crm -c $q.Query 2>&1 | Out-Null
            $sw.Stop()
            
            $queryTime = $sw.ElapsedMilliseconds
            Write-Host "  $($q.Name): $queryTime ms" -ForegroundColor $(if ($queryTime -lt 100) { "Green" } elseif ($queryTime -lt 500) { "Yellow" } else { "Red" })
            
            if ($queryTime -gt 500) {
                $results.Issues += "Slow query: $($q.Name) took $queryTime ms"
                $results.Recommendations += "Optimize query: $($q.Name) - Consider adding indexes"
            }
        }
        
        # Check for missing indexes
        Write-Host ""
        Write-Host "Checking for missing indexes..." -ForegroundColor Yellow
        
        $indexCheck = psql -U postgres -d telecaller_crm -t -c @"
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
"@ 2>&1
        
        $indexCount = ($indexCheck | Measure-Object).Count
        Write-Host "  Total indexes: $indexCount" -ForegroundColor White
        
        if ($indexCount -lt 20) {
            $results.Recommendations += "Consider adding more indexes to improve query performance"
        }
        
    } catch {
        Write-Host "  Database performance check failed" -ForegroundColor Red
        $results.Issues += "Unable to check database performance"
    }
}

function Test-BundleSize {
    Write-Host ""
    Write-Host "Checking bundle size..." -ForegroundColor Yellow
    
    if (Test-Path ".next") {
        $nextSize = (Get-ChildItem -Path ".next" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "  .next directory: $([math]::Round($nextSize, 2)) MB" -ForegroundColor White
        
        if ($nextSize -gt 100) {
            $results.Issues += "Large bundle size: $([math]::Round($nextSize, 2)) MB"
            $results.Recommendations += "Consider code splitting and lazy loading"
        }
        
        # Check for large files
        $largeFiles = Get-ChildItem -Path ".next" -Recurse -File | 
                      Where-Object { $_.Length -gt 1MB } | 
                      Sort-Object Length -Descending | 
                      Select-Object -First 5
        
        if ($largeFiles) {
            Write-Host ""
            Write-Host "  Largest files:" -ForegroundColor Yellow
            foreach ($file in $largeFiles) {
                $size = [math]::Round($file.Length / 1MB, 2)
                Write-Host "    - $($file.Name): $size MB" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  .next directory not found - run 'npm run build' first" -ForegroundColor Yellow
    }
}

function Test-MemoryUsage {
    Write-Host ""
    Write-Host "Memory Usage:" -ForegroundColor Yellow
    
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    
    if ($nodeProcesses) {
        $totalMemory = 0
        foreach ($proc in $nodeProcesses) {
            $memoryMB = [math]::Round($proc.WorkingSet64 / 1MB, 2)
            $totalMemory += $memoryMB
            Write-Host "  Process $($proc.Id): $memoryMB MB" -ForegroundColor White
            
            if ($memoryMB -gt 512) {
                $results.Issues += "High memory usage by process $($proc.Id): $memoryMB MB"
                $results.Recommendations += "Consider investigating memory leaks or optimizing caching"
            }
        }
        
        Write-Host "  Total: $([math]::Round($totalMemory, 2)) MB" -ForegroundColor $(if ($totalMemory -lt 512) { "Green" } elseif ($totalMemory -lt 1024) { "Yellow" } else { "Red" })
    } else {
        Write-Host "  No Node.js processes running" -ForegroundColor Gray
    }
}

function Test-DependencySize {
    Write-Host ""
    Write-Host "Dependencies:" -ForegroundColor Yellow
    
    if (Test-Path "node_modules") {
        $nodeModulesSize = (Get-ChildItem -Path "node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "  node_modules size: $([math]::Round($nodeModulesSize, 2)) MB" -ForegroundColor White
        
        # Count dependencies
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        $prodDeps = ($packageJson.dependencies | Get-Member -MemberType NoteProperty).Count
        $devDeps = ($packageJson.devDependencies | Get-Member -MemberType NoteProperty).Count
        
        Write-Host "  Production dependencies: $prodDeps" -ForegroundColor White
        Write-Host "  Development dependencies: $devDeps" -ForegroundColor White
        Write-Host "  Total: $($prodDeps + $devDeps)" -ForegroundColor White
        
        if (($prodDeps + $devDeps) -gt 100) {
            $results.Recommendations += "Large number of dependencies - review if all are necessary"
        }
    }
}

function Get-LighthouseScore {
    Write-Host ""
    Write-Host "Lighthouse Score:" -ForegroundColor Yellow
    
    if (Get-Command lighthouse -ErrorAction SilentlyContinue) {
        Write-Host "  Running Lighthouse audit..." -ForegroundColor Gray
        Write-Host "  (This may take 30-60 seconds)" -ForegroundColor Gray
        
        lighthouse http://localhost:3000 --output json --output-path ./lighthouse-report.json --quiet 2>&1 | Out-Null
        
        if (Test-Path "lighthouse-report.json") {
            $report = Get-Content "lighthouse-report.json" | ConvertFrom-Json
            
            $performance = [math]::Round($report.categories.performance.score * 100)
            $accessibility = [math]::Round($report.categories.accessibility.score * 100)
            $bestPractices = [math]::Round($report.categories.'best-practices'.score * 100)
            $seo = [math]::Round($report.categories.seo.score * 100)
            
            Write-Host "  Performance: $performance" -ForegroundColor $(if ($performance -gt 90) { "Green" } elseif ($performance -gt 50) { "Yellow" } else { "Red" })
            Write-Host "  Accessibility: $accessibility" -ForegroundColor $(if ($accessibility -gt 90) { "Green" } elseif ($accessibility -gt 50) { "Yellow" } else { "Red" })
            Write-Host "  Best Practices: $bestPractices" -ForegroundColor $(if ($bestPractices -gt 90) { "Green" } elseif ($bestPractices -gt 50) { "Yellow" } else { "Red" })
            Write-Host "  SEO: $seo" -ForegroundColor $(if ($seo -gt 90) { "Green" } elseif ($seo -gt 50) { "Yellow" } else { "Red" })
            
            $avgScore = [math]::Round(($performance + $accessibility + $bestPractices + $seo) / 4)
            $results.Score = $avgScore
            
            if ($performance -lt 90) {
                $results.Recommendations += "Improve performance score (currently $performance)"
            }
            if ($accessibility -lt 90) {
                $results.Recommendations += "Improve accessibility score (currently $accessibility)"
            }
            
            Remove-Item "lighthouse-report.json" -Force
        }
    } else {
        Write-Host "  Lighthouse not installed" -ForegroundColor Gray
        Write-Host "  Install: npm install -g lighthouse" -ForegroundColor Gray
    }
}

# Main execution
Write-Host "Starting performance analysis..." -ForegroundColor Yellow
Write-Host ""

# Check if server is running
try {
    $health = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Server is running" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ Server is not running!" -ForegroundColor Red
    Write-Host "Start the server with: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Run performance tests
Write-Host "Page Load Times:" -ForegroundColor Yellow
$pages = @(
    @{ Url = "http://localhost:3000/login"; Name = "Login Page" },
    @{ Url = "http://localhost:3000/leads"; Name = "Leads List" },
    @{ Url = "http://localhost:3000/dashboard"; Name = "Dashboard" },
    @{ Url = "http://localhost:3000/calls"; Name = "Calls List" },
    @{ Url = "http://localhost:3000/team"; Name = "Team Page" }
)

$pageResults = @()
foreach ($page in $pages) {
    $result = Test-PagePerformance -url $page.Url -name $page.Name
    $pageResults += $result
}

$avgLoadTime = ($pageResults | Where-Object { $_.Success } | Measure-Object -Property LoadTime -Average).Average

Write-Host ""
Write-Host "Average load time: $([math]::Round($avgLoadTime, 0)) ms" -ForegroundColor $(if ($avgLoadTime -lt 1000) { "Green" } elseif ($avgLoadTime -lt 2000) { "Yellow" } else { "Red" })

# Database performance
Test-DatabasePerformance

# Bundle size
Test-BundleSize

# Memory usage
Test-MemoryUsage

# Dependencies
Test-DependencySize

# Lighthouse (optional)
Get-LighthouseScore

# Generate report
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Performance Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if ($results.Score -gt 0) {
    Write-Host "Overall Score: $($results.Score)/100" -ForegroundColor $(if ($results.Score -gt 80) { "Green" } elseif ($results.Score -gt 60) { "Yellow" } else { "Red" })
    Write-Host ""
}

if ($results.Issues.Count -gt 0) {
    Write-Host "⚠️  Issues Found:" -ForegroundColor Red
    foreach ($issue in $results.Issues) {
        Write-Host "  • $issue" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($results.Recommendations.Count -gt 0) {
    Write-Host "💡 Recommendations:" -ForegroundColor Cyan
    foreach ($rec in $results.Recommendations) {
        Write-Host "  • $rec" -ForegroundColor White
    }
    Write-Host ""
}

if ($results.Issues.Count -eq 0) {
    Write-Host "✓ No performance issues detected!" -ForegroundColor Green
    Write-Host ""
}

# Save report
$reportPath = "performance-report-$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$results | ConvertTo-Json -Depth 10 | Out-File $reportPath
Write-Host "Report saved to: $reportPath" -ForegroundColor Gray
Write-Host ""

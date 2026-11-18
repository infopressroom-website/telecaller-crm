# Security Fixes Script for Telecaller CRM
# Run this script to apply immediate security fixes

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Telecaller CRM - Security Fixes" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if npm is available
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: npm is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Backing up package.json..." -ForegroundColor Yellow
Copy-Item package.json package.json.backup
Write-Host "✓ Backup created: package.json.backup" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Updating critical security packages..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray
Write-Host ""

# Update Next.js to latest stable in 14.x or 15.x
Write-Host "Updating Next.js..." -ForegroundColor Cyan
npm install next@latest

# Update Prisma
Write-Host "Updating Prisma..." -ForegroundColor Cyan
npm install @prisma/client@latest
npm install -D prisma@latest

# Update ESLint
Write-Host "Updating ESLint..." -ForegroundColor Cyan
npm install -D eslint@latest eslint-config-next@latest

# Update Recharts
Write-Host "Updating Recharts..." -ForegroundColor Cyan
npm install recharts@latest

# Update TypeScript
Write-Host "Updating TypeScript..." -ForegroundColor Cyan
npm install -D typescript@latest

Write-Host ""
Write-Host "Step 3: Running automated security fixes..." -ForegroundColor Yellow
npm audit fix

Write-Host ""
Write-Host "Step 4: Checking for remaining vulnerabilities..." -ForegroundColor Yellow
$auditResult = npm audit --json | ConvertFrom-Json

$critical = 0
$high = 0
$moderate = 0

if ($auditResult.metadata) {
    $critical = $auditResult.metadata.vulnerabilities.critical
    $high = $auditResult.metadata.vulnerabilities.high
    $moderate = $auditResult.metadata.vulnerabilities.moderate
}

Write-Host ""
Write-Host "Security Status:" -ForegroundColor Cyan
Write-Host "  Critical: $critical" -ForegroundColor $(if ($critical -gt 0) { "Red" } else { "Green" })
Write-Host "  High: $high" -ForegroundColor $(if ($high -gt 0) { "Yellow" } else { "Green" })
Write-Host "  Moderate: $moderate" -ForegroundColor $(if ($moderate -gt 0) { "Yellow" } else { "Green" })
Write-Host ""

if ($critical -gt 0 -or $high -gt 0) {
    Write-Host "⚠️  WARNING: Some vulnerabilities remain" -ForegroundColor Yellow
    Write-Host "Run 'npm audit fix --force' to attempt aggressive fixes (may break compatibility)" -ForegroundColor Gray
    Write-Host "Or review manually with 'npm audit'" -ForegroundColor Gray
} else {
    Write-Host "✓ No critical or high vulnerabilities found!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 5: Regenerating Prisma Client..." -ForegroundColor Yellow
npm run db:generate

Write-Host ""
Write-Host "Step 6: Running type check..." -ForegroundColor Yellow
$typecheckResult = npm run typecheck 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Type check passed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Type check found issues (this is common after updates)" -ForegroundColor Yellow
    Write-Host "Review the output above for details" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Security fixes completed!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set up PostgreSQL database (see Database Setup Guide)" -ForegroundColor White
Write-Host "2. Run migrations: npm run db:migrate" -ForegroundColor White
Write-Host "3. Seed database: npm run db:seed" -ForegroundColor White
Write-Host "4. Start dev server: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "If anything breaks, restore backup: Copy-Item package.json.backup package.json" -ForegroundColor Gray

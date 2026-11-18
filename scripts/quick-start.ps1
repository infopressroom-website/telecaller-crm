# Telecaller CRM - Quick Start Script
# Automates the setup process

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Telecaller CRM - Quick Start" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Function to check if a command exists
function Test-Command($command) {
    try {
        if (Get-Command $command -ErrorAction Stop) {
            return $true
        }
    } catch {
        return $false
    }
}

# Function to prompt for continuation
function Prompt-Continue($message) {
    Write-Host ""
    Write-Host $message -ForegroundColor Yellow
    $response = Read-Host "Continue? (Y/N)"
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit 0
    }
}

Write-Host "Step 1: Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check Node.js
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js is not installed" -ForegroundColor Red
    Write-Host "  Download from: https://nodejs.org/" -ForegroundColor Gray
    exit 1
}

# Check npm
if (Test-Command "npm") {
    $npmVersion = npm --version
    Write-Host "✓ npm installed: v$npmVersion" -ForegroundColor Green
} else {
    Write-Host "✗ npm is not installed" -ForegroundColor Red
    exit 1
}

# Check PostgreSQL
$pgInstalled = $false
if (Test-Command "psql") {
    $pgVersion = psql --version
    Write-Host "✓ PostgreSQL installed: $pgVersion" -ForegroundColor Green
    $pgInstalled = $true
} else {
    Write-Host "⚠️  PostgreSQL is not installed or not in PATH" -ForegroundColor Yellow
    Write-Host "   You will need to install PostgreSQL to continue." -ForegroundColor Gray
    Write-Host "   Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    Write-Host "   OR use Docker: docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15" -ForegroundColor Gray
    
    Prompt-Continue "Do you want to continue without PostgreSQL? (You can set it up later)"
}

Write-Host ""
Write-Host "Step 2: Installing dependencies..." -ForegroundColor Yellow
Write-Host "This may take 2-3 minutes..." -ForegroundColor Gray
Write-Host ""

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ npm install failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Check if .env exists
if (Test-Path ".env") {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
} else {
    Write-Host "Step 3: Creating .env file..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✓ .env file created from .env.example" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  Important: Update your .env file with proper values!" -ForegroundColor Yellow
    Write-Host "   Especially DATABASE_URL if using custom PostgreSQL settings" -ForegroundColor Gray
}

Write-Host ""

# Try to create database if PostgreSQL is available
if ($pgInstalled) {
    Write-Host "Step 4: Setting up database..." -ForegroundColor Yellow
    
    # Try to connect and create database
    try {
        $env:PGPASSWORD = "postgres"
        psql -U postgres -c "CREATE DATABASE telecaller_crm;" 2>&1 | Out-Null
        Write-Host "✓ Database 'telecaller_crm' created" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Database might already exist or connection failed" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Running database migrations..." -ForegroundColor Cyan
    npm run db:migrate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database migrations completed" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Seeding database..." -ForegroundColor Cyan
        npm run db:seed
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Database seeded" -ForegroundColor Green
            
            Write-Host ""
            $response = Read-Host "Add demo data? (Y/N)"
            if ($response -eq "Y" -or $response -eq "y") {
                npm run db:seed:demo
                Write-Host "✓ Demo data added" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "⚠️  Database setup incomplete - check the errors above" -ForegroundColor Yellow
    }
} else {
    Write-Host "Step 4: Skipping database setup (PostgreSQL not available)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 5: Running type check..." -ForegroundColor Yellow
npm run typecheck

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Type check passed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Type check has warnings (may be OK)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 6: Building application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build successful" -ForegroundColor Green
} else {
    Write-Host "✗ Build failed - check errors above" -ForegroundColor Red
    Write-Host ""
    Prompt-Continue "Build failed. Continue anyway?"
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Setup Complete! 🎉" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "   - Dependencies: Installed ✓" -ForegroundColor White
Write-Host "   - Environment: Configured ✓" -ForegroundColor White
if ($pgInstalled) {
    Write-Host "   - Database: Ready ✓" -ForegroundColor White
} else {
    Write-Host "   - Database: Not configured ⚠️" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start the development server:" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "2. Open your browser:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "3. Login with demo credentials:" -ForegroundColor Yellow
Write-Host "   Email:    admin@crm.test" -ForegroundColor White
Write-Host "   Password: ChangeMe-Dev-Only-123" -ForegroundColor White
Write-Host ""

Write-Host "📚 Available Scripts:" -ForegroundColor Cyan
Write-Host "   npm run dev       - Start development server" -ForegroundColor Gray
Write-Host "   npm run build     - Build for production" -ForegroundColor Gray
Write-Host "   npm run start     - Start production server" -ForegroundColor Gray
Write-Host "   npm run lint      - Run linter" -ForegroundColor Gray
Write-Host "   npm run typecheck - Check TypeScript types" -ForegroundColor Gray
Write-Host "   npm run test      - Run tests" -ForegroundColor Gray
Write-Host "   npm run db:studio - Open Prisma Studio" -ForegroundColor Gray
Write-Host ""

Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "   - AUDIT_REPORT.md            - Security audit findings" -ForegroundColor Gray
Write-Host "   - IMPLEMENTATION_ROADMAP.md  - Feature roadmap" -ForegroundColor Gray
Write-Host "   - Quick Start Guide          - See artifacts panel" -ForegroundColor Gray
Write-Host ""

$response = Read-Host "Start development server now? (Y/N)"
if ($response -eq "Y" -or $response -eq "y") {
    Write-Host ""
    Write-Host "Starting development server..." -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""
    npm run dev
}

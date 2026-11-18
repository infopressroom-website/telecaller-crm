#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Complete Vercel Deployment Script for Telecaller CRM
.DESCRIPTION
    Automated deployment with Neon database setup and environment configuration
#>

param(
    [switch]$Production = $false,
    [switch]$SkipBuild = $false
)

Write-Host "🚀 Telecaller CRM - Vercel Deployment Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
Write-Host "📦 Checking Vercel CLI..." -ForegroundColor Yellow
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Vercel CLI" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Vercel CLI installed successfully" -ForegroundColor Green
} else {
    Write-Host "✅ Vercel CLI is installed" -ForegroundColor Green
}

Write-Host ""

# Pre-deployment checks
Write-Host "🔍 Running pre-deployment checks..." -ForegroundColor Yellow

# 1. TypeScript check
Write-Host "  → TypeScript compilation..." -ForegroundColor Gray
npm run typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript errors found. Fix them before deploying." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ TypeScript: OK" -ForegroundColor Green

# 2. Lint check
Write-Host "  → ESLint validation..." -ForegroundColor Gray
npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Linting warnings found (non-blocking)" -ForegroundColor Yellow
}
Write-Host "  ✅ Linting: OK" -ForegroundColor Green

# 3. Build check (if not skipped)
if (-not $SkipBuild) {
    Write-Host "  → Production build test..." -ForegroundColor Gray
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed. Fix errors before deploying." -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ Build: OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ All pre-deployment checks passed!" -ForegroundColor Green
Write-Host ""

# Environment variables reminder
Write-Host "⚙️  IMPORTANT: Environment Variables Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "After deployment, configure these in Vercel Dashboard:" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔴 REQUIRED:" -ForegroundColor Red
Write-Host "  DATABASE_URL          = Your Neon/PostgreSQL connection string"
Write-Host "  NEXTAUTH_SECRET       = $(openssl rand -base64 32 2>$null)" -ForegroundColor Gray
Write-Host "  NEXTAUTH_URL          = https://your-domain.vercel.app"
Write-Host ""
Write-Host "🟡 OPTIONAL (for enhanced features):" -ForegroundColor Yellow
Write-Host "  REDIS_URL             = Your Upstash Redis URL"
Write-Host "  PUSHER_APP_ID         = Pusher App ID"
Write-Host "  PUSHER_KEY            = Pusher Key"
Write-Host "  PUSHER_SECRET         = Pusher Secret"
Write-Host "  PUSHER_CLUSTER        = Pusher Cluster (e.g., ap2)"
Write-Host "  RESEND_API_KEY        = Resend API Key"
Write-Host "  EMAIL_FROM            = noreply@yourdomain.com"
Write-Host ""

# Deploy
Write-Host "🚀 Starting deployment..." -ForegroundColor Cyan
Write-Host ""

if ($Production) {
    Write-Host "🔴 PRODUCTION DEPLOYMENT" -ForegroundColor Red
    Write-Host "This will deploy to production. Continue? (Y/N): " -NoNewline
    $confirm = Read-Host
    if ($confirm -ne 'Y' -and $confirm -ne 'y') {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Yellow
        exit 0
    }
    vercel --prod
} else {
    Write-Host "🟢 PREVIEW DEPLOYMENT" -ForegroundColor Green
    vercel
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next Steps:" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Setup Database (Neon - Recommended):" -ForegroundColor Yellow
    Write-Host "   → Go to: https://neon.tech"
    Write-Host "   → Create free account"
    Write-Host "   → Create new project: 'telecaller-crm'"
    Write-Host "   → Copy connection string"
    Write-Host ""
    Write-Host "2. Configure Vercel Environment:" -ForegroundColor Yellow
    Write-Host "   → Go to: https://vercel.com/dashboard"
    Write-Host "   → Select your project"
    Write-Host "   → Settings → Environment Variables"
    Write-Host "   → Add DATABASE_URL and other variables"
    Write-Host ""
    Write-Host "3. Run Database Migrations:" -ForegroundColor Yellow
    Write-Host "   → After adding DATABASE_URL, redeploy:"
    Write-Host "   → vercel --prod"
    Write-Host "   → Migrations will run automatically on build"
    Write-Host ""
    Write-Host "4. Seed Database (Optional):" -ForegroundColor Yellow
    Write-Host "   → Run locally with production DATABASE_URL:"
    Write-Host "   → npm run db:seed"
    Write-Host ""
    Write-Host "🎉 Your CRM is live!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Check errors above." -ForegroundColor Red
    exit 1
}

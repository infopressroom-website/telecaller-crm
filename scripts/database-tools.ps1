# Database Management Tools
# Utilities for database operations

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('backup', 'restore', 'reset', 'status', 'migrate', 'seed', 'studio')]
    [string]$Action = 'status'
)

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Database Management Tools" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

function Get-DatabaseStatus {
    Write-Host "Checking database status..." -ForegroundColor Yellow
    Write-Host ""
    
    # Check PostgreSQL service
    $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if ($pgService) {
        Write-Host "PostgreSQL Service: " -NoNewline
        if ($pgService.Status -eq "Running") {
            Write-Host "Running ✓" -ForegroundColor Green
        } else {
            Write-Host "Stopped ✗" -ForegroundColor Red
        }
    } else {
        Write-Host "PostgreSQL Service: Not installed ✗" -ForegroundColor Red
    }
    
    # Check database connection
    try {
        $env:PGPASSWORD = "postgres"
        $result = psql -U postgres -d telecaller_crm -c "SELECT COUNT(*) FROM _prisma_migrations;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Database Connection: Connected ✓" -ForegroundColor Green
            
            # Get migration count
            $migrationCount = ($result | Select-String -Pattern '^\s*\d+\s*$').Line.Trim()
            Write-Host "Migrations Applied: $migrationCount" -ForegroundColor White
            
            # Get table counts
            Write-Host ""
            Write-Host "Record Counts:" -ForegroundColor Yellow
            
            $tables = @("User", "Lead", "CallLog", "FollowUp", "Team", "Task")
            foreach ($table in $tables) {
                $count = psql -U postgres -d telecaller_crm -t -c "SELECT COUNT(*) FROM `"$table`";" 2>&1 | Select-String -Pattern '\d+' | ForEach-Object { $_.Matches.Value }
                Write-Host "  $table : $count" -ForegroundColor White
            }
        } else {
            Write-Host "Database Connection: Failed ✗" -ForegroundColor Red
            Write-Host "Error: $result" -ForegroundColor Red
        }
    } catch {
        Write-Host "Database Connection: Failed ✗" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

function Backup-Database {
    Write-Host "Creating database backup..." -ForegroundColor Yellow
    
    $backupDir = "backups"
    if (!(Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "$backupDir/telecaller_crm_$timestamp.sql"
    
    try {
        $env:PGPASSWORD = "postgres"
        pg_dump -U postgres -d telecaller_crm -f $backupFile
        
        if ($LASTEXITCODE -eq 0) {
            $fileSize = (Get-Item $backupFile).Length / 1KB
            Write-Host "✓ Backup created successfully" -ForegroundColor Green
            Write-Host "  Location: $backupFile" -ForegroundColor White
            Write-Host "  Size: $([math]::Round($fileSize, 2)) KB" -ForegroundColor White
            
            # Compress backup
            Compress-Archive -Path $backupFile -DestinationPath "$backupFile.zip" -Force
            Remove-Item $backupFile
            Write-Host "  Compressed: $backupFile.zip" -ForegroundColor White
        } else {
            Write-Host "✗ Backup failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Backup failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

function Restore-DatabaseBackup {
    Write-Host "Available backups:" -ForegroundColor Yellow
    Write-Host ""
    
    $backups = Get-ChildItem -Path "backups" -Filter "*.sql.zip" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    
    if ($backups.Count -eq 0) {
        Write-Host "No backups found!" -ForegroundColor Red
        return
    }
    
    for ($i = 0; $i -lt $backups.Count; $i++) {
        $backup = $backups[$i]
        $size = [math]::Round($backup.Length / 1KB, 2)
        Write-Host "  [$i] $($backup.Name) - $size KB - $($backup.LastWriteTime)" -ForegroundColor White
    }
    
    Write-Host ""
    $selection = Read-Host "Select backup number to restore (or press Enter to cancel)"
    
    if ([string]::IsNullOrEmpty($selection)) {
        Write-Host "Restore cancelled" -ForegroundColor Yellow
        return
    }
    
    $selectedBackup = $backups[[int]$selection]
    Write-Host ""
    Write-Host "⚠️  WARNING: This will replace ALL data in the database!" -ForegroundColor Red
    $confirm = Read-Host "Type 'YES' to confirm restore"
    
    if ($confirm -ne "YES") {
        Write-Host "Restore cancelled" -ForegroundColor Yellow
        return
    }
    
    Write-Host ""
    Write-Host "Restoring backup..." -ForegroundColor Yellow
    
    try {
        # Extract backup
        $extractPath = "backups/temp_restore.sql"
        Expand-Archive -Path $selectedBackup.FullName -DestinationPath "backups/temp" -Force
        Move-Item "backups/temp/*.sql" $extractPath -Force
        Remove-Item "backups/temp" -Recurse -Force
        
        # Drop and recreate database
        $env:PGPASSWORD = "postgres"
        psql -U postgres -c "DROP DATABASE IF EXISTS telecaller_crm;" 2>&1 | Out-Null
        psql -U postgres -c "CREATE DATABASE telecaller_crm;" 2>&1 | Out-Null
        
        # Restore backup
        psql -U postgres -d telecaller_crm -f $extractPath 2>&1 | Out-Null
        
        # Clean up
        Remove-Item $extractPath -Force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Database restored successfully" -ForegroundColor Green
        } else {
            Write-Host "✗ Restore failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Restore failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

function Reset-Database {
    Write-Host "⚠️  WARNING: This will DELETE ALL DATA!" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Type 'DELETE' to confirm database reset"
    
    if ($confirm -ne "DELETE") {
        Write-Host "Reset cancelled" -ForegroundColor Yellow
        return
    }
    
    Write-Host ""
    Write-Host "Resetting database..." -ForegroundColor Yellow
    
    try {
        # Create backup first
        Write-Host "Creating safety backup..." -ForegroundColor Cyan
        Backup-Database
        
        # Drop and recreate database
        $env:PGPASSWORD = "postgres"
        psql -U postgres -c "DROP DATABASE IF EXISTS telecaller_crm;" 2>&1 | Out-Null
        psql -U postgres -c "CREATE DATABASE telecaller_crm;" 2>&1 | Out-Null
        
        Write-Host "✓ Database dropped and recreated" -ForegroundColor Green
        
        # Run migrations
        Write-Host ""
        Write-Host "Running migrations..." -ForegroundColor Cyan
        npm run db:migrate
        
        # Seed database
        Write-Host ""
        $seed = Read-Host "Seed database with initial data? (Y/N)"
        if ($seed -eq "Y" -or $seed -eq "y") {
            npm run db:seed
            
            $demo = Read-Host "Add demo data? (Y/N)"
            if ($demo -eq "Y" -or $demo -eq "y") {
                npm run db:seed:demo
            }
        }
        
        Write-Host ""
        Write-Host "✓ Database reset complete" -ForegroundColor Green
    } catch {
        Write-Host "✗ Reset failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

function Run-Migrations {
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    Write-Host ""
    
    npm run db:migrate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Migrations completed" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "✗ Migrations failed" -ForegroundColor Red
    }
    
    Write-Host ""
}

function Seed-Database {
    Write-Host "Seeding database..." -ForegroundColor Yellow
    Write-Host ""
    
    npm run db:seed
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Seeding completed" -ForegroundColor Green
        
        Write-Host ""
        $demo = Read-Host "Add demo data? (Y/N)"
        if ($demo -eq "Y" -or $demo -eq "y") {
            npm run db:seed:demo
        }
    } else {
        Write-Host ""
        Write-Host "✗ Seeding failed" -ForegroundColor Red
    }
    
    Write-Host ""
}

function Open-Studio {
    Write-Host "Opening Prisma Studio..." -ForegroundColor Yellow
    Write-Host "This will open in your browser at http://localhost:5555" -ForegroundColor Gray
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""
    
    npm run db:studio
}

# Main execution
switch ($Action) {
    'status' {
        Get-DatabaseStatus
    }
    'backup' {
        Backup-Database
    }
    'restore' {
        Restore-DatabaseBackup
    }
    'reset' {
        Reset-Database
    }
    'migrate' {
        Run-Migrations
    }
    'seed' {
        Seed-Database
    }
    'studio' {
        Open-Studio
    }
}

Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  .\scripts\database-tools.ps1 status   - Check database status" -ForegroundColor Gray
Write-Host "  .\scripts\database-tools.ps1 backup   - Create backup" -ForegroundColor Gray
Write-Host "  .\scripts\database-tools.ps1 restore  - Restore from backup" -ForegroundColor Gray
Write-Host "  .\scripts\database-tools.ps1 reset    - Reset database (DANGER!)" -ForegroundColor Gray
Write-Host "  .\scripts\database-tools.ps1 migrate  - Run migrations" -ForegroundColor Gray
Write-Host "  .\scripts\database-tools.ps1 seed     - Seed database" -ForegroundColor Gray
Write-Host "  .\scripts\database-tools.ps1 studio   - Open Prisma Studio" -ForegroundColor Gray
Write-Host ""

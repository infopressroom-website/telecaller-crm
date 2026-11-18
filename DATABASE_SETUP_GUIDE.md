# 🗄️ Database Setup Guide

This guide helps you set up PostgreSQL for the Telecaller CRM application.

## Current Status

❌ **PostgreSQL is not currently accessible at `localhost:5432`**

The application requires a PostgreSQL database to run. You have three options:

---

## Option 1: Install PostgreSQL on Windows (Recommended for Production)

### Steps:

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 15 or 16 (latest stable version)

2. **Run the Installer**
   - Double-click the downloaded `.exe` file
   - Follow the installation wizard
   - **Important:** Remember the password you set for the `postgres` user
   - Default port: `5432` (keep this)
   - Install all components (PostgreSQL Server, pgAdmin, Command Line Tools)

3. **Verify Installation**
   - Open Windows Services (press `Win + R`, type `services.msc`)
   - Look for "PostgreSQL" service - ensure it's running
   - Or open pgAdmin 4 (installed with PostgreSQL)

4. **Update Environment Variables** (if needed)
   - If you used a different password, update `.env`:
     ```
     DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/telecaller_crm?schema=public"
     ```

5. **Continue to Setup Steps** (see below)

---

## Option 2: Use Docker (Recommended for Development)

### Prerequisites:
- Install Docker Desktop for Windows from https://www.docker.com/products/docker-desktop/

### Steps:

1. **Start PostgreSQL Container**
   ```powershell
   docker run --name telecaller-db `
     -e POSTGRES_PASSWORD=postgres `
     -e POSTGRES_DB=telecaller_crm `
     -p 5432:5432 `
     -d postgres:15
   ```

2. **Verify Container is Running**
   ```powershell
   docker ps
   ```
   You should see `telecaller-db` in the list

3. **Stop Container** (when you're done for the day)
   ```powershell
   docker stop telecaller-db
   ```

4. **Start Container Again** (next time)
   ```powershell
   docker start telecaller-db
   ```

5. **Continue to Setup Steps** (see below)

---

## Option 3: Use Existing PostgreSQL Server

If you have access to an existing PostgreSQL server (local network, cloud provider, etc.):

### Steps:

1. **Get Connection Details**
   - Host (e.g., `db.example.com` or IP address)
   - Port (usually `5432`)
   - Username
   - Password
   - Database name

2. **Create Database** (if it doesn't exist)
   ```sql
   CREATE DATABASE telecaller_crm;
   ```

3. **Update `.env` File**
   ```
   DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:PORT/telecaller_crm?schema=public"
   ```
   
   Example:
   ```
   DATABASE_URL="postgresql://myuser:mypass@db.example.com:5432/telecaller_crm?schema=public"
   ```

4. **Verify Connection** (optional but recommended)
   - Ensure your IP address is whitelisted
   - Test connection using pgAdmin or DBeaver

5. **Continue to Setup Steps** (see below)

---

## After Database is Available

Once PostgreSQL is installed and running, follow these steps:

### Step 1: Generate Prisma Client
```powershell
npx prisma generate
```

### Step 2: Create Initial Migration
```powershell
npx prisma migrate dev --name init
```

This will:
- Create migration files in `prisma/migrations/`
- Apply the migration to your database
- Create all 42 tables with proper indexes and constraints

**Expected output:**
```
✔ Generated Prisma Client
✔ Applied migration: 20241201000000_init
```

### Step 3: Seed Development Data
```powershell
npm run db:seed
```

This will create:
- All roles and permissions
- Lead sources and call dispositions
- Development user accounts for each role
- Sample data for testing

**Expected output:**
```
Seed complete (development data only).
Dev logins: <role>@crm.test, e.g. telecaller@crm.test — password from SEED_DEV_PASSWORD.
```

### Step 4: Run Database Tests
```powershell
node scripts/test-database.js
```

This will verify:
- ✅ Database connection
- ✅ Tables created (should find 42 tables)
- ✅ Indexes created (performance optimizations)
- ✅ Query performance (< 100ms for simple queries)

**Expected output:**
```
✅ All tests passed!
```

### Step 5: Start Development Server
```powershell
npm run dev
```

The application will be available at: http://localhost:3000

### Step 6: Login
Use one of these development accounts:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `super.admin@crm.test` | `ChangeMe-Dev-Only-123` |
| Admin | `admin@crm.test` | `ChangeMe-Dev-Only-123` |
| Team Lead | `team.lead@crm.test` | `ChangeMe-Dev-Only-123` |
| Telecaller | `telecaller@crm.test` | `ChangeMe-Dev-Only-123` |
| Manager | `manager@crm.test` | `ChangeMe-Dev-Only-123` |

**Note:** You'll be prompted to change your password on first login.

---

## Troubleshooting

### Issue: "Can't reach database server at localhost:5432"

**Solution:**
- Verify PostgreSQL service is running (Windows Services)
- Check if port 5432 is not blocked by firewall
- If using Docker, verify container is running: `docker ps`

### Issue: "Migration failed"

**Solution:**
- Ensure database `telecaller_crm` exists
- Check user has permissions: `GRANT ALL PRIVILEGES ON DATABASE telecaller_crm TO postgres;`
- Check logs: `npx prisma migrate status`

### Issue: "Seed failed - SEED_DEV_PASSWORD not set"

**Solution:**
- Open `.env` file
- Ensure this line exists and has a value:
  ```
  SEED_DEV_PASSWORD="ChangeMe-Dev-Only-123"
  ```

### Issue: "Port 5432 already in use"

**Solution:**
- Another PostgreSQL instance is running
- Stop it or use a different port
- Update `DATABASE_URL` in `.env` with new port

### Issue: "Cannot connect - authentication failed"

**Solution:**
- Verify username and password in `DATABASE_URL`
- For fresh PostgreSQL install, default user is `postgres`
- Reset password if needed: https://stackoverflow.com/questions/12720967/how-to-change-postgresql-user-password

---

## Production Setup

For production deployment, use `npm run db:bootstrap` instead of `db:seed`:

```powershell
# Set admin credentials
$env:BOOTSTRAP_ADMIN_EMAIL="admin@yourcompany.com"
$env:BOOTSTRAP_ADMIN_NAME="Admin Name"

# Run bootstrap
npm run db:bootstrap
```

This creates:
- Reference data (roles, permissions, call dispositions)
- First Super Admin account with temporary password
- NO demo or test data

---

## Database Tools

### pgAdmin 4
- Web-based PostgreSQL administration tool
- Installed with PostgreSQL
- Access: http://localhost:5432 (or find in Start Menu)

### Prisma Studio
```powershell
npm run db:studio
```
- Visual database browser
- Edit data directly
- Access: http://localhost:5555

### VS Code Extensions
- **PostgreSQL** by Chris Kolkman
- **Prisma** by Prisma

---

## Need Help?

1. Check the main README.md
2. Review the error logs
3. Run the test script: `node scripts/test-database.js`
4. Check Prisma documentation: https://www.prisma.io/docs/

---

**Current Configuration:**

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/telecaller_crm?schema=public"
SEED_DEV_PASSWORD="ChangeMe-Dev-Only-123"
```

📝 **Note:** For security, change default passwords in production environments.

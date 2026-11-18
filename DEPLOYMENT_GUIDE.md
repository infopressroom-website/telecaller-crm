# Telecaller CRM - Production Deployment Guide

**Version:** 1.0  
**Last Updated:** November 18, 2026  
**Target Environment:** Production

---

## Table of Contents

1. [Pre-deployment Checklist](#pre-deployment-checklist)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [Post-deployment Steps](#post-deployment-steps)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Pre-deployment Checklist

### Security Review
- [ ] All dependencies updated to latest secure versions
- [ ] No known vulnerabilities in `npm audit`
- [ ] Environment variables properly configured
- [ ] Secrets not committed to repository
- [ ] HTTPS enabled and enforced
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Security headers configured

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] Linting passes without errors
- [ ] Tests pass (unit + integration)
- [ ] Build completes successfully
- [ ] No console.error or console.warn in production code

### Environment Configuration
- [ ] Production `.env` file prepared
- [ ] Database connection string configured
- [ ] Auth secret generated (32+ characters)
- [ ] All required environment variables set
- [ ] Backup strategy defined

### Documentation
- [ ] API documentation complete
- [ ] User manual prepared
- [ ] Admin guide ready
- [ ] Deployment runbook created

---

## Infrastructure Setup

### Recommended Stack

**Option A: Cloud Platform (Vercel/Netlify)**
- **Pros:** Easy, automatic deployments, global CDN
- **Cons:** Limited control, vendor lock-in
- **Best for:** Small to medium teams

**Option B: VPS/Dedicated Server**
- **Pros:** Full control, cost-effective at scale
- **Cons:** More maintenance required
- **Best for:** Large teams, custom requirements

**Option C: Container-based (Docker + Kubernetes)**
- **Pros:** Scalable, portable, industry standard
- **Cons:** Complex setup
- **Best for:** Enterprise deployments

### Recommended Services

#### Application Hosting
- **Vercel** (easiest for Next.js)
- **AWS Elastic Beanstalk**
- **DigitalOcean App Platform**
- **Google Cloud Run**

#### Database
- **AWS RDS PostgreSQL**
- **DigitalOcean Managed Database**
- **Supabase**
- **Neon** (serverless PostgreSQL)

#### Redis Cache
- **Redis Cloud**
- **AWS ElastiCache**
- **Upstash** (serverless Redis)

#### File Storage
- **AWS S3**
- **Cloudflare R2**
- **DigitalOcean Spaces**

#### Email Service
- **Resend** (recommended)
- **SendGrid**
- **Amazon SES**
- **Postmark**

#### Real-time (WebSocket)
- **Pusher** (easiest)
- **Ably**
- **Socket.IO (self-hosted)**

---

## Database Setup

### 1. Create Production Database

**AWS RDS Example:**
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier telecaller-crm-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 20 \
  --backup-retention-period 7 \
  --storage-encrypted
```

**DigitalOcean Example:**
```bash
# Use DigitalOcean control panel or CLI
doctl databases create telecaller-crm-prod \
  --engine pg \
  --version 15 \
  --size db-s-1vcpu-1gb \
  --region nyc1
```

### 2. Configure Database Connection

```env
# Production .env
DATABASE_URL="postgresql://user:password@your-db-host.com:5432/telecaller_crm?sslmode=require"
```

### 3. Run Migrations

```bash
# Test connection first
npx prisma db pull

# Run migrations
npm run db:deploy

# DO NOT run db:seed in production!
# Instead, use db:bootstrap for reference data only
npm run db:bootstrap
```

### 4. Database Security

```sql
-- Create read-only user for reporting
CREATE USER crm_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE telecaller_crm TO crm_readonly;
GRANT USAGE ON SCHEMA public TO crm_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO crm_readonly;

-- Create backup user
CREATE USER crm_backup WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE telecaller_crm TO crm_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO crm_backup;
```

### 5. Backup Strategy

**Automated Backups:**
```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/telecaller-crm"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="telecaller_crm_$DATE.sql.gz"

pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/$FILENAME"

# Upload to S3
aws s3 cp "$BACKUP_DIR/$FILENAME" s3://your-backup-bucket/database/

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

**Restore Process:**
```bash
# Download backup
aws s3 cp s3://your-backup-bucket/database/telecaller_crm_YYYYMMDD.sql.gz .

# Restore
gunzip telecaller_crm_YYYYMMDD.sql.gz
psql $DATABASE_URL < telecaller_crm_YYYYMMDD.sql
```

---

## Application Deployment

### Option A: Vercel Deployment (Recommended)

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Configure Project
```bash
# Login to Vercel
vercel login

# Link project
vercel link

# Set environment variables
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
vercel env add REDIS_URL production
# ... add all required variables
```

#### 3. Deploy
```bash
# Deploy to production
vercel --prod

# Or set up automatic deployments from GitHub
# Connect repository in Vercel dashboard
```

#### 4. Configure Custom Domain
```bash
# Add domain
vercel domains add yourdomain.com

# Configure DNS
# Add CNAME record: yourdomain.com -> cname.vercel-dns.com
```

### Option B: Docker Deployment

#### 1. Create Production Dockerfile
```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Builder
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### 2. Docker Compose for Production
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - AUTH_SECRET=${AUTH_SECRET}
      - NODE_ENV=production
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=telecaller_crm
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### 3. Deploy
```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f app

# Run migrations
docker-compose -f docker-compose.prod.yml exec app npm run db:deploy
```

### Option C: Traditional VPS Deployment

#### 1. Server Setup (Ubuntu 22.04)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2
```

#### 2. Application Setup
```bash
# Create app directory
sudo mkdir -p /var/www/telecaller-crm
sudo chown $USER:$USER /var/www/telecaller-crm

# Clone repository
cd /var/www/telecaller-crm
git clone https://github.com/your-repo/telecaller-crm.git .

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Setup environment
cp .env.example .env
nano .env  # Edit with production values

# Run database migrations
npm run db:deploy
```

#### 3. PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'telecaller-crm',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/telecaller-crm/error.log',
    out_file: '/var/log/telecaller-crm/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
```

#### 4. Nginx Configuration
```nginx
# /etc/nginx/sites-available/telecaller-crm
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/telecaller-crm /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### 5. SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is set up automatically
# Test renewal
sudo certbot renew --dry-run
```

---

## Post-deployment Steps

### 1. Health Check
```bash
# Test application
curl https://yourdomain.com/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-11-18T..."}
```

### 2. Create First Admin User
```bash
# If not using seed data, create admin manually
node scripts/create-admin.js
```

### 3. Configure Monitoring

**Uptime Monitoring:**
- Use UptimeRobot, Pingdom, or StatusCake
- Monitor: `/api/health`
- Alert if down for > 5 minutes

**Application Monitoring:**
```bash
# Install New Relic / Sentry
npm install @sentry/nextjs

# Configure in next.config.js
```

**Log Aggregation:**
- Send logs to CloudWatch, Datadog, or Loggly
- Monitor error rates
- Set up alerts for critical errors

### 4. Setup Cron Jobs

**For Automation Rules:**
```bash
# Add to crontab (crontab -e)
* * * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/automation
```

**For Database Backups:**
```bash
0 2 * * * /path/to/backup-script.sh
```

### 5. Performance Testing
```bash
# Load testing with Apache Bench
ab -n 1000 -c 10 https://yourdomain.com/

# Or use more advanced tools
# - k6.io
# - Artillery
# - JMeter
```

---

## Monitoring & Maintenance

### Daily Checks
- [ ] Application uptime
- [ ] Error rate
- [ ] Response times
- [ ] Database connections
- [ ] Disk space

### Weekly Checks
- [ ] Backup verification
- [ ] Security updates
- [ ] Performance metrics
- [ ] User feedback

### Monthly Tasks
- [ ] Dependency updates
- [ ] Security audit
- [ ] Performance optimization
- [ ] Database maintenance
- [ ] Log rotation

### Quarterly Tasks
- [ ] Disaster recovery drill
- [ ] Security penetration testing
- [ ] Capacity planning
- [ ] Documentation review

---

## Troubleshooting

### Application Won't Start
```bash
# Check logs
pm2 logs telecaller-crm

# Common issues:
# 1. Missing environment variables
# 2. Database connection failure
# 3. Port already in use

# Verify environment
node -e "console.log(process.env.DATABASE_URL)"

# Test database connection
npx prisma db pull
```

### High CPU Usage
```bash
# Check PM2 metrics
pm2 monit

# If consistently high:
# 1. Increase server resources
# 2. Optimize database queries
# 3. Add caching
# 4. Check for infinite loops
```

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Check connection pool
# Increase pool size in DATABASE_URL:
# ?connection_limit=20&pool_timeout=30
```

### Memory Leaks
```bash
# Monitor memory
pm2 monit

# Take heap snapshot
node --inspect server.js
# Use Chrome DevTools to analyze
```

---

## Rollback Procedure

### If Deployment Fails

**Vercel:**
```bash
# Instant rollback to previous deployment
vercel rollback
```

**PM2:**
```bash
# Stop current version
pm2 stop telecaller-crm

# Checkout previous version
git checkout HEAD~1

# Reinstall dependencies
npm ci --only=production

# Rebuild
npm run build

# Restart
pm2 restart telecaller-crm
```

**Docker:**
```bash
# Use previous image
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --scale app=2 previous-image
```

---

## Contact & Support

**Emergency Contact:** [Your contact info]  
**Documentation:** https://docs.yourcompany.com  
**Status Page:** https://status.yourcompany.com  

---

**Last Updated:** November 18, 2026  
**Next Review:** December 18, 2026

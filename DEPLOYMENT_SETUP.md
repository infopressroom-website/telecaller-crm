# 🚀 Vercel Deployment Guide - Telecaller CRM

Complete step-by-step guide for deploying your CRM to production.

---

## 📋 Prerequisites

- ✅ Code pushed to GitHub: https://github.com/infopressroom-website/telecaller-crm
- ✅ GitHub account
- ✅ Vercel account (free tier works)
- ✅ Neon account (free tier works)

---

## 🎯 Quick Deploy (Automated)

### Option 1: Automated Script (Recommended)

```powershell
# Preview deployment (test first)
.\scripts\deploy-vercel.ps1

# Production deployment
.\scripts\deploy-vercel.ps1 -Production
```

The script will:
- ✅ Check TypeScript, ESLint, and build
- ✅ Deploy to Vercel
- ✅ Show you next steps

---

## 🔧 Manual Deployment Steps

### Step 1: Install Vercel CLI

```powershell
npm install -g vercel
```

### Step 2: Login to Vercel

```powershell
vercel login
```

### Step 3: Link Project to GitHub Repository

```powershell
vercel link
```

Select:
- Scope: Your account
- Link to existing project: No
- Project name: `telecaller-crm`
- Directory: `./`
- Override settings: No

### Step 4: Deploy Preview

```powershell
vercel
```

This creates a preview deployment for testing.

### Step 5: Deploy to Production

```powershell
vercel --prod
```

---

## 🗄️ Database Setup (Neon PostgreSQL)

### Step 1: Create Neon Account

1. Go to: https://neon.tech
2. Sign up (free tier: 0.5 GB storage)
3. Create new project: `telecaller-crm`
4. Region: Select closest to your users (Singapore/US)

### Step 2: Get Database Connection String

1. In Neon dashboard, go to **Connection Details**
2. Copy the **Connection string**
3. Format: `postgresql://user:password@ep-xxx.neon.tech/telecaller_crm?sslmode=require`

### Step 3: Add to Vercel Environment Variables

1. Go to: https://vercel.com/dashboard
2. Select your project: `telecaller-crm`
3. Go to: **Settings** → **Environment Variables**
4. Add these variables:

#### 🔴 Required Variables

```env
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/telecaller_crm?sslmode=require
NEXTAUTH_SECRET=your-super-secret-key-here-use-openssl-rand-base64-32
NEXTAUTH_URL=https://your-app.vercel.app
```

**Generate NEXTAUTH_SECRET:**
```powershell
# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Or use online: https://generate-secret.vercel.app/32
```

#### 🟡 Optional Variables (Enhanced Features)

```env
# Redis Caching (Upstash - Free tier)
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379

# Real-time Notifications (Pusher - Free tier)
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=ap2

# Email Service (Resend - Free tier: 100 emails/day)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### Step 4: Redeploy After Adding Variables

```powershell
vercel --prod
```

Migrations will run automatically during build.

---

## 🌱 Seed Database (Optional)

After deployment, seed the database with demo data:

```powershell
# Set DATABASE_URL from Neon
$env:DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/telecaller_crm?sslmode=require"

# Run migrations (if not auto-run)
npx prisma migrate deploy

# Seed database
npm run db:seed

# Seed demo data
npm run db:seed:demo
```

---

## 🎨 Custom Domain (Optional)

### Add Custom Domain to Vercel

1. Go to: **Project Settings** → **Domains**
2. Add your domain: `crm.yourdomain.com`
3. Follow DNS configuration steps
4. Update `NEXTAUTH_URL` to your custom domain

---

## 📊 Optional Services Setup

### 1. Upstash Redis (Free Tier)

**Why:** Faster caching, better performance

1. Go to: https://upstash.com
2. Create free account
3. Create Redis database
4. Copy `REDIS_URL`
5. Add to Vercel environment variables

### 2. Pusher (Free Tier - 200k messages/day)

**Why:** Real-time notifications

1. Go to: https://pusher.com
2. Create free account
3. Create new app
4. Copy credentials (App ID, Key, Secret, Cluster)
5. Add to Vercel environment variables

### 3. Resend (Free Tier - 100 emails/day)

**Why:** Email notifications

1. Go to: https://resend.com
2. Create free account
3. Verify your domain (or use resend.dev for testing)
4. Create API key
5. Add to Vercel environment variables

---

## ✅ Post-Deployment Checklist

- [ ] Deployment successful (green checkmark in Vercel)
- [ ] Database connected (check Vercel deployment logs)
- [ ] Migrations applied (42 tables created)
- [ ] Can access app URL: https://your-app.vercel.app
- [ ] Login works with seeded credentials
- [ ] API endpoints responding (`/api/health`)
- [ ] Environment variables set correctly
- [ ] Custom domain configured (if applicable)

---

## 🔐 Default Login Credentials

After seeding database:

**Admin Account:**
- Email: `admin@crm.test`
- Password: `ChangeMe-Dev-Only-123`

**⚠️ IMPORTANT:** Change password immediately after first login!

---

## 🐛 Troubleshooting

### Build Fails

```powershell
# Check build locally first
npm run build

# Check TypeScript
npm run typecheck

# Check linting
npm run lint
```

### Database Connection Issues

1. Verify `DATABASE_URL` format includes `?sslmode=require`
2. Check Neon dashboard - database is active
3. Test connection locally:
   ```powershell
   npx prisma db push
   ```

### Environment Variables Not Working

1. Make sure you redeployed after adding variables
2. Variables should be added to "Production" environment
3. Check variable names (case-sensitive)

### Migrations Not Running

```powershell
# Manually run migrations via Neon SQL Editor
# Or run locally with production DATABASE_URL
npx prisma migrate deploy
```

---

## 📈 Monitoring & Analytics

### Vercel Analytics (Built-in)

1. Go to: **Project** → **Analytics**
2. Enable Vercel Analytics (free)
3. Track page views, performance

### Error Tracking

Check deployment logs:
```powershell
vercel logs
```

---

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to GitHub:

```powershell
# Make changes locally
git add .
git commit -m "feat: new feature"
git push origin main

# Vercel automatically deploys! 🚀
```

**Branch Deployments:**
- `main` branch → Production
- Other branches → Preview deployments

---

## 💰 Cost Estimate (Free Tier)

| Service | Free Tier | Upgrade Cost |
|---------|-----------|--------------|
| **Vercel** | Unlimited previews + 100GB bandwidth | $20/month Pro |
| **Neon** | 0.5 GB storage | $19/month Pro |
| **Upstash** | 10k commands/day | $0.20 per 100k |
| **Pusher** | 200k messages/day | $49/month |
| **Resend** | 100 emails/day | $20/month (50k emails) |

**Total:** $0/month (free tier) → Scale as you grow

---

## 🎉 Success!

Your Telecaller CRM is now live on Vercel with:

- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Automatic deployments from GitHub
- ✅ PostgreSQL database (Neon)
- ✅ Environment variables secured
- ✅ Production-ready infrastructure

**Share your deployment:** https://your-app.vercel.app

---

## 📞 Support

- Vercel Docs: https://vercel.com/docs
- Neon Docs: https://neon.tech/docs
- GitHub Issues: https://github.com/infopressroom-website/telecaller-crm/issues

---

**Made with ❤️ by Kiro AI**

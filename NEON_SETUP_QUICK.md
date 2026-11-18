# 🗄️ Neon Database Setup - Quick Reference

## Browser Tabs Opened:
1. **Neon Signup:** https://console.neon.tech/signup
2. **Vercel Settings:** https://vercel.com/infopressroomin-3268/telecaller-crm/settings/environment-variables

---

## 📋 Step 1: Create Neon Database (3 minutes)

### In Neon Tab:
1. **Sign up** with GitHub (easiest)
2. Verify your email
3. Click **"Create Project"**
   - Project name: `telecaller-crm`
   - Region: **Asia Pacific (Singapore)** ← Closest to India
   - PostgreSQL version: 15 (default)
4. Click **"Create Project"**
5. **Copy the Connection String** from "Connection Details"

Example format:
```
postgresql://username:password@ep-something-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

---

## 📋 Step 2: Add Environment Variables to Vercel (2 minutes)

### In Vercel Tab:

Click **"Add New"** for each variable:

### Variable 1: DATABASE_URL
```
Name: DATABASE_URL
Value: [Paste your Neon connection string here]
Environment: ✓ Production
```

### Variable 2: NEXTAUTH_SECRET
```
Name: NEXTAUTH_SECRET
Value: [Copy from generated secret below]
Environment: ✓ Production
```

**Your Generated Secret:**
```
Run this PowerShell command to generate:
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

Or use: https://generate-secret.vercel.app/32

### Variable 3: NEXTAUTH_URL
```
Name: NEXTAUTH_URL
Value: https://telecaller-crm-iota.vercel.app
Environment: ✓ Production
```

---

## 📋 Step 3: Redeploy (3 minutes)

After adding all 3 variables in Vercel:

```powershell
cd d:\telecaller-crm
vercel --prod
```

Wait for deployment to complete (~3 minutes).

---

## 📋 Step 4: Seed Database (Optional, 2 minutes)

After deployment completes:

```powershell
# Set your Neon connection string
$env:DATABASE_URL="postgresql://your-connection-string-here"

# Push schema to database
npx prisma db push

# Seed with demo data
npm run db:seed
```

**Default Login Credentials:**
- Email: `admin@crm.test`
- Password: `ChangeMe-Dev-Only-123`

⚠️ **Change password immediately after first login!**

---

## ✅ Verification Checklist

- [ ] Neon account created
- [ ] Project "telecaller-crm" created
- [ ] Connection string copied
- [ ] All 3 variables added to Vercel (Production environment)
- [ ] Redeployed with `vercel --prod`
- [ ] Deployment successful
- [ ] Can access: https://telecaller-crm-iota.vercel.app
- [ ] Can login with admin credentials
- [ ] Database has data (if seeded)

---

## 🐛 Troubleshooting

### "Database connection failed"
- Check connection string has `?sslmode=require` at the end
- Verify Neon database is "Active" in dashboard
- Ensure variable name is exactly `DATABASE_URL` (case-sensitive)

### "Invalid NEXTAUTH_SECRET"
- Must be at least 32 characters
- No spaces or special characters that need escaping
- Regenerate if needed

### "Page not loading"
- Wait 1-2 minutes after deployment
- Clear browser cache
- Try incognito/private window
- Check Vercel deployment logs: `vercel logs`

---

## 💰 Cost

**FREE Forever for this project:**
- Neon Free Tier: 0.5 GB storage (enough for 10,000+ leads)
- Vercel Free Tier: Unlimited deployments
- Total: ₹0/month

---

## 🎉 Success!

Once completed, your CRM will be:
- ✅ Live at https://telecaller-crm-iota.vercel.app
- ✅ Connected to PostgreSQL database
- ✅ Auto-deploying from GitHub
- ✅ Production-ready with HTTPS
- ✅ Scalable and fast (global CDN)

---

**Need help?** Check full guide: `DEPLOYMENT_SETUP.md`

# MailDesk Deployment Guide

## Overview
- **Backend** → Railway (Node.js + PostgreSQL + Redis)
- **Frontend** → Vercel (React SPA)
- **Gmail integration** → Google Cloud (OAuth + Pub/Sub)

---

## Step 1 — Push to GitHub

Create a new repo at github.com and push the `maildesk` folder:

```bash
cd maildesk
git init
git add .
git commit -m "Initial MailDesk setup"
git remote add origin https://github.com/YOUR-USERNAME/maildesk.git
git push -u origin main
```

---

## Step 2 — Deploy on Railway

1. Go to **railway.app** → sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"** → select your repo
3. When prompted for the **root directory**, enter `backend`
4. Railway will detect Node.js and deploy automatically

**Add PostgreSQL:**
- Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
- Railway auto-injects `DATABASE_URL` into your backend

**Add Redis:**
- Click **"+ New"** → **"Database"** → **"Add Redis"**
- Railway auto-injects `REDIS_URL` into your backend

**Get your backend URL:**
- Click your backend service → **Settings** → **Networking** → **Generate Domain**
- Copy the URL (e.g. `maildesk-backend-production.railway.app`)

**Set environment variables** in your backend service's Variables tab:
```
GOOGLE_CLIENT_ID=         (from Step 4)
GOOGLE_CLIENT_SECRET=     (from Step 4)
GOOGLE_REDIRECT_URI=      https://YOUR-BACKEND.railway.app/auth/google/callback
GOOGLE_PUBSUB_TOPIC=      projects/YOUR-PROJECT-ID/topics/maildesk-gmail
JWT_SECRET=               (generate with: openssl rand -base64 32)
FRONTEND_URL=             https://your-app.vercel.app  (from Step 3)
NODE_ENV=                 production
```

**Run the database schema:**
- Click your PostgreSQL service → **Data tab** → paste the contents of `database/schema.sql` → Run

---

## Step 3 — Deploy Frontend on Vercel

1. Go to **vercel.com** → **"Add New Project"** → import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variable:
   ```
   VITE_API_URL=https://YOUR-BACKEND.railway.app
   ```
6. Deploy — copy your Vercel URL (e.g. `https://maildesk.vercel.app`)
7. Go back to Railway and set `FRONTEND_URL` to this Vercel URL

---

## Step 4 — Google Cloud Setup

### A. Enable APIs
1. Go to **console.cloud.google.com**
2. Search **"Gmail API"** → Enable
3. Search **"Cloud Pub/Sub API"** → Enable

### B. Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** → Fill in:
   - App name: `MailDesk`
   - User support email: your email
   - Developer contact email: your email
3. Click through to **Scopes** → Add:
   - `openid`, `email`, `profile`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
4. **Save and Continue** through the rest

### C. Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Application type: **Web application**
4. Name: `MailDesk`
5. Under **Authorised redirect URIs**, add:
   ```
   https://YOUR-BACKEND.railway.app/auth/google/callback
   ```
6. Click **Create**
7. Copy the **Client ID** and **Client Secret** → paste into Railway env vars

### D. Create Pub/Sub Topic
1. Go to **Pub/Sub** → **Topics** → **"+ Create Topic"**
2. Topic ID: `maildesk-gmail`
3. Click **Create**

### E. Grant Gmail Permission to Publish
1. Click on the `maildesk-gmail` topic
2. Click **"Add Principal"** (or Permissions tab)
3. New principal: `gmail-api-push@system.gserviceaccount.com`
4. Role: **Pub/Sub Publisher**
5. Click **Save**

### F. Create Push Subscription
1. Go to **Pub/Sub** → **Subscriptions** → **"+ Create Subscription"**
2. Subscription ID: `maildesk-gmail-push`
3. Select topic: `maildesk-gmail`
4. Delivery type: **Push**
5. Endpoint URL:
   ```
   https://YOUR-BACKEND.railway.app/gmail/webhook
   ```
6. Click **Create**

### G. Copy Topic Name to Railway
The full topic name is shown on the Topics page, formatted as:
```
projects/YOUR-PROJECT-ID/topics/maildesk-gmail
```
Set this as `GOOGLE_PUBSUB_TOPIC` in Railway.

---

## Step 5 — Test the App

1. Open your Vercel URL
2. Click "Continue with Google"
3. Sign in — you'll be redirected back and your Gmail will start syncing
4. Invite team members by sharing your app URL (they sign in with their own Google accounts)

---

## Local Development

```bash
# Backend
cd backend
cp .env.example .env
# Fill in your .env values
npm install
npm run dev

# Frontend (in a new terminal)
cd frontend
npm install
npm run dev
```

Requirements: Node.js 18+, PostgreSQL 14+, Redis 6+

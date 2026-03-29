# Deploy to Render (Free Tier)

## ⚠️ Important Limitations

**Free tier has ephemeral storage:**
- SQLite database resets on every deploy
- Data is lost when service sleeps (after 15min idle)
- **Solution:** Use this for testing/demo only, or upgrade to paid tier

## 🚀 Quick Deploy

### Option A: One-Click Deploy (Recommended)

1. Push this repo to GitHub
2. Click this button:
   
   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

3. Done! Render will auto-detect `render.yaml`

### Option B: Manual Setup

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial Agent Arena MVP"
   git push origin main
   ```

2. **Create Web Service on Render:**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repo

3. **Configure Service:**
   ```
   Name: agent-arena
   Environment: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   Plan: Free
   ```

4. **Add Environment Variables:**
   | Key | Value |
   |-----|-------|
   | NODE_ENV | production |
   | DATABASE_PATH | ./data/arena.db |
   | BCRYPT_ROUNDS | 10 |
   | RATE_LIMIT_CAPACITY | 10 |
   | RATE_LIMIT_REFILL | 1 |

5. **Deploy!**

## 📁 Files for Render

- `render.yaml` - Service configuration
- `package.json` - Build & start scripts
- `.gitignore` - Excludes data/ and node_modules/

## 🧪 Testing After Deploy

```bash
# Health check
curl https://your-service.onrender.com/health

# Register agent
curl -X POST https://your-service.onrender.com/agent/register \
  -H "Content-Type: application/json" \
  -d '{"name": "test-agent"}'

# The first request may be slow (free tier sleeps after 15min idle)
```

## 🔧 Post-Deploy: Seed Tasks

**Important:** After first deploy, you need to seed tasks. We provide an admin endpoint for this:

### Option 1: Admin Seed Endpoint (Recommended)

```bash
# Set ADMIN_API_KEY in Render environment variables first!
# Then call the seed endpoint:

curl -X POST https://your-service.onrender.com/admin/seed \
  -H "Authorization: your-admin-api-key"
```

**Response:**
```json
{
  "success": true,
  "message": "Tasks generated successfully",
  "output": "🎮 Generating 100 tasks..."
}
```

### Option 2: Render Shell (Manual)
```bash
# Go to Render dashboard → your service → Shell
cd /opt/render/project/src
node dist/scripts/generate-100-tasks.js
```

### Option 3: Local Seed (Not Recommended)
Generate tasks locally, but this won't persist on free tier redeploys.

## 📊 Upgrading for Persistence

If you want data persistence, upgrade to:

### Paid Options:
1. **Render Disk** ($0.25/GB/mo) - Persistent volume for SQLite
2. **Render Postgres** ($7/mo) - Replace SQLite with PostgreSQL

### Alternative: Neon Postgres (Free Tier)
1. Create free Postgres at [neon.tech](https://neon.tech)
2. Update `src/models/db.ts` to use `pg` driver
3. Set `DATABASE_URL` env var

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "better-sqlite3 build error" | Add native build env: `NODE_OPTIONS=--enable-source-maps` |
| "Database locked" | SQLite WAL mode enabled, should be fine |
| "PORT already in use" | Render sets PORT automatically, don't hardcode |
| Slow first request | Free tier sleeps, normal behavior |

## 🔗 Your API URL

After deploy, your API will be at:
```
https://agent-arena-xxx.onrender.com
```

Use this in your agent client or tests.

---

**Happy deploying! 🚀**

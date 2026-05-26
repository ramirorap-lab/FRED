# Fred — Your Film Friend

A curated streaming recommendation app. Named after Alfred Hitchcock.

---

## Deploy to Vercel in 5 steps

### Step 1 — Create a GitHub account
Go to github.com and create a free account if you don't have one.

### Step 2 — Create a new repository
1. Click the **+** button (top right) → "New repository"
2. Name it `fred`
3. Set it to **Private**
4. Click "Create repository"

### Step 3 — Upload the files
1. In your new repository, click **"uploading an existing file"**
2. Drag and drop ALL the files from this folder (including the `app` folder)
3. Write "Initial commit" in the message box
4. Click **"Commit changes"**

### Step 4 — Deploy on Vercel
1. Go to vercel.com → sign up with your GitHub account
2. Click **"Add New Project"**
3. Select your `fred` repository
4. Click **"Deploy"** — Vercel detects Next.js automatically

### Step 5 — Add your TMDB token
1. In Vercel, go to your project → **Settings → Environment Variables**
2. Add:
   - **Name:** `TMDB_TOKEN`
   - **Value:** (paste your TMDB Bearer token)
3. Click **"Save"**
4. Go to **Deployments** → click the three dots on the latest → **"Redeploy"**

Your Fred app is live. 🎬

---

## Project structure

```
fred/
├── app/
│   ├── layout.js          # Root layout, fonts
│   ├── page.js            # Main app (all screens)
│   ├── globals.css        # All styles
│   └── api/
│       └── picks/
│           └── route.js   # TMDB API (server-side)
├── .env.local             # Your secret keys (NOT uploaded to GitHub)
├── .gitignore
└── package.json
```

## Next features to build
- [ ] Connect OpenAI for real Ask Fred responses
- [ ] Supabase for saved Stack (persists between sessions)
- [ ] Real TMDB poster runtime fetch
- [ ] Share Stack with friends

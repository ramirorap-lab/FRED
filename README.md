# Fred v0.2 — Supabase Edition

> 2 films · 1 series · curated for you

---

## What's new in v0.2
- Picks served from **Supabase** database (real data, filterable)
- **2 movies + 1 series** format (Safe Pick + Stretch + Wildcard)
- Fred Score algorithm ranks by mood match, rating, Letterboxd signal
- Pick type labels: Fred's pick / Worth the risk / Wildcard
- Posters from TMDB CDN

---

## Setup: 3 steps

### 1. Supabase
1. Go to [supabase.com](https://supabase.com) → New Project → name it `fred`
2. Wait for it to finish creating (~1 min)
3. Go to **SQL Editor** → paste and run `fred_supabase_schema.sql`
4. In **SQL Editor** → paste and run `fred_seed.sql`
5. Go to **Settings → API** → copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **anon public key** → this is your `SUPABASE_ANON_KEY`

### 2. GitHub
1. Create new repo: `fred` (private)
2. Upload all files from this folder
3. Commit

### 3. Vercel
1. [vercel.com](https://vercel.com) → Add New Project → import `fred` repo
2. Go to **Settings → Environment Variables** and add:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJ...` |
| `TMDB_TOKEN` | your TMDB bearer token |

3. **Redeploy** → Fred is live.

---

## File structure
```
fred/
├── app/
│   ├── layout.js           # Fonts + metadata
│   ├── page.js             # Full app (all 4 screens)
│   ├── globals.css         # All styles
│   └── api/picks/
│       └── route.js        # Supabase query → 2 movies + 1 series
├── lib/
│   └── supabase.js         # Supabase client
├── .env.local              # Your secrets (never commit this)
└── package.json
```

---

## Next steps
- [ ] Letterboxd CSV upload → taste profile
- [ ] Connect OpenAI for real Ask Fred responses
- [ ] User accounts (Supabase Auth)
- [ ] Persistent Stack (saved to database)
- [ ] Share Stack with friends

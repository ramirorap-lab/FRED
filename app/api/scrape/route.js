import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const TMDB_TOKEN   = process.env.TMDB_TOKEN;
const CRON_SECRET  = process.env.CRON_SECRET;

const TMDB = 'https://api.themoviedb.org/3';

// Subreddits + their top posts endpoints
const REDDIT_SOURCES = [
  {
    id:  'reddit_moviesuggestions',
    url: 'https://old.reddit.com/r/MovieSuggestions/top.json?t=month&limit=50',
  },
  {
    id:  'reddit_truefilm',
    url: 'https://old.reddit.com/r/TrueFilm/top.json?t=month&limit=50',
  },
  {
    id:  'reddit_criterion',
    url: 'https://old.reddit.com/r/criterion/top.json?t=month&limit=30',
  },
  {
    id:  'reddit_horror',
    url: 'https://old.reddit.com/r/horror/top.json?t=month&limit=30',
  },
];
// Keywords that suggest a film title is being mentioned
const TITLE_PATTERNS = [
  /\bwatched\s+["']?([A-Z][^"'\n]+?)["']?\s+(?:last|tonight|yesterday|and|,)/gi,
  /\brecommend\s+["']?([A-Z][^"'\n]+?)["']?\s*[,.\-–]/gi,
  /\b["']([A-Z][A-Za-z\s:,'-]{3,50})["']\s+\((\d{4})\)/g,
  /\b([A-Z][A-Za-z\s:'-]{3,50})\s+\((\d{4})\)/g,
];

// Mood keywords in post text
const MOOD_MAP = {
  smart:     ['cerebral', 'intelligent', 'thought-provoking', 'complex', 'nuanced', 'profound', 'literary'],
  dark:      ['dark', 'noir', 'disturbing', 'bleak', 'gritty', 'unsettling', 'grim', 'haunting'],
  funny:     ['funny', 'hilarious', 'comedy', 'humor', 'laughed', 'witty', 'absurd'],
  romantic:  ['romantic', 'love story', 'relationship', 'heartwarming', 'emotional', 'touching'],
  intense:   ['intense', 'tense', 'thriller', 'edge of my seat', 'suspense', 'gripping'],
  horror:    ['horror', 'scary', 'terrifying', 'creepy', 'nightmare', 'frightening'],
  adventure: ['adventure', 'epic', 'quest', 'journey', 'exploration', 'exciting'],
  family:    ['family', 'kids', 'wholesome', 'heartwarming', 'all ages'],
};

function inferMoods(text) {
  const lower = text.toLowerCase();
  return Object.entries(MOOD_MAP)
    .filter(([, keywords]) => keywords.some(k => lower.includes(k)))
    .map(([mood]) => mood);
}

function extractTitlesFromText(text, score) {
  const found = [];
  const clean = text.replace(/https?:\/\/\S+/g, '').slice(0, 2000);

  // Match "Title (Year)" format — most reliable
  const yearPattern = /\b([A-Z][A-Za-z\s:,'-]{2,50})\s+\((\d{4})\)/g;
  let match;
  while ((match = yearPattern.exec(clean)) !== null) {
    const title = match[1].trim();
    const year  = parseInt(match[2]);
    if (year >= 1920 && year <= 2026 && title.length >= 3) {
      found.push({ title, year, score });
    }
  }

  return found;
}

async function fetchRedditPosts(source) {
  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FredApp/1.0; film recommendations)',
      },
    });
   const text = await res.text();
console.log(`Reddit ${source.id} status: ${res.status}, body: ${text.slice(0, 200)}`);
if (!res.ok) return [];
try {
  return JSON.parse(text)?.data?.children?.map(c => c.data) || [];
} catch { return []; }
    const data = await res.json();
    return data?.data?.children?.map(c => c.data) || [];
  } catch (err) {
    console.error(`Reddit fetch error for ${source.id}:`, err.message);
    return [];
  }
}

async function enrichWithTMDB(title, year) {
  if (!TMDB_TOKEN) return null;
  try {
    const q   = encodeURIComponent(title);
    const url = year
      ? `${TMDB}/search/movie?query=${q}&year=${year}&language=en-US`
      : `${TMDB}/search/movie?query=${q}&language=en-US`;
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const data = await res.json();
    const results = data?.results || [];
    const match = results.find(r => {
      const t  = (r.title || '').toLowerCase();
      const ry = r.release_date?.slice(0, 4);
      return t === title.toLowerCase() && (!year || !ry || Math.abs(parseInt(ry) - year) <= 1);
    }) || results[0];
    if (!match) return null;
    return {
      tmdb_id:     match.id,
      poster_path: match.poster_path,
      rating:      match.vote_average,
    };
  } catch { return null; }
}

async function upsertToSupabase(entries) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !entries.length) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/curated_pool`, {
      method: 'POST',
      headers: {
        'apikey':       SUPABASE_KEY,
        'Authorization':`Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer':       'resolution=merge-duplicates',
      },
      body: JSON.stringify(entries),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase upsert error:', err.slice(0, 200));
    }
  } catch (err) {
    console.error('Supabase error:', err.message);
  }
}

export async function GET(request) {
  // Verify cron secret
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('Starting Reddit scrape...');
  const allEntries = [];
  const seen       = new Set();

  for (const source of REDDIT_SOURCES) {
    console.log(`Fetching ${source.id}...`);
    const posts = await fetchRedditPosts(source);
    console.log(`Got ${posts.length} posts from ${source.id}`);

    for (const post of posts) {
      const fullText = `${post.title} ${post.selftext || ''}`;
      const titles   = extractTitlesFromText(fullText, post.score || 0);
      const moods    = inferMoods(fullText);

      for (const { title, year, score } of titles) {
        const key = `${title.toLowerCase()}::${source.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        allEntries.push({
          title,
          year:       year || null,
          type:       'movie',
          source:     source.id,
          source_url: `https://reddit.com${post.permalink}`,
          score,
          moods:      moods.length ? moods : ['smart'],
          enriched:   false,
        });
      }
    }
  }

  console.log(`Found ${allEntries.length} titles total`);

  // Enrich top 20 with TMDB (rate limit friendly)
  const toEnrich = allEntries.sort((a, b) => b.score - a.score).slice(0, 20);
  for (const entry of toEnrich) {
    const tmdb = await enrichWithTMDB(entry.title, entry.year);
    if (tmdb) {
      entry.tmdb_id     = tmdb.tmdb_id;
      entry.poster_path = tmdb.poster_path;
      entry.rating      = tmdb.rating;
      entry.enriched    = true;
    }
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }

  // Save to Supabase in batches
  const batchSize = 20;
  for (let i = 0; i < allEntries.length; i += batchSize) {
    await upsertToSupabase(allEntries.slice(i, i + batchSize));
  }

  return NextResponse.json({
    success: true,
    scraped: allEntries.length,
    enriched: toEnrich.filter(e => e.enriched).length,
    sources: REDDIT_SOURCES.map(s => s.id),
  });
}

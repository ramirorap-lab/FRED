import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TMDB_TOKEN = process.env.TMDB_TOKEN;

const SUBREDDITS = [
  'movierecommendations',
  'flicks',
  'criterion',
  'TrueFilm',
];

// Fetch top posts from a subreddit using .json — no auth needed
async function fetchSubreddit(sub) {
  const res = await fetch(
    `https://www.reddit.com/r/${sub}/top.json?t=week&limit=50`,
    {
      headers: {
        // Reddit requires a User-Agent — identify as your app
        'User-Agent': 'FRED/1.0 (film recommendation app; contact@fred-psi.vercel.app)',
      },
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data?.data?.children?.map(c => c.data) || [];
}

// Extract a film title from a post title using heuristics
// e.g. "Just watched Parasite (2019) — incredible"
//      "Looking for films like Arrival"
//      "[Rec] The Brutalist"
function extractTitleFromPost(postTitle) {
  // Remove common prefixes
  let t = postTitle
    .replace(/^\[rec\]\s*/i, '')
    .replace(/^just watched[:\s]*/i, '')
    .replace(/^rewatched[:\s]*/i, '')
    .replace(/^finally watched[:\s]*/i, '')
    .replace(/^watched[:\s]*/i, '')
    .trim();

  // Extract "Title (Year)" pattern
  const withYear = t.match(/^(.+?)\s*\(\d{4}\)/);
  if (withYear) return withYear[1].trim();

  // Take everything before a dash or em-dash
  const beforeDash = t.match(/^(.+?)\s*[—–-]\s/);
  if (beforeDash) return beforeDash[1].trim();

  // If short enough, use the whole title
  if (t.length < 60 && !t.includes('?')) return t.trim();

  return null;
}

// Search TMDB for a film title
async function searchTMDB(title) {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&language=en-US&page=1`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  const data = await res.json();
  const result = data.results?.[0];
  if (!result || result.vote_count < 50) return null;
  return result;
}

// Get streaming platform
async function getPlatform(id) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${id}/watch/providers`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  const data = await res.json();
  return data.results?.US?.flatrate?.[0]?.provider_name || null;
}

export async function GET(req) {
  // Verify cron secret so only Vercel can trigger this
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Fetch posts from all subreddits
    const allPosts = (await Promise.all(SUBREDDITS.map(fetchSubreddit))).flat();

    // 2. Count film mentions
    const mentionCount = {};
    const mentionPosts = {};

    for (const post of allPosts) {
      const title = extractTitleFromPost(post.title);
      if (!title || title.length < 3) continue;
      const key = title.toLowerCase();
      mentionCount[key] = (mentionCount[key] || 0) + 1;
      if (!mentionPosts[key]) mentionPosts[key] = { title, score: post.score, sub: post.subreddit };
      else mentionPosts[key].score += post.score;
    }

    // 3. Sort by mentions × score, take top 10
    const candidates = Object.entries(mentionCount)
      .map(([key, count]) => ({ ...mentionPosts[key], count }))
      .sort((a, b) => (b.count * b.score) - (a.count * a.score))
      .slice(0, 10);

    // 4. Verify each against TMDB
    const verified = [];
    for (const candidate of candidates) {
      const film = await searchTMDB(candidate.title);
      if (!film) continue;
      const platform = await getPlatform(film.id);
      verified.push({
        tmdb_id:     film.id,
        title:       film.title,
        poster:      film.poster_path,
        backdrop:    film.backdrop_path,
        year:        film.release_date?.slice(0, 4),
        rating:      film.vote_average?.toFixed(1),
        platform:    platform || 'Check streaming',
        mention_count: candidate.count,
        reddit_score:  candidate.score,
        subreddit:   candidate.sub,
        fetched_at:  new Date().toISOString(),
      });
      // Rate limit — be polite to TMDB
      await new Promise(r => setTimeout(r, 100));
    }

    if (!verified.length) {
      return NextResponse.json({ message: 'No verified films found', candidates });
    }

    // 5. Upsert into Supabase reddit_picks table
    const { error } = await supabase
      .from('reddit_picks')
      .upsert(verified, { onConflict: 'tmdb_id' });

    if (error) throw error;

    return NextResponse.json({
      message: `Stored ${verified.length} trending films`,
      films: verified.map(f => f.title),
    });

  } catch (err) {
    console.error('Reddit cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

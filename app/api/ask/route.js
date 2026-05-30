import { NextResponse } from 'next/server';

// TMDB genre IDs
const GENRE_MAP = {
  comedy: 35, thriller: 53, horror: 27, romance: 10749,
  drama: 18, action: 28, documentary: 99, animation: 16,
  'sci-fi': 878, mystery: 9648, crime: 80,
};

// Detect year mentions like "2025", "last year", "this year"
function extractYear(text) {
  const match = text.match(/\b(20\d{2})\b/);
  if (match) return match[1];
  if (/this year/i.test(text)) return '2026';
  if (/last year/i.test(text)) return '2025';
  return null;
}

// Detect genre keywords
function extractGenre(text) {
  const t = text.toLowerCase();
  for (const [name, id] of Object.entries(GENRE_MAP)) {
    if (t.includes(name)) return { name, id };
  }
  return null;
}

// Search TMDB for best matching title
async function searchTMDB(genre, year, platforms, tmdbToken) {
  const params = new URLSearchParams({
    sort_by: 'vote_average.desc',
    'vote_count.gte': '50',
    with_genres: genre.id,
    language: 'en-US',
    include_adult: 'false',
    page: '1',
  });

  if (year) {
    params.set('primary_release_year', year);
  }

  // Map platform names to TMDB provider IDs
  const PROVIDER_IDS = {
    'Netflix': '8', 'Prime Video': '9', 'Hulu': '15',
    'Max': '1899', 'Apple TV+': '350', 'Disney+': '337', 'Peacock': '386',
  };
  const providerIds = platforms
    .map(p => PROVIDER_IDS[p])
    .filter(Boolean)
    .join('|');
  if (providerIds) {
    params.set('with_watch_providers', providerIds);
    params.set('watch_region', 'US');
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?${params}`,
    { headers: { Authorization: `Bearer ${tmdbToken}` } }
  );
  const data = await res.json();
  return data.results?.[0] || null;
}

// Get streaming providers for a movie
async function getProviders(movieId, tmdbToken) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`,
    { headers: { Authorization: `Bearer ${tmdbToken}` } }
  );
  const data = await res.json();
  const us = data.results?.US;
  const flatrate = us?.flatrate?.[0]?.provider_name;
  return flatrate || 'Check streaming';
}

const SYSTEM_PROMPT = `You are Fred, a sharp cinephile. You will be given a real film with its actual data. Write ONE punchy recommendation for it.

RULES:
- 1–2 sentences MAX. No filler.
- Never start with "Oh", "Look", "Well", "Sure".
- Don't mention the title in the text — it's shown in the card below.
- Write WHY it's worth watching. Sharp, specific, no generic praise.

FORMAT — respond EXACTLY like this, nothing else:
[1-2 sentence reason to watch, no title mention.]
→ TITLE | PLATFORM | RUNTIME`;

export async function POST(req) {
  const { message, platforms = [], moods = [], conversationHistory = [] } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const tmdbToken = process.env.TMDB_TOKEN;

  if (!apiKey) return NextResponse.json({ error: 'API key missing' }, { status: 500 });

  const genre = extractGenre(message);
  const year = extractYear(message);

  // If we can detect genre/year, use TMDB to ground the answer
  let groundedContext = '';
  let tmdbTitle = null;
  let platform = 'Check streaming';

  if (genre && tmdbToken) {
    try {
      tmdbTitle = await searchTMDB(genre, year, platforms, tmdbToken);
      if (tmdbTitle) {
        platform = await getProviders(tmdbTitle.id, tmdbToken);
        const runtimeRes = await fetch(
          `https://api.themoviedb.org/3/movie/${tmdbTitle.id}?language=en-US`,
          { headers: { Authorization: `Bearer ${tmdbToken}` } }
        );
        const runtimeData = await runtimeRes.json();
        const mins = runtimeData.runtime || 0;
        const runtime = mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '';

        groundedContext = `
FILM TO RECOMMEND:
Title: ${tmdbTitle.title}
Year: ${tmdbTitle.release_date?.slice(0, 4)}
Genre: ${genre.name}
Rating: ${tmdbTitle.vote_average?.toFixed(1)}/10 (${tmdbTitle.vote_count} votes)
Overview: ${tmdbTitle.overview}
Platform: ${platform}
Runtime: ${runtime}

Write a sharp 1-2 sentence recommendation for this specific film. Do not mention the title.
Format: [reason]
→ ${tmdbTitle.title} | ${platform} | ${runtime}`;
      }
    } catch (e) {
      console.error('TMDB lookup failed:', e);
    }
  }

  const userMessage = groundedContext || message;

  const messages = [
    ...(!groundedContext ? conversationHistory.slice(-6) : []),
    { role: 'user', content: userMessage },
  ];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';

    const lines = text.split('\n').filter(Boolean);
    const arrowLine = lines.find(l => l.trim().startsWith('→')) || '';
    const responseText = lines.filter(l => !l.trim().startsWith('→')).join(' ').trim();
    const parts = arrowLine.replace('→', '').split('|').map(s => s.trim());

    // If TMDB gave us a result, use that data directly (don't trust Haiku's arrow line)
    if (tmdbTitle) {
      const runtimeRes = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbTitle.id}?language=en-US`,
        { headers: { Authorization: `Bearer ${tmdbToken}` } }
      );
      const rd = await runtimeRes.json();
      const mins = rd.runtime || 0;
      const runtime = mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '';

      return NextResponse.json({
        text: responseText || parts[0] || '',
        title: tmdbTitle.title,
        platform,
        runtime,
        meta: `${platform} · ${runtime}`,
        poster: tmdbTitle.poster_path,
        tmdb_id: tmdbTitle.id,
      });
    }

    return NextResponse.json({
      text: responseText,
      title: parts[0] || '',
      platform: parts[1] || '',
      runtime: parts[2] || '',
      meta: parts.slice(1).join(' · '),
    });

  } catch (err) {
    console.error('Ask Fred error:', err);
    return NextResponse.json({ error: 'Fred is unavailable right now.' }, { status: 500 });
  }
}

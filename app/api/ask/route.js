import { NextResponse } from 'next/server';

const GENRE_MAP = {
  comedy: 35, thriller: 53, horror: 27, romance: 10749,
  drama: 18, action: 28, documentary: 99, animation: 16,
  'sci-fi': 878, mystery: 9648, crime: 80,
};

function extractYear(text) {
  const match = text.match(/\b(20\d{2})\b/);
  if (match) return match[1];
  if (/this year/i.test(text)) return '2026';
  if (/last year/i.test(text)) return '2025';
  return null;
}

function extractGenre(text) {
  const t = text.toLowerCase();
  for (const [name, id] of Object.entries(GENRE_MAP)) {
    if (t.includes(name)) return { name, id };
  }
  return null;
}

// Detect "another", "different one", "something else", "next one" etc.
function isFollowUp(text) {
  return /\b(another|different|else|next|other|more|again|instead)\b/i.test(text);
}

async function searchTMDB(genre, year, platforms, tmdbToken, excludeId = null) {
  const params = new URLSearchParams({
    sort_by: 'vote_average.desc',
    'vote_count.gte': '50',
    with_genres: genre.id,
    language: 'en-US',
    include_adult: 'false',
    page: '1',
  });

  if (year) params.set('primary_release_year', year);

  const PROVIDER_IDS = {
    'Netflix': '8', 'Prime Video': '9', 'Hulu': '15',
    'Max': '1899', 'Apple TV+': '350', 'Disney+': '337', 'Peacock': '386',
  };
  const providerIds = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean).join('|');
  if (providerIds) {
    params.set('with_watch_providers', providerIds);
    params.set('watch_region', 'US');
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?${params}`,
    { headers: { Authorization: `Bearer ${tmdbToken}` } }
  );
  const data = await res.json();
  // Skip the excluded title (previously recommended)
  const results = data.results || [];
  return results.find(r => r.id !== excludeId) || results[0] || null;
}

async function getMovieDetails(movieId, tmdbToken) {
  const [detailRes, providerRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/movie/${movieId}?language=en-US`,
      { headers: { Authorization: `Bearer ${tmdbToken}` } }),
    fetch(`https://api.themoviedb.org/3/movie/${movieId}/watch/providers`,
      { headers: { Authorization: `Bearer ${tmdbToken}` } }),
  ]);
  const detail = await detailRes.json();
  const providers = await providerRes.json();
  const platform = providers.results?.US?.flatrate?.[0]?.provider_name || 'Check streaming';
  const mins = detail.runtime || 0;
  const runtime = mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '';
  return { platform, runtime, detail };
}

// System prompt for when we have grounded TMDB data
const GROUNDED_PROMPT = `You are Fred, a sharp cinephile. Write a punchy 1-2 sentence pitch for the film below.
- Do NOT mention the title — it appears in the card
- No filler words, no "I", no "you might enjoy"
- Just: what makes it worth watching, specifically
Only output the pitch. Nothing else.`;

// System prompt for open-ended / vibe-based queries
const FREEFORM_PROMPT = `You are Fred, a sharp cinephile with strong opinions.

TODAY: May 2026. Knowledge through early 2026.

RULES:
- 1-2 sentences MAX. No padding.
- Give ONE real title you are 100% certain exists.
- Never ask the user for information.
- If asked for "another" or "different" option, give a genuinely different title.
- Never start with "Oh", "Look", "Well", "Sure", "I'd be happy".
- Never say "I need you to..." or ask for data.

FORMAT:
[1-2 sentence pitch ending with the title.]
→ TITLE | PLATFORM | RUNTIME`;

export async function POST(req) {
  const { message, platforms = [], moods = [], conversationHistory = [], lastTmdbId = null } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const tmdbToken = process.env.TMDB_TOKEN;

  if (!apiKey) return NextResponse.json({ error: 'API key missing' }, { status: 500 });

  const followUp = isFollowUp(message);
  const genre = extractGenre(message);
  const year = extractYear(message);

  // For follow-ups, try to inherit genre/year from conversation history
  let resolvedGenre = genre;
  let resolvedYear = year;
  if (followUp && !genre) {
    for (const msg of [...conversationHistory].reverse()) {
      if (msg.role === 'user') {
        resolvedGenre = resolvedGenre || extractGenre(msg.content);
        resolvedYear = resolvedYear || extractYear(msg.content);
        if (resolvedGenre) break;
      }
    }
  }

  let tmdbTitle = null;
  let platform = 'Check streaming';
  let runtime = '';

  if (resolvedGenre && tmdbToken) {
    try {
      const excludeId = followUp ? lastTmdbId : null;
      tmdbTitle = await searchTMDB(resolvedGenre, resolvedYear, platforms, tmdbToken, excludeId);
      if (tmdbTitle) {
        const details = await getMovieDetails(tmdbTitle.id, tmdbToken);
        platform = details.platform;
        runtime = details.runtime;
      }
    } catch (e) {
      console.error('TMDB lookup failed:', e);
    }
  }

  // Build prompt
  const systemPrompt = tmdbTitle ? GROUNDED_PROMPT : FREEFORM_PROMPT;

  const userContent = tmdbTitle
    ? `Film: ${tmdbTitle.title} (${tmdbTitle.release_date?.slice(0, 4)})
Platform: ${platform}
Runtime: ${runtime}
Overview: ${tmdbTitle.overview}
Write the pitch.`
    : message + (platforms.length ? `\n(User has: ${platforms.join(', ')})` : '');

  const messages = tmdbTitle
    ? [{ role: 'user', content: userContent }]
    : [
        ...conversationHistory.slice(-6).map(m => ({
          role: m.role === 'fred' ? 'assistant' : 'user',
          content: m.text || m.content || '',
        })),
        { role: 'user', content: userContent },
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
        max_tokens: 120,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';

    if (tmdbTitle) {
      return NextResponse.json({
        text,
        title: tmdbTitle.title,
        platform,
        runtime,
        meta: `${platform} · ${runtime}`,
        poster: tmdbTitle.poster_path,
        tmdb_id: tmdbTitle.id,
      });
    }

    // Freeform: parse arrow line
    const lines = text.split('\n').filter(Boolean);
    const arrowLine = lines.find(l => l.trim().startsWith('→')) || '';
    const responseText = lines.filter(l => !l.trim().startsWith('→')).join(' ').trim();
    const parts = arrowLine.replace('→', '').split('|').map(s => s.trim());

    return NextResponse.json({
      text: responseText || text,
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

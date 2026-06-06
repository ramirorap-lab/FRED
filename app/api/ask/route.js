import { NextResponse } from 'next/server';

const PROVIDER_IDS = {
  'Netflix': '8', 'Prime Video': '9', 'Hulu': '15',
  'Max': '1899', 'Apple TV+': '350', 'Disney+': '337', 'Peacock': '386',
};

const GENRE_IDS = {
  comedy: 35, thriller: 53, horror: 27, romance: 10749,
  drama: 18, action: 28, documentary: 99, animation: 16,
  'sci-fi': 878, mystery: 9648, crime: 80, fantasy: 14,
  adventure: 12, family: 10751,
};

// TMDB keyword IDs for vibes
const VIBE_MAP = {
  'feel-good':     { keywords: '9882,258,180547', genres: [35, 18] },
  'rainy day':     { keywords: '9882,180547',      genres: [18, 35] },
  'date night':    { keywords: '9748,258',          genres: [10749, 35] },
  'mind-bending':  { keywords: '165,3801',          genres: [878, 53] },
  'tearjerker':    { keywords: '9748,180547',       genres: [18, 10749] },
  'adrenaline':    { keywords: '1701,9882',         genres: [28, 53] },
  'dark':          { keywords: '165,9748',          genres: [53, 18, 80] },
  'uplifting':     { keywords: '9882,258',          genres: [18, 35] },
  'cozy':          { keywords: '258,180547',        genres: [35, 10749] },
  'intense':       { keywords: '1701,165',          genres: [53, 18] },
  'funny':         { keywords: '9882',              genres: [35] },
  'romantic':      { keywords: '9748',              genres: [10749, 35] },
  'scary':         { keywords: '1701',              genres: [27] },
  'thought-provoking': { keywords: '3801,165',     genres: [18, 878] },
};

// Recent awards — TMDB IDs for known winners/nominees
const AWARDS_DB = {
  // Oscar Best Picture winners/nominees 2020-2025
  497698: { oscar: 'Winner', year: 2021 },   // Nomadland
  603692: { oscar: 'Winner', year: 2022 },   // CODA  
  361743: { oscar: 'Nominated', year: 2022 },// Top Gun Maverick
  661374: { oscar: 'Winner', year: 2023 },   // Everything Everywhere All at Once
  674324: { oscar: 'Nominated', year: 2023 },// The Banshees of Inisherin
  872585: { oscar: 'Winner', year: 2024 },   // Oppenheimer
  792307: { oscar: 'Nominated', year: 2024 },// Poor Things
  933131: { oscar: 'Nominated', year: 2024 },// Anatomy of a Fall
  1079091:{ oscar: 'Winner', year: 2025 },   // The Brutalist (placeholder)
  1010581:{ oscar: 'Nominated', year: 2025 },// Emilia Pérez
  // Cannes Palme d'Or
  557: { cannes: "Palme d'Or", year: 2019 }, // Parasite
  696374: { cannes: "Palme d'Or", year: 2022 },// Triangle of Sadness
  // BAFTA / Golden Globe notable
  634649: { bafta: 'Winner', year: 2022 },
};

// ── Step 1: Interpret conversation → search params ──
async function interpretQuery(messages, apiKey) {
  const system = `You are a film search assistant. Given a conversation, output a JSON object.

Fields:
- genre: primary genre string (comedy, thriller, horror, romance, drama, action, documentary, animation, sci-fi, mystery, crime, fantasy, adventure, family) or null
- genres: array of 1-3 genre strings that fit the request (used when vibe implies multiple genres)
- year: 4-digit year string if specified, null otherwise
- decade: e.g. "1990s" if user says "90s", null otherwise  
- vibe: one of: feel-good, rainy day, date night, mind-bending, tearjerker, adrenaline, dark, uplifting, cozy, intense, funny, romantic, scary, thought-provoking — or null
- exclude_ids: array of TMDB integer IDs from [tmdb_id:NUMBER] tags in assistant messages
- is_series: true if user wants TV/series, false for movies (default false)
- needs_recommendation: true if user wants a new recommendation, false if asking a question about the last film
- sort: "rating" (default) or "popular" — use popular for vibe/mood queries, rating for "best of year" queries
- reasoning: one sentence

Critical rules:
- "is that a X?" = needs_recommendation false
- "another" / "different" / "something else" = inherit genre/vibe from earlier, needs_recommendation true
- TMDB IDs are in [tmdb_id:NUMBER] tags — extract ALL into exclude_ids
- Vibe queries like "rainy day", "date night", "something cozy", "will destroy me" → set vibe field
- For vibe queries also set relevant genres array
- Output ONLY valid JSON.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 250, system, messages }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || '{}';
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
  catch { return {}; }
}

// ── Step 2: Search TMDB ──
async function searchTMDB(params, platforms, tmdbToken) {
  const { genre, genres, year, decade, vibe, exclude_ids = [], is_series = false, sort = 'rating' } = params;

  // Resolve genre IDs
  let genreIds = [];
  if (genres?.length) genreIds = genres.map(g => GENRE_IDS[g?.toLowerCase()]).filter(Boolean);
  else if (genre) genreIds = [GENRE_IDS[genre.toLowerCase()]].filter(Boolean);

  // Vibe overrides/supplements genre
  let vibeKeywords = null;
  if (vibe && VIBE_MAP[vibe]) {
    vibeKeywords = VIBE_MAP[vibe].keywords;
    if (!genreIds.length) genreIds = VIBE_MAP[vibe].genres;
  }

  if (!genreIds.length && !vibeKeywords) return null;

  const providerIds = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean).join('|');
  const endpoint = is_series
    ? 'https://api.themoviedb.org/3/discover/tv'
    : 'https://api.themoviedb.org/3/discover/movie';

  const sortBy = sort === 'popular' ? 'popularity.desc' : 'vote_average.desc';

  // Lower thresholds for recent years — 2025/2026 films haven't accumulated votes yet
  const isRecentYear = year && parseInt(year) >= 2025;
  const minVotes = isRecentYear ? '50' : (sort === 'popular' ? '200' : '500');
  const minRating = isRecentYear ? '6.0' : '7.0';

  const searchParams = new URLSearchParams({
    sort_by: isRecentYear ? 'popularity.desc' : sortBy,
    'vote_count.gte': minVotes,
    'vote_average.gte': minRating,
    language: 'en-US',
    include_adult: 'false',
    page: '1',
  });

  if (genreIds.length) searchParams.set('with_genres', genreIds.join(','));
  if (vibeKeywords)    searchParams.set('with_keywords', vibeKeywords);

  if (year) {
    is_series ? searchParams.set('first_air_date_year', year) : searchParams.set('primary_release_year', year);
  } else if (decade) {
    const start = decade.replace('s','');
    const end   = String(parseInt(start) + 9);
    is_series
      ? (searchParams.set('first_air_date.gte', `${start}-01-01`), searchParams.set('first_air_date.lte', `${end}-12-31`))
      : (searchParams.set('release_date.gte', `${start}-01-01`), searchParams.set('release_date.lte', `${end}-12-31`));
  }

  if (providerIds) {
    searchParams.set('with_watch_providers', providerIds);
    searchParams.set('watch_region', 'US');
  }

  const res = await fetch(`${endpoint}?${searchParams}`, {
    headers: { Authorization: `Bearer ${tmdbToken}` },
  });
  const data = await res.json();
  const results = data.results || [];
  return results.find(r => !exclude_ids.includes(r.id)) || results[0] || null;
}

// ── Step 3: Get details + awards ──
async function getDetails(id, isSeries, tmdbToken) {
  const base = isSeries ? `https://api.themoviedb.org/3/tv/${id}` : `https://api.themoviedb.org/3/movie/${id}`;

  const [detailRes, providerRes] = await Promise.all([
    fetch(`${base}?language=en-US`, { headers: { Authorization: `Bearer ${tmdbToken}` } }),
    fetch(`${base}/watch/providers`, { headers: { Authorization: `Bearer ${tmdbToken}` } }),
  ]);

  const detail    = await detailRes.json();
  const providers = await providerRes.json();

  // Use first flatrate provider only — cleaner display
  const platform  = providers.results?.US?.flatrate?.[0]?.provider_name || 'Check streaming';

  let runtime = '';
  if (isSeries) {
    const s = detail.number_of_seasons;
    runtime = s ? `${s} season${s > 1 ? 's' : ''}` : '';
  } else {
    const mins = detail.runtime || 0;
    runtime = mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '';
  }

  // backdrop_path from detail is reliable — no extra /images call needed
  const backdrop = detail.backdrop_path || null;
  const poster   = detail.poster_path   || null;

  // Awards
  const awards = AWARDS_DB[id] || null;
  let awardBadge = null;
  if (awards?.oscar === 'Winner')         awardBadge = '🏆 Oscar Winner';
  else if (awards?.oscar === 'Nominated') awardBadge = '🎬 Oscar Nominated';
  else if (awards?.cannes)                awardBadge = `🌿 Cannes ${awards.cannes}`;
  else if (awards?.bafta === 'Winner')    awardBadge = '🎭 BAFTA Winner';

  return { platform, runtime, awardBadge, backdrop, poster };
}

// ── Step 4: Write pitch ──
async function writePitch(film, platform, runtime, searchParams, awardBadge, apiKey) {
  const year        = (film.release_date || film.first_air_date || '').slice(0, 4);
  const rating      = film.vote_average ? film.vote_average.toFixed(1) : null;
  const votes       = film.vote_count || 0;
  const votesFormatted = votes >= 1000 ? `${(votes / 1000).toFixed(1)}k` : votes;
  const credibility = rating ? `${rating}/10 on TMDB (${votesFormatted} ratings)${awardBadge ? ` · ${awardBadge}` : ''}` : null;

  const queryDesc = searchParams.vibe
    ? `vibe: "${searchParams.vibe}"`
    : `${searchParams.genre || (searchParams.genres || []).join('/')}${searchParams.year ? ` from ${searchParams.year}` : searchParams.decade ? ` from the ${searchParams.decade}` : ''}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: `You are Fred, a sharp cinephile. Write EXACTLY 2 sentences. Stop after the second period.

Sentence 1: Why this film fits the request. Mention genre/year/rating naturally. Max 20 words.
Sentence 2: The one thing that makes it unmissable. Max 20 words.

HARD RULES:
- ONE film only. Never suggest alternatives.
- Do NOT mention the title.
- No "I", no "you might enjoy", no "this film".
- 2 sentences. Full stop. Nothing after.`,
      messages: [{
        role: 'user',
        content: `User asked for: ${queryDesc}
Film: ${film.title || film.name} (${year})
Rating: ${credibility || 'not available'}
${awardBadge ? `Awards: ${awardBadge}` : ''}
Overview: ${film.overview}
Write the 2-sentence pitch.`,
      }],
    }),
  });

  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

// ── Main handler ──
export async function POST(req) {
  const { message, platforms = [], moods = [], tasteProfile, conversationHistory = [] } = await req.json();

  const apiKey    = process.env.ANTHROPIC_API_KEY;
  const tmdbToken = process.env.TMDB_TOKEN;

  if (!apiKey) return NextResponse.json({ error: 'API key missing' }, { status: 500 });

  const historyMessages = conversationHistory
    .filter(m => !m.thinking && (m.text || m.content))
    .slice(-10)
    .map(m => ({
      role: m.role === 'fred' ? 'assistant' : 'user',
      content: m.tmdb_id
        ? `${m.text || m.content || ''} [tmdb_id:${m.tmdb_id}]`
        : (m.text || m.content || ''),
    }));

  const allMessages = [...historyMessages, { role: 'user', content: message }];

  try {
    // Step 1: Interpret
    const params = await interpretQuery(allMessages, apiKey);

    // Clarification question — answer directly
    if (params.needs_recommendation === false) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 80,
          system: `You are Fred, a sharp cinephile. Answer the user's question about the last recommended film in 1-2 sentences. Be direct. If it's not that genre, say so and offer to find one that is.`,
          messages: allMessages,
        }),
      });
      const data = await res.json();
      return NextResponse.json({ text: data.content?.[0]?.text?.trim() || '', title: '', platform: '', runtime: '', meta: '' });
    }

    // Step 2: Search TMDB
    let film = null, platform = 'Check streaming', runtime = '', awardBadge = null;
    const hasSearchParams = params.genre || params.genres?.length || params.vibe;

    if (hasSearchParams && tmdbToken) {
      film = await searchTMDB(params, platforms, tmdbToken);
      if (film) {
        const details = await getDetails(film.id, params.is_series, tmdbToken);
        platform   = details.platform;
        runtime    = details.runtime;
        awardBadge = details.awardBadge;
      }
    }

    // Step 3: Pitch
    if (film) {
      const pitch  = await writePitch(film, platform, runtime, params, awardBadge, apiKey);
      const rating = film.vote_average ? film.vote_average.toFixed(1) : null;
      return NextResponse.json({
        text: pitch,
        title: film.title || film.name,
        platform, runtime, rating,
        awardBadge: awardBadge || null,
        meta: `${platform} · ${runtime}`,
        poster:   details.poster   || film.poster_path   || null,
        backdrop: details.backdrop || film.backdrop_path || null,
        tmdb_id: film.id,
      });
    }

    // Fallback: freeform Haiku
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 120,
        system: `You are Fred, a sharp cinephile. Answer in 1-2 sentences. Be honest and direct.
- If asked about very recent films (2025/2026) and you're unsure, say so briefly and suggest asking for a specific genre so you can search properly.
- Never invent film titles or claim to know things you don't.
- Never ask the user to describe a film to you — that's their job.
- No filler, no long explanations.

FORMAT (if recommending):
[Pitch ending with title.]
→ TITLE | PLATFORM | RUNTIME`,
        messages: allMessages,
      }),
    });
    const data      = await res.json();
    const text      = data.content?.[0]?.text?.trim() || '';
    const lines     = text.split('\n').filter(Boolean);
    const arrowLine = lines.find(l => l.trim().startsWith('→')) || '';
    const respText  = lines.filter(l => !l.trim().startsWith('→')).join(' ').trim();
    const parts     = arrowLine.replace('→', '').split('|').map(s => s.trim());

    return NextResponse.json({
      text: respText || text,
      title: parts[0] || '', platform: parts[1] || '', runtime: parts[2] || '',
      meta: parts.slice(1).join(' · '),
    });

  } catch (err) {
    console.error('Ask Fred error:', err);
    return NextResponse.json({ error: 'Fred is unavailable right now.' }, { status: 500 });
  }
}

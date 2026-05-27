import { NextResponse } from 'next/server';

const TMDB   = 'https://api.themoviedb.org/3';
const ANTHRO = 'https://api.anthropic.com/v1/messages';

const MOOD_GENRES = {
  smart:     { movie: [18, 99],        tv: [18, 99] },
  dark:      { movie: [53, 80, 27],    tv: [53, 80] },
  funny:     { movie: [35],            tv: [35] },
  romantic:  { movie: [10749, 18],     tv: [18] },
  intense:   { movie: [28, 53],        tv: [10759, 53] },
  horror:    { movie: [27, 53],        tv: [9648, 27] },
  adventure: { movie: [12, 28],        tv: [10759, 12] },
  family:    { movie: [10751, 16, 35], tv: [10751, 16] },
};

const PROVIDER_IDS = {
  'Netflix': 8, 'Prime Video': 9, 'Hulu': 15,
  'Max': 384, 'Apple TV+': 350, 'Disney+': 337, 'Peacock': 386,
};

// Mood → keywords to match director pick films
const MOOD_KEYWORDS = {
  smart:     ['drama', 'political', 'mystery', 'thriller', 'biography'],
  dark:      ['crime', 'thriller', 'horror', 'noir', 'dark', 'war'],
  funny:     ['comedy', 'satire', 'farce'],
  romantic:  ['romance', 'love', 'relationship'],
  intense:   ['war', 'action', 'thriller', 'western'],
  horror:    ['horror', 'supernatural', 'psychological'],
  adventure: ['adventure', 'western', 'epic', 'war'],
  family:    ['family', 'coming-of-age', 'childhood'],
};

async function tmdbFetch(url, token) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// Search TMDB for a specific film title + year
async function searchFilm(title, year, token) {
  const q = encodeURIComponent(title);
  const data = await tmdbFetch(`${TMDB}/search/movie?query=${q}&year=${year}&language=en-US`, token);
const film = data?.results?.[0];
if (!film) return null;
// Fetch full details to get best poster
const details = await tmdbFetch(`${TMDB}/movie/${film.id}?language=en-US`, token);
return details || film;
}

// Check if a TMDB movie is available on given platforms
async function getAvailablePlatform(tmdbId, platformIds, token) {
  const data = await tmdbFetch(`${TMDB}/movie/${tmdbId}/watch/providers`, token);
  const us = data?.results?.US;
  if (!us) return null;
  const available = [...(us.flatrate||[]), ...(us.free||[]), ...(us.ads||[])];
  const match = available.find(p => platformIds.includes(p.provider_id));
  if (!match) return null;
  // Return platform name
  const nameMap = { 8:'Netflix', 9:'Prime Video', 15:'Hulu', 384:'Max', 350:'Apple TV+', 337:'Disney+', 386:'Peacock' };
  return nameMap[match.provider_id] || match.provider_name;
}

// Get regular picks from TMDB discover
async function getRegularCandidates(platforms, moods, token) {
  const providerIds = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean).join('|');
  const movieGenres = [...new Set(moods.flatMap(m => MOOD_GENRES[m]?.movie || [18]))].join(',');
  const tvGenres    = [...new Set(moods.flatMap(m => MOOD_GENRES[m]?.tv    || [18]))].join(',');

  const base = {
    watch_region: 'US', language: 'en-US',
    'vote_count.gte': '300', 'vote_average.gte': '6.8',
    sort_by: 'vote_average.desc', page: '1',
  };

  const mP = new URLSearchParams({ ...base, with_genres: movieGenres, ...(providerIds && { with_watch_providers: providerIds }) });
  const tP = new URLSearchParams({ ...base, with_genres: tvGenres, 'vote_count.gte': '150', ...(providerIds && { with_watch_providers: providerIds }) });

  const [movies, tv] = await Promise.all([
    tmdbFetch(`${TMDB}/discover/movie?${mP}`, token),
    tmdbFetch(`${TMDB}/discover/tv?${tP}`, token),
  ]);

  const fmt = (item, type) => ({
    tmdb_id: item.id,
    type,
    title:   type === 'movie' ? item.title : item.name,
    year:    (type === 'movie' ? item.release_date : item.first_air_date)?.slice(0,4) || '',
    rating:  item.vote_average?.toFixed(1),
    votes:   item.vote_count,
    overview: item.overview?.slice(0, 120),
    poster:  item.poster_path,
  });

  return {
    movies: (movies?.results||[]).filter(m=>m.poster_path).slice(0,15).map(m=>fmt(m,'movie')),
    series: (tv?.results||[]).filter(s=>s.poster_path).slice(0,8).map(s=>fmt(s,'series')),
  };
}

// Get director picks available on user's platforms
async function getDirectorCandidates(platforms, moods, supabaseUrl, supabaseKey, tmdbToken) {
  if (!supabaseUrl || !supabaseKey) return [];

  try {
    // Fetch all director picks from Supabase
    const res = await fetch(`${supabaseUrl}/rest/v1/director_picks?select=*&limit=190`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });
    const allPicks = await res.json();
    if (!allPicks?.length) return [];

    // Shuffle to get variety
    const shuffled = allPicks.sort(() => Math.random() - 0.5).slice(0, 40);

    const platformIds = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean);

    // Check availability in parallel (max 8 at a time)
    const results = [];
    for (let i = 0; i < shuffled.length; i += 8) {
      const batch = shuffled.slice(i, i + 8);
      const checked = await Promise.all(batch.map(async (pick) => {
        const film = await searchFilm(pick.film_title, pick.film_year, tmdbToken);
        if (!film) return null;
        const platform = await getAvailablePlatform(film.id, platformIds, tmdbToken);
        if (!platform) return null;
        return {
          tmdb_id:        film.id,
          type:           'movie',
          title:          pick.film_title,
          year:           String(pick.film_year),
          rating:         film.vote_average?.toFixed(1),
          votes:          film.vote_count,
          poster:         film.poster_path,
          overview:       film.overview?.slice(0, 120),
          platform,
          director_name:  pick.director,
          director_quote: pick.quote,
          pick_type:      'wildcard',
        };
      }));
      results.push(...checked.filter(Boolean));
      if (results.length >= 3) break; // enough candidates found
    }

    return results;
  } catch (err) {
    console.error('Director picks error:', err);
    return [];
  }
}

async function curateWithClaude(regular, directorCandidates, platforms, moods, tasteProfile, anthropicKey) {
  const profileCtx = tasteProfile
    ? `\n\nUser Letterboxd taste profile:\n${JSON.stringify(tasteProfile, null, 2)}`
    : '';

  const dirCtx = directorCandidates.length
    ? `\n\nDirector Picks available on user's platforms (use one of these as the third pick — pick_type "wildcard"):\n${directorCandidates.map(d => `- "${d.title}" (${d.year}) on ${d.platform} — ${d.director_name}'s pick: "${d.director_quote}"`).join('\n')}`
    : '';

  const prompt = `You are Fred, a sharp cinephile film curator.

Platforms: ${platforms.join(', ')}
Mood: ${moods.join(', ')}${profileCtx}${dirCtx}

Regular movie candidates:
${JSON.stringify(regular.movies, null, 2)}

Series candidates:
${JSON.stringify(regular.series, null, 2)}

Pick exactly 3 total:
- 1 movie with pick_type "safe" — the reliable great choice
- 1 movie with pick_type "stretch" — more adventurous, different feel from safe
- 1 series with pick_type "safe"

${directorCandidates.length ? 'IMPORTANT: Replace the stretch movie with a Director Pick from the list above. Use director_name and director_quote from that list.' : ''}

Rules:
- Match mood. Variety between picks.
- fred_note: direct, warm, witty. Max 18 words. Never generic.
- letterboxd: true if rating >= 7.4 and votes >= 1500
- For Director Pick: set pick_type to "wildcard", include director_name and director_quote

Respond ONLY with valid JSON array, no markdown:
[{
  "tmdb_id": 123,
  "title": "string",
  "year": "2023",
  "type": "movie",
  "runtime": "2h 15m",
  "rating": 8.1,
  "poster": "/path.jpg",
  "pick_type": "safe",
  "letterboxd": true,
  "fred_note": "One punchy sentence.",
  "director_name": null,
  "director_quote": null,
  "platform": "Netflix"
}]`;

  const r = await fetch(ANTHRO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1400, messages: [{ role: 'user', content: prompt }] }),
  });
  const d = await r.json();
  const text = d.content?.[0]?.text || '[]';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const platforms    = (searchParams.get('platforms') || '').split(',').filter(Boolean);
  const moods        = (searchParams.get('moods')     || 'smart').split(',').filter(Boolean);
  const tasteProfile = searchParams.get('taste') ? JSON.parse(decodeURIComponent(searchParams.get('taste'))) : null;

  const tmdbToken    = process.env.TMDB_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_ANON_KEY;

  if (!tmdbToken || !anthropicKey || !platforms.length) {
    return NextResponse.json({ error: 'Missing config or platforms' }, { status: 400 });
  }

  try {
    // Run in parallel: regular TMDB picks + director candidates
    const [regular, directorCandidates] = await Promise.all([
      getRegularCandidates(platforms, moods, tmdbToken),
      getDirectorCandidates(platforms, moods, supabaseUrl, supabaseKey, tmdbToken),
    ]);

    const picks = await curateWithClaude(regular, directorCandidates, platforms, moods, tasteProfile, anthropicKey);

    const result = picks.slice(0, 3).map(pick => {
      // For director picks, use the data we already have
      const dirMatch = directorCandidates.find(d => d.title.toLowerCase() === pick.title.toLowerCase());
      return {
        id:             `${pick.type}-${pick.tmdb_id}`,
        tmdb_id:        pick.tmdb_id,
        title:          pick.title,
        year:           pick.year,
        type:           pick.type,
        platform:       pick.platform || dirMatch?.platform || platforms[0],
        runtime:        pick.runtime,
        rating:         pick.rating,
        letterboxd:     pick.letterboxd,
        pick_type:      pick.pick_type,
        poster:         pick.poster || dirMatch?.poster || null,
        fred_note:      pick.fred_note,
        director_name:  pick.director_name  || dirMatch?.director_name  || null,
        director_quote: pick.director_quote || dirMatch?.director_quote || null,
      };
    });

    return NextResponse.json({ picks: result });

  } catch (err) {
    console.error('Picks error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

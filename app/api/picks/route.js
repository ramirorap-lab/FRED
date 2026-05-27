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

async function fetchTMDB(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getDirectorPicks(supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return [];
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/director_picks?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    return await res.json();
  } catch { return []; }
}

function matchDirectorPick(title, directorPicks) {
  if (!directorPicks?.length) return null;
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = directorPicks.find(dp => clean(dp.film_title) === clean(title));
  return match || null;
}

async function getCandidates(platforms, moods, tmdbToken) {
  const providerIds  = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean).join('|');
  const movieGenres  = [...new Set(moods.flatMap(m => MOOD_GENRES[m]?.movie || [18]))].join(',');
  const tvGenres     = [...new Set(moods.flatMap(m => MOOD_GENRES[m]?.tv    || [18]))].join(',');

  const base = { watch_region: 'US', language: 'en-US', 'vote_count.gte': '200', 'vote_average.gte': '6.5', sort_by: 'vote_average.desc', page: '1' };

  const mP = new URLSearchParams({ ...base, with_genres: movieGenres, ...(providerIds && { with_watch_providers: providerIds }) });
  const tP = new URLSearchParams({ ...base, with_genres: tvGenres, 'vote_count.gte': '100', ...(providerIds && { with_watch_providers: providerIds }) });
  const trP = new URLSearchParams({ watch_region: 'US', language: 'en-US', ...(providerIds && { with_watch_providers: providerIds }) });

  const [movies, tvShows, trending] = await Promise.all([
    fetchTMDB(`${TMDB}/discover/movie?${mP}`, tmdbToken),
    fetchTMDB(`${TMDB}/discover/tv?${tP}`, tmdbToken),
    fetchTMDB(`${TMDB}/trending/movie/week?${trP}`, tmdbToken),
  ]);

  const fmov = (m) => ({ id: m.id, type: 'movie', title: m.title, year: m.release_date?.slice(0,4)||'', rating: m.vote_average?.toFixed(1), votes: m.vote_count, overview: m.overview?.slice(0,150), poster: m.poster_path });
  const ftv  = (s) => ({ id: s.id, type: 'series', title: s.name,  year: s.first_air_date?.slice(0,4)||'', rating: s.vote_average?.toFixed(1), votes: s.vote_count, overview: s.overview?.slice(0,150), poster: s.poster_path });

  return {
    movies:   (movies?.results   ||[]).filter(m=>m.poster_path).slice(0,20).map(fmov),
    series:   (tvShows?.results  ||[]).filter(s=>s.poster_path).slice(0,10).map(ftv),
    trending: (trending?.results ||[]).filter(m=>m.poster_path).slice(0,8).map(m=>({...fmov(m), trending:true})),
  };
}

async function curateWithClaude(candidates, platforms, moods, tasteProfile, directorPicks, anthropicKey) {
  const profileCtx = tasteProfile ? `\n\nUser Letterboxd taste profile:\n${JSON.stringify(tasteProfile, null, 2)}` : '';

  // Find which candidates have director picks
  const allCandidates = [...candidates.movies, ...candidates.trending, ...candidates.series];
  const withDirector = allCandidates
    .map(c => ({ ...c, directorPick: matchDirectorPick(c.title, directorPicks) }))
    .filter(c => c.directorPick)
    .slice(0, 5);

  const directorCtx = withDirector.length
    ? `\n\nDirector Picks available (these are films chosen as favorites by great directors — STRONGLY prefer using one of these as the third pick with pick_type "wildcard"):\n${withDirector.map(c => `- "${c.title}" (${c.year}) — chosen by ${c.directorPick.director}: "${c.directorPick.quote}"`).join('\n')}`
    : '';

  const prompt = `You are Fred, a sharp cinephile film curator. Pick exactly 2 movies and 1 series.

Platforms: ${platforms.join(', ')}
Mood: ${moods.join(', ')}${profileCtx}${directorCtx}

Movie candidates:
${JSON.stringify(candidates.movies.slice(0,12), null, 2)}

Trending movies:
${JSON.stringify(candidates.trending, null, 2)}

Series candidates:
${JSON.stringify(candidates.series.slice(0,8), null, 2)}

Rules:
- pick_type: "safe" = the reliable great choice, "stretch" = adventurous, "wildcard" = director pick (use if available)
- If a Director Pick is available and fits the mood, use it as the wildcard — include director_name and director_quote from the list above
- Match mood precisely. Variety between the 2 movies.
- fred_note: direct, warm, slightly witty, max 18 words.
- letterboxd: true if rating >= 7.4 and votes >= 1500

Respond ONLY with valid JSON array:
[
  {
    "tmdb_id": 123,
    "title": "string",
    "year": "2023",
    "type": "movie or series",
    "runtime": "2h 15m or Series",
    "rating": 8.1,
    "poster": "/path.jpg",
    "pick_type": "safe",
    "letterboxd": true,
    "fred_note": "One punchy sentence.",
    "director_name": null,
    "director_quote": null
  }
]
For wildcard with director pick, set director_name and director_quote from the Director Picks list.`;

  const res = await fetch(ANTHRO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1400, messages: [{ role: 'user', content: prompt }] }),
  });

  const data  = await res.json();
  const text  = data.content?.[0]?.text || '[]';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
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

  if (!tmdbToken)    return NextResponse.json({ error: 'TMDB_TOKEN not configured' }, { status: 500 });
  if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  if (!platforms.length) return NextResponse.json({ error: 'No platforms selected' }, { status: 400 });

  try {
    const [candidates, directorPicks] = await Promise.all([
      getCandidates(platforms, moods, tmdbToken),
      getDirectorPicks(supabaseUrl, supabaseKey),
    ]);

    const picks = await curateWithClaude(candidates, platforms, moods, tasteProfile, directorPicks, anthropicKey);

    const result = picks.slice(0, 3).map(pick => ({
      id:             `${pick.type}-${pick.tmdb_id}`,
      tmdb_id:        pick.tmdb_id,
      title:          pick.title,
      year:           pick.year,
      type:           pick.type,
      platform:       platforms[0],
      runtime:        pick.runtime,
      rating:         pick.rating,
      letterboxd:     pick.letterboxd,
      pick_type:      pick.pick_type,
      poster:         pick.poster,
      fred_note:      pick.fred_note,
      director_name:  pick.director_name  || null,
      director_quote: pick.director_quote || null,
    }));

    return NextResponse.json({ picks: result });

  } catch (err) {
    console.error('Picks error:', err);
    return NextResponse.json({ error: err.message || 'Failed to get picks' }, { status: 500 });
  }
}

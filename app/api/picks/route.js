import { NextResponse } from 'next/server';

const TMDB   = 'https://api.themoviedb.org/3';
const ANTHRO = 'https://api.anthropic.com/v1/messages';

// Mood → TMDB genre IDs
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

// Platform → TMDB provider ID
const PROVIDER_IDS = {
  'Netflix':     8,
  'Prime Video': 9,
  'Hulu':        15,
  'Max':         384,
  'Apple TV+':   350,
  'Disney+':     337,
  'Peacock':     386,
};

async function fetchTMDB(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getCandidates(platforms, moods, tmdbToken) {
  const providerIds = platforms
    .map(p => PROVIDER_IDS[p])
    .filter(Boolean)
    .join('|');

  // Merge genres from selected moods
  const movieGenres = [...new Set(moods.flatMap(m => MOOD_GENRES[m]?.movie || [18]))].join(',');
  const tvGenres    = [...new Set(moods.flatMap(m => MOOD_GENRES[m]?.tv    || [18]))].join(',');

  const baseParams = {
    watch_region:   'US',
    language:       'en-US',
    'vote_count.gte': '200',
    'vote_average.gte': '6.5',
    sort_by:        'vote_average.desc',
    page:           '1',
  };

  const movieParams = new URLSearchParams({
    ...baseParams,
    with_genres: movieGenres,
    ...(providerIds && { with_watch_providers: providerIds }),
  });

  const tvParams = new URLSearchParams({
    ...baseParams,
    with_genres: tvGenres,
    'vote_count.gte': '100',
    ...(providerIds && { with_watch_providers: providerIds }),
  });

  // Also get trending for freshness signal
  const trendingParams = new URLSearchParams({
    watch_region: 'US',
    language: 'en-US',
    ...(providerIds && { with_watch_providers: providerIds }),
  });

  const [movies, tvShows, trendingMovies] = await Promise.all([
    fetchTMDB(`${TMDB}/discover/movie?${movieParams}`, tmdbToken),
    fetchTMDB(`${TMDB}/discover/tv?${tvParams}`, tmdbToken),
    fetchTMDB(`${TMDB}/trending/movie/week?${trendingParams}`, tmdbToken),
  ]);

  // Format candidates for Claude
  const formatMovie = (m) => ({
    id:       m.id,
    type:     'movie',
    title:    m.title,
    year:     m.release_date?.slice(0,4) || '',
    rating:   m.vote_average?.toFixed(1),
    votes:    m.vote_count,
    overview: m.overview?.slice(0, 150),
    poster:   m.poster_path,
    genres:   m.genre_ids?.join(','),
    trending: false,
  });

  const formatTV = (s) => ({
    id:       s.id,
    type:     'series',
    title:    s.name,
    year:     s.first_air_date?.slice(0,4) || '',
    rating:   s.vote_average?.toFixed(1),
    votes:    s.vote_count,
    overview: s.overview?.slice(0, 150),
    poster:   s.poster_path,
    genres:   s.genre_ids?.join(','),
    trending: false,
  });

  const movieList    = (movies?.results    || []).filter(m => m.poster_path).slice(0, 15).map(formatMovie);
  const tvList       = (tvShows?.results   || []).filter(s => s.poster_path).slice(0, 10).map(formatTV);
  const trendingList = (trendingMovies?.results || []).filter(m => m.poster_path).slice(0, 5).map(m => ({ ...formatMovie(m), trending: true }));

  return { movies: movieList, series: tvList, trending: trendingList };
}

async function curateWithClaude(candidates, platforms, moods, tasteProfile, anthropicKey) {
  const platformList = platforms.join(', ');
  const moodList     = moods.join(', ');

  const profileContext = tasteProfile
    ? `\n\nUser taste profile from Letterboxd:\n${JSON.stringify(tasteProfile, null, 2)}`
    : '';

  const prompt = `You are Fred, a sharp cinephile film curator. Your job is to pick the best 2 movies and 1 series from the candidates below.

User's platforms: ${platformList}
Tonight's mood: ${moodList}${profileContext}

Movie candidates:
${JSON.stringify(candidates.movies, null, 2)}

Trending movies (extra weight if they fit the mood):
${JSON.stringify(candidates.trending, null, 2)}

Series candidates:
${JSON.stringify(candidates.series, null, 2)}

Pick exactly:
- 2 movies (pick_type: "safe" for the obvious great choice, "stretch" for the more adventurous pick)
- 1 series (pick_type: "safe")

Rules:
- Match the mood precisely. Don't pick a comedy for a "dark" mood.
- Prefer higher ratings but don't ignore great films with fewer votes.
- Variety: the 2 movies should feel different from each other.
- The fred_note is Fred's voice — direct, warm, slightly witty, max 18 words. Never generic.
- If taste profile exists, use it to personalize picks.

Respond ONLY with a valid JSON array. No markdown, no explanation:
[
  {
    "tmdb_id": 123,
    "title": "string",
    "year": "2023",
    "type": "movie",
    "runtime": "2h 15m",
    "rating": 8.1,
    "poster": "/path.jpg",
    "pick_type": "safe",
    "letterboxd": true,
    "fred_note": "One punchy sentence why this tonight."
  }
]

Set letterboxd: true if rating >= 7.4 and votes >= 1500.
For runtime: estimate based on typical film lengths — dramas ~2h, thrillers ~1h 50m, comedies ~1h 45m, series use "Series".`;

  const res = await fetch(ANTHRO, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-api-key':     anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';
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

  if (!tmdbToken)    return NextResponse.json({ error: 'TMDB_TOKEN not configured' }, { status: 500 });
  if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  if (!platforms.length) return NextResponse.json({ error: 'No platforms selected' }, { status: 400 });

  try {
    // Step 1: Get candidates from TMDB
    const candidates = await getCandidates(platforms, moods, tmdbToken);

    // Step 2: Claude curates the best 3
    const picks = await curateWithClaude(candidates, platforms, moods, tasteProfile, anthropicKey);

    // Step 3: Add platform info
    const result = picks.slice(0, 3).map(pick => ({
      id:         `${pick.type}-${pick.tmdb_id}`,
      tmdb_id:    pick.tmdb_id,
      title:      pick.title,
      year:       pick.year,
      type:       pick.type,
      platform:   platforms[0], // best guess — could be enriched
      runtime:    pick.runtime,
      rating:     pick.rating,
      letterboxd: pick.letterboxd,
      pick_type:  pick.pick_type,
      poster:     pick.poster,
      fred_note:  pick.fred_note,
    }));

    return NextResponse.json({ picks: result });

  } catch (err) {
    console.error('Picks error:', err);
    return NextResponse.json({ error: err.message || 'Failed to get picks' }, { status: 500 });
  }
}

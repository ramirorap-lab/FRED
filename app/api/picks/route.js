import { NextResponse } from 'next/server';

const TMDB   = 'https://api.themoviedb.org/3';
const ANTHRO = 'https://api.anthropic.com/v1/messages';

const MOOD_GENRES = {
  smart:     { movie: [18, 99, 9648],  tv: [18, 99] },
  dark:      { movie: [53, 80, 27],    tv: [53, 80] },
  funny:     { movie: [35],            tv: [35] },
  romantic:  { movie: [10749, 18],     tv: [18] },
  intense:   { movie: [28, 53],        tv: [10759, 53] },
  horror:    { movie: [27, 53],        tv: [9648, 27] },
  adventure: { movie: [12, 14, 37],    tv: [10759, 12] },
  family:    { movie: [10751, 16, 35], tv: [10751, 16] },
};

const PROVIDER_IDS = {
  'Netflix': 8, 'Prime Video': 9, 'Hulu': 15,
  'Max': 1899, 'Apple TV+': 350, 'Disney+': 337, 'Peacock': 386,
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
  return data?.results?.[0] || null;
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

  // Rotate sort strategy and page for variety
  const sortStrategies = ['vote_average.desc', 'popularity.desc', 'vote_count.desc'];
  const sort = sortStrategies[Math.floor(Math.random() * sortStrategies.length)];
  const page = String(Math.floor(Math.random() * 4) + 1);

  // For funny/family/romantic use modern films (post-1990)
  const modernMoods = ['funny', 'family', 'romantic', 'adventure'];
  const needsModern = moods.some(m => modernMoods.includes(m));
  const yearFilter  = needsModern ? { 'primary_release_date.gte': '1990-01-01' } : {};
  const tvYearFilter = needsModern ? { 'first_air_date.gte': '1990-01-01' } : {};

  const base = {
    watch_region: 'US', language: 'en-US',
    'vote_count.gte': sort === 'vote_average.desc' ? '500' : '200',
    'vote_average.gte': '6.5',
    sort_by: sort,
    page,
  };

  const mP = new URLSearchParams({
    ...base, ...yearFilter,
    with_genres: movieGenres,
    ...(providerIds && { with_watch_providers: providerIds }),
  });
  // For series: broad pool without genre filter — Claude picks by mood
  // TMDB genre tagging for series is unreliable, better to let Claude decide
  const tP = new URLSearchParams({
    watch_region: 'US', language: 'en-US',
    'vote_count.gte': '200',
    'vote_average.gte': '7.0',
    sort_by: sort,
    page,
    ...(providerIds && { with_watch_providers: providerIds }),
  });

  // Also fetch a trending page for freshness
  const trendingP = new URLSearchParams({
    watch_region: 'US', language: 'en-US',
    ...(providerIds && { with_watch_providers: providerIds }),
  });

  const [movies, tv, trending] = await Promise.all([
    tmdbFetch(`${TMDB}/discover/movie?${mP}`, token),
    tmdbFetch(`${TMDB}/discover/tv?${tP}`, token),
    tmdbFetch(`${TMDB}/trending/movie/week?${trendingP}`, token),
  ]);

  const fmt = (item, type) => ({
    tmdb_id:  item.id,
    type,
    title:    type === 'movie' ? item.title : item.name,
    year:     (type === 'movie' ? item.release_date : item.first_air_date)?.slice(0,4) || '',
    rating:   item.vote_average?.toFixed(1),
    votes:    item.vote_count,
    overview: item.overview?.slice(0, 120),
    poster:   item.poster_path,
    trending: false,
  });

  const movieList   = (movies?.results||[]).filter(m=>m.poster_path).slice(0,15).map(m=>fmt(m,'movie'));
  let   tvList      = (tv?.results||[]).filter(s=>s.poster_path).slice(0,12).map(s=>fmt(s,'series'));
  const trendList   = (trending?.results||[]).filter(m=>m.poster_path).slice(0,5).map(m=>({...fmt(m,'movie'), trending:true}));



  // Deduplicate movies + trending
  const seenIds = new Set(movieList.map(m => m.tmdb_id));
  const freshTrending = trendList.filter(t => !seenIds.has(t.tmdb_id));

  return {
    movies: [...movieList, ...freshTrending].slice(0, 18),
    series: tvList,
  };
}

// Get director picks available on user's platforms
// Fetch RT + Metacritic scores from OMDB
async function getOMDBRatings(title, year) {
  const omdbKey = process.env.OMDB_API_KEY;
  if (!omdbKey) return null;
  try {
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&y=${year || ''}&apikey=${omdbKey}`;
    const res  = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === 'False') return null;
    const rt  = data.Ratings?.find(r => r.Source === 'Rotten Tomatoes');
    const mc  = data.Ratings?.find(r => r.Source === 'Metacritic');
    return {
      rt:  rt  ? parseInt(rt.Value)  : null,  // 0-100
      mc:  mc  ? parseInt(mc.Value)  : null,  // 0-100
      imdb: data.imdbRating ? parseFloat(data.imdbRating) : null,
    };
  } catch { return null; }
}

// Composite score: IMDB + RT + Metacritic + recency
function compositeScore(item, omdb) {
  const imdb       = omdb?.imdb || item.vote_average || 0;
  const rt         = omdb?.rt   != null ? omdb.rt / 10 : imdb; // normalize to 0-10
  const mc         = omdb?.mc   != null ? omdb.mc / 10 : imdb;
  const base       = (imdb * 0.4) + (rt * 0.4) + (mc * 0.2);
  const year       = parseInt(item.year || item.release_date?.slice(0,4)) || 2000;
  const recency    = year >= 2022 ? 0.5 : year >= 2018 ? 0.3 : 0;
  const popularity = Math.min((item.votes || item.vote_count || 0) / 10000, 0.5);
  return base + recency + popularity;
}

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

async function curateWithClaude(regular, directorCandidates, platforms, moods, tasteProfile, excludeIds, anthropicKey) {
  const profileCtx = tasteProfile
    ? `\n\nUser Letterboxd taste profile:\n${JSON.stringify(tasteProfile, null, 2)}`
    : '';

  const excludeCtx = excludeIds?.length
    ? `\n\nUser has already seen these TMDB IDs — DO NOT include them: ${excludeIds.join(', ')}`
    : '';

  const dirCtx = directorCandidates.length
    ? `\n\nDirector Picks available on user's platforms (use one of these as the third pick — pick_type "wildcard"):\n${directorCandidates.map(d => `- "${d.title}" (${d.year}) on ${d.platform} — ${d.director_name}'s pick: "${d.director_quote}"`).join('\n')}`
    : '';

  const prompt = `You are Fred, a sharp cinephile film curator.

Platforms: ${platforms.join(', ')}
Mood: ${moods.join(', ')}${profileCtx}${excludeCtx}${dirCtx}

Regular movie candidates:
${JSON.stringify(regular.movies, null, 2)}

Series candidates:
${JSON.stringify(regular.series, null, 2)}

Pick exactly 3 total:
- 1 movie with pick_type "safe" — the reliable great choice
- 1 movie with pick_type "stretch" — more adventurous, different feel from safe
- 1 series with pick_type "safe"

${directorCandidates.length ? 'IMPORTANT: Replace the stretch movie with a Director Pick from the list above. Use director_name and director_quote from that list.' : ''}

STRICT RULES:
- Return EXACTLY 3 items: 2 movies + 1 series. No exceptions.
- NO duplicate titles. Every title must be unique.
- Match mood precisely.
- Variety: the 2 movies must feel different from each other.
- For "adventure" mood: think Indiana Jones, The Goonies, Jurassic Park, Lord of the Rings — thrilling journeys, exotic locations, quests, survival, discovery. NOT superhero films, NOT franchise action.
- For "horror" mood: prefer psychological, atmospheric, or elevated horror over pure gore.
- For "smart" mood: think complex dramas, independent films, festival winners, foreign language films, documentaries — cerebral, challenging, rewarding cinema.
- For "funny" mood: comedies, satires, screwballs — films that are genuinely funny. Absolutely NO horror, NO war, NO dark dramas. If a candidate doesn't fit the mood at all, skip it even if the rating is high.
- For "romantic" mood: love stories, relationship dramas — emotional and tender. NOT action, NOT horror.
- For "family" mood: all-ages films, animated films, coming-of-age stories. Light, joyful, accessible.
- STRICT: Never recommend a horror or dark film for a funny/family/romantic mood. Mood matching is the #1 priority over rating.
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

// Get real platform for a title
async function enrichPlatform(tmdbId, type, title, year, platformIds, token) {
  // Try JustWatch first (real-time, accurate)
  try {
    const platformNames = platformIds.map(id => {
      const m = { 8:'Netflix', 9:'Prime Video', 15:'Hulu', 384:'Max', 350:'Apple TV+', 337:'Disney+', 386:'Peacock' };
      return m[id];
    }).filter(Boolean);

    const jwParams = new URLSearchParams({
      title, year: year || '', type,
      platforms: platformNames.join(','),
    });
    const jwRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://fred-psi.vercel.app'}/api/justwatch?${jwParams}`);
    if (jwRes.ok) {
      const jwData = await jwRes.json();
      if (jwData?.platform) return jwData.platform;
    }
  } catch (e) {
    console.log('JustWatch fallback to TMDB:', e.message);
  }

  // Fallback: TMDB watch providers
  try {
    const result = await enrichByTitle(type, title, year, token);
    const realId = result?.id || tmdbId;
    if (!realId) return null;
    const endpoint = type === 'series'
      ? `${TMDB}/tv/${realId}/watch/providers`
      : `${TMDB}/movie/${realId}/watch/providers`;
    const data = await tmdbFetch(endpoint, token);
    const us = data?.results?.US;
    if (!us) return null;
    const available = [...(us.flatrate||[]), ...(us.free||[]), ...(us.ads||[])];
    const match = available.find(p => platformIds.includes(p.provider_id));
    if (!match) return null;
    const nameMap = { 8:'Netflix', 9:'Prime Video', 15:'Hulu', 384:'Max', 350:'Apple TV+', 337:'Disney+', 386:'Peacock' };
    return nameMap[match.provider_id] || match.provider_name;
  } catch { return null; }
}

// Fetch real poster from TMDB using tmdb_id
async function enrichByTitle(type, title, year, token) {
  if (!token || !title) return null;
  try {
    const q = encodeURIComponent(title);
    const url = type === 'series'
      ? `${TMDB}/search/tv?query=${q}&language=en-US`
      : `${TMDB}/search/movie?query=${q}&year=${year}&language=en-US`;
    const search = await tmdbFetch(url, token);
    if (!search?.results?.length) return null;
    // Find best match - exact title first, then first result
    const results = search.results;
    const exact = results.find(r => {
      const t = (type === 'series' ? r.name : r.title) || '';
      return t.toLowerCase() === title.toLowerCase();
    });
    return exact || results[0];
  } catch { return null; }
}

async function enrichPoster(tmdbId, type, title, year, token) {
  if (!token) return null;
  try {
    // Always search by title for accuracy — Claude's tmdb_ids are unreliable
    const result = await enrichByTitle(type, title, year, token);
    return result?.poster_path || null;
  } catch { return null; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const platforms    = (searchParams.get('platforms') || '').split(',').filter(Boolean);
  const moods        = (searchParams.get('moods')     || 'smart').split(',').filter(Boolean);
  const tasteProfile = searchParams.get('taste') ? JSON.parse(decodeURIComponent(searchParams.get('taste'))) : null;
  const excludeIds   = (searchParams.get('exclude') || '').split(',').filter(Boolean).map(Number);
  const replaceType  = searchParams.get('replace') || null;

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

    // Enrich top candidates with OMDB ratings (top 8 by vote_average)
    const topMovies = [...regular.movies].sort((a,b) => parseFloat(b.rating||0) - parseFloat(a.rating||0)).slice(0,8);
    const omdbMap = {};
    await Promise.all(topMovies.map(async m => {
      const scores = await getOMDBRatings(m.title, m.year);
      if (scores) omdbMap[m.tmdb_id] = scores;
    }));

    // Add composite score to candidates
    const enrichedMovies = regular.movies.map(m => ({
      ...m,
      omdb:            omdbMap[m.tmdb_id] || null,
      composite_score: compositeScore(m, omdbMap[m.tmdb_id] || null).toFixed(2),
      rt_score:        omdbMap[m.tmdb_id]?.rt ? `${omdbMap[m.tmdb_id].rt}%` : null,
    }));

    const picks = await curateWithClaude({ ...regular, movies: enrichedMovies }, directorCandidates, platforms, moods, tasteProfile, excludeIds, anthropicKey);

    // Enforce 2 movies + 1 series, no duplicates
    const seen = new Set();
    const movies = [];
    const series = [];
    for (const pick of picks) {
      const key = (pick.title || '').toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (pick.type === 'series' && series.length < 1) series.push(pick);
      else if (pick.type === 'movie' && movies.length < 2) movies.push(pick);
      if (movies.length === 2 && series.length === 1) break;
    }
    const ordered = [...movies, ...series];

    const finalPicks = replaceType
      ? ordered.filter(p => p.type === replaceType).slice(0, 1)
      : ordered;

    const result = finalPicks.map(pick => {
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

    // Enrich poster + platform directly from TMDB
    const platformIds = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean);
    const enriched = await Promise.all(result.map(async pick => {
      const [realPoster, realPlatform] = await Promise.all([
        enrichPoster(pick.tmdb_id, pick.type, pick.title, pick.year, tmdbToken),
        enrichPlatform(pick.tmdb_id, pick.type, pick.title, pick.year, platformIds, tmdbToken),
      ]);
      return {
        ...pick,
        poster:   realPoster   || pick.poster,
        platform: realPlatform || pick.platform || platforms[0],
      };
    }));

    return NextResponse.json({ picks: enriched });

  } catch (err) {
    console.error('Picks error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

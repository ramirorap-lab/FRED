import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PROVIDER_IDS = {
  'Netflix': '8', 'Prime Video': '9', 'Hulu': '15',
  'Max': '1899', 'Apple TV+': '350', 'Disney+': '337', 'Peacock': '386',
};

const MOOD_GENRE_MAP = {
  funny:     [35],
  smart:     [18, 878, 9648],
  dark:      [53, 18, 80],
  romantic:  [10749, 35],
  intense:   [53, 28],
  horror:    [27],
  adventure: [12, 28],
  family:    [10751, 16],
};

const SMART_KEYWORDS = '3801,165,10349,179431,2651,4764';
const SMART_GENRES   = [878, 9648, 53, 99];
const SMART_MIN_RATING = '7.5';
const SMART_MIN_VOTES  = '500';

const MOOD_COMBO_MAP = {
  'funny+smart':     [35, 18],     'smart+funny':     [35, 18],
  'funny+dark':      [35, 53],     'dark+funny':      [35, 53],
  'funny+romantic':  [35, 10749],  'romantic+funny':  [35, 10749],
  'funny+intense':   [35, 53],     'intense+funny':   [35, 53],
  'funny+horror':    [35, 27],     'horror+funny':    [35, 27],
  'funny+adventure': [35, 12],     'adventure+funny': [35, 12],
  'funny+family':    [35, 10751],  'family+funny':    [35, 10751],
  'smart+dark':      [18, 80],     'dark+smart':      [18, 80],
  'smart+romantic':  [18, 10749],  'romantic+smart':  [18, 10749],
  'smart+intense':   [53, 9648],   'intense+smart':   [53, 9648],
  'smart+horror':    [27, 9648],   'horror+smart':    [27, 9648],
  'smart+adventure': [878, 12],    'adventure+smart': [878, 12],
  'smart+family':    [18, 10751],  'family+smart':    [18, 10751],
  'dark+romantic':   [18, 10749],  'romantic+dark':   [18, 10749],
  'dark+intense':    [53, 80],     'intense+dark':    [53, 80],
  'dark+horror':     [27, 53],     'horror+dark':     [27, 53],
  'dark+adventure':  [53, 12],     'adventure+dark':  [53, 12],
  'dark+family':     [18, 10751],  'family+dark':     [18, 10751],
  'romantic+intense':  [10749, 53],    'intense+romantic':  [10749, 53],
  'romantic+horror':   [10749, 27],    'horror+romantic':   [10749, 27],
  'romantic+adventure':[10749, 12],    'adventure+romantic':[10749, 12],
  'romantic+family':   [10749, 10751], 'family+romantic':   [10749, 10751],
  'intense+horror':    [27, 53],    'horror+intense':    [27, 53],
  'intense+adventure': [28, 12],    'adventure+intense': [28, 12],
  'intense+family':    [28, 10751], 'family+intense':    [28, 10751],
  'horror+adventure':  [27, 12],    'adventure+horror':  [27, 12],
  'horror+family':     [27, 10751], 'family+horror':     [27, 10751],
  'adventure+family':  [12, 10751], 'family+adventure':  [12, 10751],
};

const AWARDS_DB = {
  497698: { oscar: 'Winner' }, 603692: { oscar: 'Winner' },
  661374: { oscar: 'Winner' }, 872585: { oscar: 'Winner' },
  792307: { oscar: 'Nominated' }, 933131: { oscar: 'Nominated' },
  674324: { oscar: 'Nominated' }, 361743: { oscar: 'Nominated' },
  1079091:{ oscar: 'Winner' }, 1010581:{ oscar: 'Nominated' },
  557:    { cannes: "Palme d'Or" }, 696374: { cannes: "Palme d'Or" },
};

const BLOCKLIST = new Set([
  120089, 125987, 114472, 1630423, 508947, 438695,
  398978, 823464, 698507, 680796, 795359,
]);

const DOCUMENTARY_IDS = [
  9947, 33223, 75780, 27905, 76864, 293660, 264644, 355008,
  480530, 522016, 531428, 614930, 615904, 550988, 913823, 926676,
  1004663, 913838, 395834, 109418, 670, 14819, 557600, 900667, 502170,
];

const VALID_DOCUMENTARY_IDS = DOCUMENTARY_IDS;

async function rerankWithHaiku(candidates, moods, apiKey) {
  if (!apiKey || candidates.length <= 1) return candidates[0] || null;

  const list = candidates.slice(0, 15).map((f, i) =>
    `${i + 1}. ${f.title || f.name} (${(f.release_date || f.first_air_date || '').slice(0,4)}) — ${f.overview?.slice(0, 120) || ''}`
  ).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      system: `You are a film curator. Given a list of films and a mood, return ONLY the number of the best pick. Nothing else — just the number.`,
      messages: [{
        role: 'user',
        content: `Mood: ${moods.join(' + ')}\n\nFilms:\n${list}\n\nWhich number best fits the mood? Reply with just the number.`,
      }],
    }),
  });

  const data = await res.json();
  const pick = parseInt(data.content?.[0]?.text?.trim()) - 1;
  return candidates[pick] ?? candidates[0];
}

function awardBadge(id) {
  const a = AWARDS_DB[id];
  if (!a) return null;
  if (a.oscar === 'Winner')    return '🏆 Oscar Winner';
  if (a.oscar === 'Nominated') return '🎬 Oscar Nominated';
  if (a.cannes)                return `🌿 Cannes ${a.cannes}`;
  return null;
}

async function getRedditPick(exclude = [], supabase) {
  try {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('reddit_picks')
      .select('*')
      .order('mention_count', { ascending: false })
      .limit(20);
    if (error || !data?.length) return null;
    const excludeSet = new Set(exclude);
    return data.find(r => !excludeSet.has(r.tmdb_id)) || null;
  } catch {
    return null;
  }
}

async function getDirectorPick(moods, exclude = [], supabase, tmdbToken) {
  try {
    if (!supabase) return null;

    const excludeSet = new Set(exclude);
    let pool = [];

    try {
      if (moods.length > 0) {
        const { data: tagged, error: tagErr } = await supabase
          .from('director_picks')
          .select('*')
          .not('director', 'in', '("Academy Awards","Cannes Film Festival")')
          .overlaps('moods', moods)
          .limit(100);
        if (!tagErr) pool = tagged || [];
      }
    } catch { /* moods column may not exist yet */ }

    if (!pool.length) {
      const { data: fallback } = await supabase
        .from('director_picks')
        .select('*')
        .not('director', 'in', '("Academy Awards","Cannes Film Festival")')
        .order('created_at', { ascending: false })
        .limit(150);
      pool = fallback || [];
    }

    if (!pool.length) return null;

    const candidates = pool
      .filter(p => p.film_title && !excludeSet.has(p.film_title))
      .sort(() => Math.random() - 0.5);

    console.log(`Director pick pool: ${candidates.length} candidates for moods: ${moods.join(',')}`);

    for (const pick of candidates.slice(0, 20)) {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(pick.film_title)}&language=en-US`,
          { headers: { Authorization: `Bearer ${tmdbToken}` } }
        );
        const data2 = await res.json();
        const film = data2.results?.find(f => !excludeSet.has(f.id) && !BLOCKLIST.has(f.id));
        if (film) {
          return { ...film, director_name: pick.director, director_quote: pick.quote };
        }
      } catch { continue; }
    }
    return null;
  } catch (e) {
    console.error('Director pick error:', e);
    return null;
  }
}

async function fetchCuratedDoc(exclude, platforms, tmdbToken) {
  const excludeSet = new Set(exclude || []);
  const PROVIDER_MAP = {
    'Netflix': '8', 'Prime Video': '9', 'Hulu': '15',
    'Max': '1899', 'Apple TV+': '350', 'Disney+': '337', 'Peacock': '386',
  };
  const providerIds = platforms.map(p => PROVIDER_MAP[p]).filter(Boolean);

  const shuffled = [...VALID_DOCUMENTARY_IDS]
    .filter(id => !excludeSet.has(id) && !BLOCKLIST.has(id))
    .sort(() => Math.random() - 0.5);

  for (const id of shuffled) {
    try {
      const [detailRes, providerRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/movie/${id}?language=en-US`,
          { headers: { Authorization: `Bearer ${tmdbToken}` } }),
        fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers`,
          { headers: { Authorization: `Bearer ${tmdbToken}` } }),
      ]);
      const detail    = await detailRes.json();
      const providers = await providerRes.json();

      const genreIds = (detail.genres || []).map(g => g.id);
      const isDoc = genreIds.includes(99);
      if (!isDoc || !detail.id || BLOCKLIST.has(detail.id)) continue;

      const flatrate = providers.results?.US?.flatrate || [];
      const available = providerIds.length === 0 ||
        flatrate.some(p => providerIds.includes(String(p.provider_id)));

      if (available) return { ...detail, _isDoc: true };
    } catch { continue; }
  }

  for (const id of shuffled) {
    try {
      const res    = await fetch(`https://api.themoviedb.org/3/movie/${id}?language=en-US`,
        { headers: { Authorization: `Bearer ${tmdbToken}` } });
      const detail = await res.json();
      const genreIds = (detail.genres || []).map(g => g.id);
      if (detail.id && genreIds.includes(99) && !BLOCKLIST.has(detail.id)) {
        return { ...detail, _isDoc: true };
      }
    } catch { continue; }
  }

  return null;
}

async function tmdbDiscover({ genreIds, platforms, exclude, recentOnly, isSeries, page = 1, moods = [] }, tmdbToken) {
  const providerIds = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean).join('|');
  const endpoint = isSeries
    ? 'https://api.themoviedb.org/3/discover/tv'
    : 'https://api.themoviedb.org/3/discover/movie';

  const comboKey = moods.slice().sort().join('+');
  const comboGenres = MOOD_COMBO_MAP[comboKey];
  const resolvedGenreIds = comboGenres || genreIds;

  const isSmart = moods.length === 1 && moods[0] === 'smart';
  const isCombo = !!comboGenres;

  const params = new URLSearchParams({
    sort_by: recentOnly ? 'popularity.desc' : 'vote_average.desc',
    'vote_count.gte': recentOnly ? '100' : isSmart ? SMART_MIN_VOTES : isCombo ? '200' : '500',
    'vote_average.gte': recentOnly ? '6.5' : isSmart ? SMART_MIN_RATING : isCombo ? '6.8' : '7.2',
    language: 'en-US',
    include_adult: 'false',
    page: String(page),
  });

  if (isSmart && !recentOnly) {
    params.set('with_genres', SMART_GENRES.join('|'));
  } else if (resolvedGenreIds?.length) {
    params.set('with_genres', resolvedGenreIds.join(isCombo ? ',' : '|'));
  }

  if (!recentOnly) {
    isSeries ? params.set('first_air_date.gte', '2000-01-01') : params.set('primary_release_date.gte', '2000-01-01');
  } else {
    isSeries ? params.set('first_air_date.gte', '2025-01-01') : params.set('primary_release_date.gte', '2025-01-01');
  }

  if (providerIds) {
    params.set('with_watch_providers', providerIds);
    params.set('watch_region', 'US');
  }

  const res  = await fetch(`${endpoint}?${params}`, { headers: { Authorization: `Bearer ${tmdbToken}` } });
  const data = await res.json();
  const excludeSet = new Set(exclude || []);
  const TITLE_BLOCKLIST = ['my dearest assassin', 'rebel moon', 'my demon', 'redeeming love'];
  const results = (data.results || []).filter(r =>
    r && // ← null guard
    !excludeSet.has(r.id) &&
    !BLOCKLIST.has(r.id) &&
    !TITLE_BLOCKLIST.some(t => (r.title || r.name || '').toLowerCase().includes(t))
  );

  if (results.length < 8 && params.has('with_watch_providers')) {
    params.delete('with_watch_providers');
    params.delete('watch_region');
    const res2  = await fetch(`${endpoint}?${params}`, { headers: { Authorization: `Bearer ${tmdbToken}` } });
    const data2 = await res2.json();
    return (data2.results || []).filter(r =>
      r && // ← null guard
      !excludeSet.has(r.id) &&
      !BLOCKLIST.has(r.id)
    );
  }

  return results;
}

const ANIMATION_GENRE = 16;

// ── FIX: null guard so isAnimated(null) never crashes ──
function isAnimated(film) {
  if (!film) return false;
  return (film.genre_ids || film.genres?.map(g => g.id) || []).includes(ANIMATION_GENRE);
}

function capAnimation(results, maxAnimated = 1) {
  let animCount = 0;
  return results.filter(r => {
    if (isAnimated(r)) {
      animCount++;
      return animCount <= maxAnimated;
    }
    return true;
  });
}

async function getDetails(id, isSeries, tmdbToken) {
  const base = isSeries
    ? `https://api.themoviedb.org/3/tv/${id}`
    : `https://api.themoviedb.org/3/movie/${id}`;

  const [detailRes, providerRes, imagesRes] = await Promise.all([
    fetch(`${base}?language=en-US`, { headers: { Authorization: `Bearer ${tmdbToken}` } }),
    fetch(`${base}/watch/providers`, { headers: { Authorization: `Bearer ${tmdbToken}` } }),
    fetch(`${base}/images`, { headers: { Authorization: `Bearer ${tmdbToken}` } }),
  ]);

  const detail    = await detailRes.json();
  const providers = await providerRes.json();
  const images    = await imagesRes.json();

  const platform = providers.results?.US?.flatrate?.[0]?.provider_name || 'Check streaming';

  let runtime = '';
  if (isSeries) {
    const s = detail.number_of_seasons;
    runtime = s ? `${s} season${s > 1 ? 's' : ''}` : '';
  } else {
    const mins = detail.runtime || 0;
    runtime = mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '';
  }

  const backdrops = images.backdrops || [];
  const backdrop = backdrops
    .filter(b => !b.iso_639_1 || b.iso_639_1 === 'en')
    .sort((a, b) => b.vote_average - a.vote_average)[0]
    ?.file_path || detail.backdrop_path || null;

  return {
    platform,
    runtime,
    rating: detail.vote_average?.toFixed(1) || null,
    backdrop,
    poster: detail.poster_path || null,
  };
}

async function writeFredNote(film, isSeries, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: `You are Fred, a sharp cinephile. Write ONE sentence (max 18 words) about why this film is worth watching. No title mention. No filler. Just the sharpest thing you can say about it.`,
      messages: [{ role: 'user', content: `${film.title || film.name} (${(film.release_date || film.first_air_date || '').slice(0,4)}): ${film.overview}` }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

export async function GET(req) {
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = supabaseKey
    ? createClient(process.env.SUPABASE_URL, supabaseKey)
    : null;
  const { searchParams } = new URL(req.url);
  const platforms  = (searchParams.get('platforms') || '').split(',').filter(Boolean);
  const moods      = (searchParams.get('moods')     || '').split(',').filter(Boolean);
  const excludeRaw = (searchParams.get('exclude')   || '').split(',').filter(Boolean);
  const exclude    = excludeRaw.map(Number).filter(Boolean);
  const isRefresh  = exclude.length > 0;
  const pageOffset = isRefresh ? Math.floor(exclude.length / 2) : 0;
  const page       = isRefresh ? (Math.floor(Math.random() * 8) + 1 + pageOffset) : 1;

  const apiKey    = process.env.ANTHROPIC_API_KEY;
  const tmdbToken = process.env.TMDB_TOKEN;

  if (!tmdbToken) return NextResponse.json({ error: 'TMDB token missing' }, { status: 500 });

  const genreIds = [...new Set(moods.flatMap(m => MOOD_GENRE_MAP[m] || []))];

  try {
    const smartSolo = moods.length === 1 && moods[0] === 'smart';
    const seriesGenreIds = smartSolo ? SMART_GENRES : genreIds;

    const page2 = isRefresh ? (Math.floor(Math.random() * 8) + 1 + pageOffset) : 1;
    const page3 = isRefresh ? (Math.floor(Math.random() * 8) + 1 + pageOffset) : 1;

    const [allTimeResults, recentResults, seriesResults, directorPickRaw, docResults] = await Promise.all([
      tmdbDiscover({ genreIds, platforms, exclude, recentOnly: false, isSeries: false, moods, page }, tmdbToken),
      tmdbDiscover({ genreIds, platforms, exclude, recentOnly: true,  isSeries: false, moods, page: 1 }, tmdbToken),
      tmdbDiscover({ genreIds: seriesGenreIds, platforms, exclude, recentOnly: false, isSeries: true, moods, page: page3 }, tmdbToken),
      getDirectorPick(moods, exclude, supabase, tmdbToken),
      smartSolo ? fetchCuratedDoc(exclude, platforms, tmdbToken) : Promise.resolve(null),
    ]);

    // SLOT 1 — Fred's Pick
    const cappedAllTime = capAnimation(allTimeResults);
    const film1 = apiKey
      ? await rerankWithHaiku(cappedAllTime.slice(0, 15), moods, apiKey)
      : cappedAllTime[0] || null;

    const usedIds = new Set([film1?.id, directorPickRaw?.id].filter(Boolean));

    // SLOT 2 — Director's Pick
    console.log('Director pick raw:', directorPickRaw ? `${directorPickRaw.title} (${directorPickRaw.director_name})` : 'null');
    const directorPick = directorPickRaw && directorPickRaw.id !== film1?.id
      ? directorPickRaw : null;

    // ── FIX: guard film1 before passing to isAnimated ──
    const alreadyHasAnimation = film1 ? isAnimated(film1) : false;

    // SLOT 3 — Documentary (smart) or Recent 2025/2026
    let film3 = null;
    if (smartSolo && docResults?._isDoc) {
      film3 = !usedIds.has(docResults.id) ? docResults : null;
    } else {
      film3 = recentResults.find(r =>
        r &&
        !usedIds.has(r.id) &&
        !(alreadyHasAnimation && isAnimated(r)) &&
        r.vote_average >= 7.0 &&
        r.vote_count >= 100
      ) || null;
    }

    // SLOT 4 — Series
    const seriesCandidates = seriesResults.filter(r =>
      r &&
      !usedIds.has(r.id) &&
      !(alreadyHasAnimation && isAnimated(r))
    );
    const series1 = apiKey
      ? await rerankWithHaiku(seriesCandidates.slice(0, 15), moods, apiKey)
      : seriesCandidates[0] || null;

    const slots = [film1, directorPick, film3, series1].filter(Boolean);

    const enriched = await Promise.all(slots.map(async (film) => {
      const isDirector = film === directorPick;
      const isSeries   = film === series1;
      const isDoc      = film === film3 && !!film._isDoc;
      const isRecent   = !isDoc && film === film3 && (film.release_date || '').slice(0, 4) >= '2025';

      const [details, fredNote] = await Promise.all([
        getDetails(film.id, isSeries, tmdbToken),
        apiKey ? writeFredNote(film, isSeries, apiKey) : Promise.resolve(''),
      ]);

      let pick_type = 'safe';
      if (isDirector) pick_type = 'wildcard';
      else if (isDoc)    pick_type = 'documentary';
      else if (isRecent) pick_type = 'recent';
      else if (isSeries) pick_type = 'series';

      return {
        id:             film.id,
        tmdb_id:        film.id,
        title:          film.title || film.name,
        poster:         details.poster   || film.poster_path   || null,
        backdrop:       details.backdrop || film.backdrop_path || null,
        year:           (film.release_date || film.first_air_date || '').slice(0, 4),
        platform:       details.platform,
        runtime:        details.runtime,
        rating:         details.rating,
        type:           isSeries ? 'series' : 'movie',
        fred_note:      fredNote,
        award_badge:    awardBadge(film.id),
        pick_type,
        is_recent:      isRecent,
        director_name:  isDirector ? film.director_name  : null,
        director_quote: isDirector ? film.director_quote : null,
      };
    }));

    return NextResponse.json({ picks: enriched });

  } catch (err) {
    console.error('Picks error:', err.message, err.stack);
    return NextResponse.json({ error: err.message || 'Could not fetch picks' }, { status: 500 });
  }
}

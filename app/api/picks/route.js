import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PROVIDER_IDS = {
  'Netflix': '8', 'Prime Video': '9', 'Hulu': '15',
  'Max': '1899', 'Apple TV+': '350', 'Disney+': '337', 'Peacock': '386',
};

const MOOD_GENRE_MAP = {
  funny:     [35],
  smart:     [18, 878, 9648], // overridden by MOOD_SMART_KEYWORDS below
  dark:      [53, 18, 80],
  romantic:  [10749, 35],
  intense:   [53, 28],
  horror:    [27],
  adventure: [12, 28],
  family:    [10751, 16],
};

// Smart mood gets special treatment — keywords signal cerebral/complex films
// TMDB keyword IDs: philosophical=3801, psychological=165, surrealism=10349,
// dystopia=179431, satire=2651, thought-provoking=9882, nonlinear=4764
const SMART_KEYWORDS = '3801,165,10349,179431,2651,4764';
const SMART_GENRES   = [878, 9648, 53, 99]; // sci-fi, mystery, thriller, documentary — no drama (too broad)
const SMART_MIN_RATING = '7.5';
const SMART_MIN_VOTES  = '500'; // lower than fiction — docs rarely hit 1000

const MOOD_COMBO_MAP = {
  // funny + X
  'funny+smart':     [35, 18],     'smart+funny':     [35, 18],     // comedy-drama
  'funny+dark':      [35, 53],     'dark+funny':      [35, 53],     // dark comedy
  'funny+romantic':  [35, 10749],  'romantic+funny':  [35, 10749],  // rom-com
  'funny+intense':   [35, 53],     'intense+funny':   [35, 53],     // action-comedy
  'funny+horror':    [35, 27],     'horror+funny':    [35, 27],     // horror-comedy
  'funny+adventure': [35, 12],     'adventure+funny': [35, 12],     // adventure-comedy
  'funny+family':    [35, 10751],  'family+funny':    [35, 10751],  // family comedy
  // smart + X
  'smart+dark':      [18, 80],     'dark+smart':      [18, 80],     // crime drama
  'smart+romantic':  [18, 10749],  'romantic+smart':  [18, 10749],  // romantic drama
  'smart+intense':   [53, 9648],   'intense+smart':   [53, 9648],   // thriller-mystery
  'smart+horror':    [27, 9648],   'horror+smart':    [27, 9648],   // psychological horror
  'smart+adventure': [878, 12],    'adventure+smart': [878, 12],    // sci-fi adventure
  'smart+family':    [18, 10751],  'family+smart':    [18, 10751],  // family drama
  // dark + X
  'dark+romantic':   [18, 10749],  'romantic+dark':   [18, 10749],  // dark romance
  'dark+intense':    [53, 80],     'intense+dark':    [53, 80],     // crime thriller
  'dark+horror':     [27, 53],     'horror+dark':     [27, 53],     // horror-thriller
  'dark+adventure':  [53, 12],     'adventure+dark':  [53, 12],     // dark adventure
  'dark+family':     [18, 10751],  'family+dark':     [18, 10751],  // dark family drama
  // romantic + X
  'romantic+intense':  [10749, 53],    'intense+romantic':  [10749, 53],    // romantic thriller
  'romantic+horror':   [10749, 27],    'horror+romantic':   [10749, 27],    // romantic horror
  'romantic+adventure':[10749, 12],    'adventure+romantic':[10749, 12],    // romantic adventure
  'romantic+family':   [10749, 10751], 'family+romantic':   [10749, 10751], // family romance
  // intense + X
  'intense+horror':    [27, 53],    'horror+intense':    [27, 53],    // horror-thriller
  'intense+adventure': [28, 12],    'adventure+intense': [28, 12],    // action-adventure
  'intense+family':    [28, 10751], 'family+intense':    [28, 10751], // family action
  // horror + X
  'horror+adventure':  [27, 12],    'adventure+horror':  [27, 12],    // horror-adventure
  'horror+family':     [27, 10751], 'family+horror':     [27, 10751], // family horror
  // adventure + X
  'adventure+family':  [12, 10751], 'family+adventure':  [12, 10751], // family adventure
};

const AWARDS_DB = {
  497698: { oscar: 'Winner' }, 603692: { oscar: 'Winner' },
  661374: { oscar: 'Winner' }, 872585: { oscar: 'Winner' },
  792307: { oscar: 'Nominated' }, 933131: { oscar: 'Nominated' },
  674324: { oscar: 'Nominated' }, 361743: { oscar: 'Nominated' },
  1079091:{ oscar: 'Winner' }, 1010581:{ oscar: 'Nominated' },
  557:    { cannes: "Palme d'Or" }, 696374: { cannes: "Palme d'Or" },
};

// ── Blocklist — titles Fred should never recommend in picks ──
const BLOCKLIST = new Set([
  120089, // My Demon
  125987, // Redeeming Love
  114472, // My Dearest Assassin (series)
  1630423,// My Dearest Assassin (2026 film)
  508947, // Turning Red
  438695, // Sing 2
  398978, // The Christmas Chronicles
  823464, // Godzilla x Kong
  698507, // Predator: Badlands
  680796, // Rebel Moon Part One
  795359, // Rebel Moon Part Two
  // Add more as you encounter them — find TMDB ID at themoviedb.org
]);

// ── Curated documentary list — all IDs verified from TMDB URLs ──
const DOCUMENTARY_IDS = [
  9947,    // Man on Wire (2008)
  33223,   // Exit Through the Gift Shop (2010)
  75780,   // Searching for Sugar Man (2012)
  27905,   // Grizzly Man (2005)
  76864,   // The Act of Killing (2012)
  293660,  // Amy (2015)
  264644,  // The Look of Silence (2014)
  355008,  // 13th (2016)
  480530,  // Free Solo (2018)
  522016,  // Apollo 11 (2019)
  531428,  // Flee (2021)
  614930,  // Summer of Soul (2021)
  615904,  // My Octopus Teacher (2020)
  550988,  // The Rescue (2021)
  913823,  // Fire of Love (2022) — verified
  926676,  // Navalny (2022) — verified
  1004663, // All the Beauty and the Bloodshed (2022) — verified
  913838,  // All That Breathes (2022) — verified
  395834,  // Won't You Be My Neighbor? (2018)
  109418,  // Stories We Tell (2012)
  670,     // Bowling for Columbine (2002)
  14819,   // Anvil! The Story of Anvil (2008)
  557600,  // Minding the Gap (2018)
  900667,  // Stutz (2022) — Netflix
  502170,  // The Velvet Underground (2021)
];

const VALID_DOCUMENTARY_IDS = DOCUMENTARY_IDS;

// ── Haiku reranker — picks best film from candidates given mood context ──
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
        content: `Mood: ${moods.join(' + ')}

Films:
${list}

Which number best fits the mood? Reply with just the number.`,
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

// Fetch a trending pick from Supabase reddit_picks table
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

// ── Fetch a director's pick matching the mood from Supabase ──
async function getDirectorPick(moods, exclude = [], supabase, tmdbToken) {
  try {
    if (!supabase) return null;

    const excludeSet = new Set(exclude);

    // Query using database mood tags if available, else fetch all
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

    // Fallback: fetch all and pick randomly
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

    // Pick one — take first TMDB result, trust the title search
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

// ── Pick a curated documentary available on user platforms ──
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

  // First pass: platform-matched
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

      // Hard validate — must be a real documentary
      const genreIds = (detail.genres || []).map(g => g.id);
      const isDoc = genreIds.includes(99);
      if (!isDoc || !detail.id || BLOCKLIST.has(detail.id)) continue;

      const flatrate = providers.results?.US?.flatrate || [];
      const available = providerIds.length === 0 ||
        flatrate.some(p => providerIds.includes(String(p.provider_id)));

      if (available) return { ...detail, _isDoc: true };
    } catch { continue; }
  }

  // Second pass: ignore platform, try all curated IDs
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

  // Smart mood: use keywords + higher quality bar
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
    // Smart: high-rated films across cerebral genres — no keyword filter
    // (keyword + genre combo can return 0 results for small platforms)
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
    !excludeSet.has(r.id) &&
    !BLOCKLIST.has(r.id) &&
    !TITLE_BLOCKLIST.some(t => (r.title || r.name || '').toLowerCase().includes(t))
  );

  // If platform filter returns too few results, retry without platform constraint
  if (results.length < 8 && params.has('with_watch_providers')) {
    params.delete('with_watch_providers');
    params.delete('watch_region');
    const res2  = await fetch(`${endpoint}?${params}`, { headers: { Authorization: `Bearer ${tmdbToken}` } });
    const data2 = await res2.json();
    return (data2.results || []).filter(r => !excludeSet.has(r.id) && !BLOCKLIST.has(r.id));
  }

  return results;
}

// Animation genre ID
const ANIMATION_GENRE = 16;

function isAnimated(film) {
  return (film.genre_ids || film.genres?.map(g=>g.id) || []).includes(ANIMATION_GENRE);
}

// Cap animated films to 1 across all slots
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

  // Pick best backdrop: prefer English ones with high vote average
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
  // Use service role key if available, fall back to anon key (director_picks is public)
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
  // Each refresh goes deeper: exclude count drives page offset + wide random spread
  const pageOffset = isRefresh ? Math.floor(exclude.length / 2) : 0;
  const page       = isRefresh ? (Math.floor(Math.random() * 8) + 1 + pageOffset) : 1;

  const apiKey    = process.env.ANTHROPIC_API_KEY;
  const tmdbToken = process.env.TMDB_TOKEN;

  if (!tmdbToken) return NextResponse.json({ error: 'TMDB token missing' }, { status: 500 });

  const genreIds = [...new Set(moods.flatMap(m => MOOD_GENRE_MAP[m] || []))];

  try {
    // For smart mood, override genreIds for series too
    const smartSolo = moods.length === 1 && moods[0] === 'smart';
    const seriesGenreIds = smartSolo ? SMART_GENRES : genreIds;

    // Fetch all slot types in parallel
    // Each slot gets its own random page so they never all hit the same results
    const page2 = isRefresh ? (Math.floor(Math.random() * 8) + 1 + pageOffset) : 1;
    const page3 = isRefresh ? (Math.floor(Math.random() * 8) + 1 + pageOffset) : 1;

    const [allTimeResults, recentResults, seriesResults, directorPickRaw, docResults] = await Promise.all([
      tmdbDiscover({ genreIds, platforms, exclude, recentOnly: false, isSeries: false, moods, page }, tmdbToken),
      tmdbDiscover({ genreIds, platforms, exclude, recentOnly: true,  isSeries: false, moods, page: 1 }, tmdbToken),
      tmdbDiscover({ genreIds: seriesGenreIds, platforms, exclude, recentOnly: false, isSeries: true, moods, page: page3 }, tmdbToken),
      getDirectorPick(moods, exclude, supabase, tmdbToken),
      // Documentary slot — curated list, not TMDB genre query
      smartSolo ? fetchCuratedDoc(exclude, platforms, tmdbToken) : Promise.resolve(null),
    ]);

    // SLOT 1 — Fred's Pick: best rated for mood, Haiku reranked
    const cappedAllTime = capAnimation(allTimeResults);
    const film1 = apiKey
      ? await rerankWithHaiku(cappedAllTime.slice(0, 15), moods, apiKey)
      : cappedAllTime[0] || null;

    const usedIds = new Set([film1?.id, directorPickRaw?.id].filter(Boolean));

    // SLOT 2 — Director's Pick from Supabase
    console.log('Director pick raw:', directorPickRaw ? `${directorPickRaw.title} (${directorPickRaw.director_name})` : 'null');
    const directorPick = directorPickRaw && directorPickRaw.id !== film1?.id
      ? directorPickRaw : null;

    // SLOT 3 — Smart: documentary | Others: recent 2025/2026 only if high quality
    const alreadyHasAnimation = isAnimated(film1);
    let film3 = null;
    if (smartSolo && docResults?._isDoc) {
      // For smart: use curated documentary (verified with _isDoc flag)
      film3 = !usedIds.has(docResults.id) ? docResults : null;
    } else {
      // For other moods: only show recent if vote_average >= 7.0 AND vote_count >= 100
      // This prevents weak 2025 films from appearing just because they're new
      film3 = recentResults.find(r =>
        !usedIds.has(r.id) &&
        !(alreadyHasAnimation && isAnimated(r)) &&
        r.vote_average >= 7.0 &&
        r.vote_count >= 100
      ) || null;
    }

    // SLOT 4 — Series: best series for mood, Haiku reranked
    const seriesCandidates = seriesResults.filter(r =>
      !usedIds.has(r.id) && !(alreadyHasAnimation && isAnimated(r))
    );
    const series1 = apiKey
      ? await rerankWithHaiku(seriesCandidates.slice(0, 15), moods, apiKey)
      : seriesCandidates[0] || null;

    // Build ordered slots: Fred's Pick, Director's Pick, Documentary/Recent, Series
    const slots = [film1, directorPick, film3, series1].filter(Boolean);

    const enriched = await Promise.all(slots.map(async (film, i) => {
      const isDirector = film === directorPick;
      const isSeries   = film === series1;
      // isDoc only when film3 came from fetchCuratedDoc (has doc_verified flag)
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

import { NextResponse } from 'next/server';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const GENRE_MAP = {
  chill:    { movie: [18, 10751], tv: [18] },
  smart:    { movie: [18, 99],    tv: [18, 99] },
  funny:    { movie: [35],        tv: [35] },
  dark:     { movie: [53, 80, 27],tv: [53, 80] },
  romantic: { movie: [10749, 18], tv: [18] },
  intense:  { movie: [28, 53],    tv: [10759, 53] },
  short:    { movie: [18, 35],    tv: [18, 35] },
  award:    { movie: [18],        tv: [18] },
};

const PROVIDER_MAP = {
  'Netflix': 8,
  'Max': 384,
  'Prime Video': 9,
  'Hulu': 15,
  'Disney+': 337,
  'Apple TV+': 350,
  'Peacock': 386,
};

const FRED_REASONS = {
  chill:    ['Easy to watch. Hard to forget.', 'No demands on your brain tonight. Just watch.', 'The perfect low-key evening.'],
  smart:    ['Demands full attention. Rewards it completely.', 'Smart without being pretentious. Rare.', 'The kind of film that stays with you.'],
  funny:    ['Actually funny, not just mildly amusing.', 'Will make you laugh out loud. That still counts.', 'Sharp and warm at the same time.'],
  dark:     ['Unsettling in exactly the right way.', "Dark without being gratuitous — which is the hard part.", "You won't be checking your phone."],
  romantic: ['Tender and precise. No melodrama.', 'Emotionally honest in a way most films aren\'t.', 'The kind of love story that feels true.'],
  intense:  ["Doesn't let you breathe. That's the point.", 'High stakes, genuine tension.', 'The pacing alone makes it worth it.'],
  short:    ['Short enough for a weeknight. Good enough to remember.', 'Concise and precise. No filler.', 'Under 90 minutes. All signal, no noise.'],
  award:    ['Critics got this one right.', 'One of those rare ones that lives up to the reputation.', 'Sits with you long after the credits.'],
};

function calcScore(item) {
  const r = (item.vote_average / 10) * 50;
  const p = Math.min((item.popularity || 0) / 150, 1) * 30;
  const v = Math.min((item.vote_count || 0) / 5000, 1) * 20;
  return r + p + v + Math.random() * 10;
}

function getReason(moods) {
  const mood = moods[0] || 'smart';
  const pool = FRED_REASONS[mood] || FRED_REASONS.smart;
  return pool[Math.floor(Math.random() * pool.length)];
}

function isLetterboxd(item) {
  return item.vote_average >= 7.4 && item.vote_count >= 1500;
}

function formatTitle(item) {
  return item.title || item.name || 'Untitled';
}

function formatYear(item) {
  return (item.release_date || item.first_air_date || '').slice(0, 4);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const platforms = (searchParams.get('platforms') || '').split(',').filter(Boolean);
  const moods = (searchParams.get('moods') || 'smart').split(',').filter(Boolean);

  const token = process.env.TMDB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'TMDB_TOKEN not configured' }, { status: 500 });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const isShort = moods.includes('short');
  const isAward = moods.includes('award');
  const sort = isAward ? 'vote_average.desc' : 'popularity.desc';
  const minVotes = isAward ? 800 : 150;

  const movieGenres = [...new Set(moods.flatMap(m => GENRE_MAP[m]?.movie || [18]))].join(',');
  const tvGenres = [...new Set(moods.flatMap(m => GENRE_MAP[m]?.tv || [18]))].join(',');
  const providerIds = platforms.map(p => PROVIDER_MAP[p]).filter(Boolean).join('|');

  const mParams = new URLSearchParams({
    sort_by: sort,
    'vote_count.gte': String(minVotes),
    with_genres: movieGenres,
    watch_region: 'US',
    language: 'en-US',
    page: '1',
  });
  if (providerIds) mParams.set('with_watch_providers', providerIds);
  if (isShort) mParams.set('with_runtime.lte', '90');

  const tParams = new URLSearchParams({
    sort_by: sort,
    'vote_count.gte': String(Math.floor(minVotes * 0.6)),
    with_genres: tvGenres,
    watch_region: 'US',
    language: 'en-US',
    page: '1',
  });
  if (providerIds) tParams.set('with_watch_providers', providerIds);

  try {
    const [mRes, tRes] = await Promise.all([
      fetch(`${TMDB_BASE}/discover/movie?${mParams}`, { headers }),
      fetch(`${TMDB_BASE}/discover/tv?${tParams}`, { headers }),
    ]);

    const [mData, tData] = await Promise.all([mRes.json(), tRes.json()]);

    const movies = (mData.results || [])
      .filter(m => m.poster_path)
      .map(m => ({ ...m, _type: 'movie' }));

    const shows = (tData.results || [])
      .filter(s => s.poster_path)
      .map(s => ({ ...s, _type: 'tv' }));

    const all = [...movies, ...shows]
      .map(item => ({ ...item, _score: calcScore(item) }))
      .sort((a, b) => b._score - a._score);

    const picks = [];
    const movie = all.find(i => i._type === 'movie');
    const show = all.find(i => i._type === 'tv');
    if (movie) picks.push(movie);
    if (show && show.id !== movie?.id) picks.push(show);
    all
      .filter(i => !picks.find(p => p.id === i.id && p._type === i._type))
      .slice(0, 3 - picks.length)
      .forEach(i => picks.push(i));

    const result = picks.slice(0, 3).map(item => ({
      id: `${item._type}-${item.id}`,
      title: formatTitle(item),
      year: formatYear(item),
      type: item._type,
      platform: platforms[0] || 'Streaming',
      runtime: item._type === 'tv' ? 'Series' : null,
      poster: item.poster_path,
      rating: item.vote_average,
      letterboxd: isLetterboxd(item),
      topRated: item.vote_average >= 8.0,
      reason: getReason(moods),
    }));

    return NextResponse.json({ picks: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch from TMDB' }, { status: 500 });
  }
}

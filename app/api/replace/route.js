import { NextResponse } from 'next/server';

const TMDB   = 'https://api.themoviedb.org/3';
const ANTHRO = 'https://api.anthropic.com/v1/messages';

const MOOD_GENRES = {
  smart:     { movie: [18, 99, 9648], tv: [18, 99] },
  dark:      { movie: [53, 80, 27],   tv: [53, 80] },
  funny:     { movie: [35],           tv: [35] },
  romantic:  { movie: [10749, 18],    tv: [18] },
  intense:   { movie: [28, 53],       tv: [10759, 53] },
  horror:    { movie: [27, 53],       tv: [9648, 27] },
  adventure: { movie: [12, 14, 37],   tv: [10759, 12] },
  family:    { movie: [10751, 16, 35],tv: [10751, 16] },
};

const PROVIDER_IDS = {
  'Netflix': 8, 'Prime Video': 9, 'Hulu': 15,
  'Max': 384, 'Apple TV+': 350, 'Disney+': 337, 'Peacock': 386,
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type       = searchParams.get('type') || 'movie';
  const platforms  = (searchParams.get('platforms') || '').split(',').filter(Boolean);
  const moods      = (searchParams.get('moods') || 'smart').split(',').filter(Boolean);
  const excludeIds = (searchParams.get('exclude') || '').split(',').filter(Boolean);

  const tmdbToken    = process.env.TMDB_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!tmdbToken || !anthropicKey) {
    return NextResponse.json({ error: 'Missing config' }, { status: 500 });
  }

  const providerIds = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean).join('|');
  const genres = type === 'series'
    ? [...new Set(moods.flatMap(m => MOOD_GENRES[m]?.tv || [18]))].join(',')
    : [...new Set(moods.flatMap(m => MOOD_GENRES[m]?.movie || [18]))].join(',');

  // Fetch candidates — page 2 for more variety
  const page = Math.random() > 0.5 ? 2 : 1;
  const params = new URLSearchParams({
    watch_region: 'US', language: 'en-US',
    'vote_count.gte': type === 'series' ? '150' : '300',
    'vote_average.gte': '6.8',
    sort_by: 'vote_average.desc',
    with_genres: genres,
    page: String(page),
    ...(providerIds && { with_watch_providers: providerIds }),
  });

  const endpoint = type === 'series'
    ? `${TMDB}/discover/tv?${params}`
    : `${TMDB}/discover/movie?${params}`;

  const data = await tmdbFetch(endpoint, tmdbToken);
  const results = (data?.results || []).filter(r => r.poster_path);

  // Filter out excluded ids
  const candidates = results
    .filter(r => !excludeIds.includes(String(r.id)))
    .slice(0, 12)
    .map(r => ({
      id:       r.id,
      title:    type === 'series' ? r.name : r.title,
      year:     (type === 'series' ? r.first_air_date : r.release_date)?.slice(0,4) || '',
      rating:   r.vote_average?.toFixed(1),
      poster:   r.poster_path,
      overview: r.overview?.slice(0, 100),
    }));

  if (!candidates.length) {
    return NextResponse.json({ error: 'No candidates found' }, { status: 404 });
  }

  // Ask Claude for 1 pick — minimal prompt for speed
  const prompt = `You are Fred. Pick ONE ${type} from this list for mood: ${moods.join(', ')}.
Platforms: ${platforms.join(', ')}

Candidates:
${JSON.stringify(candidates, null, 2)}

Reply with ONLY valid JSON — no markdown:
{"tmdb_id":123,"title":"string","year":"2023","poster":"/path.jpg","rating":8.1,"fred_note":"One punchy sentence max 15 words.","letterboxd":true}

letterboxd: true if rating >= 7.4`;

  try {
    const res = await fetch(ANTHRO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const d    = await res.json();
    const text = d.content?.[0]?.text || '{}';
    const pick = JSON.parse(text.replace(/```json|```/g, '').trim());

    // Get poster and platform in parallel
    const [posterData, providerData] = await Promise.all([
      tmdbFetch(
        type === 'series'
          ? `${TMDB}/tv/${pick.tmdb_id}?language=en-US`
          : `${TMDB}/movie/${pick.tmdb_id}?language=en-US`,
        tmdbToken
      ),
      tmdbFetch(
        type === 'series'
          ? `${TMDB}/tv/${pick.tmdb_id}/watch/providers`
          : `${TMDB}/movie/${pick.tmdb_id}/watch/providers`,
        tmdbToken
      ),
    ]);

    // Get real platform
    const us = providerData?.results?.US;
    const flatrate = [...(us?.flatrate||[]), ...(us?.free||[])];
    const pIds = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean);
    const matchedProvider = flatrate.find(p => pIds.includes(p.provider_id));
    const nameMap = { 8:'Netflix', 9:'Prime Video', 15:'Hulu', 384:'Max', 350:'Apple TV+', 337:'Disney+', 386:'Peacock' };
    const platform = nameMap[matchedProvider?.provider_id] || platforms[0];

    return NextResponse.json({
      picks: [{
        id:         `${type}-${pick.tmdb_id}`,
        tmdb_id:    pick.tmdb_id,
        title:      pick.title,
        year:       pick.year,
        type,
        platform,
        runtime:    posterData?.runtime ? `${Math.floor(posterData.runtime/60)}h ${posterData.runtime%60}m` : (type === 'series' ? 'Series' : ''),
        rating:     pick.rating,
        letterboxd: pick.letterboxd,
        pick_type:  'safe',
        poster:     posterData?.poster_path || pick.poster,
        fred_note:  pick.fred_note,
      }],
    });

  } catch (err) {
    console.error('Replace error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

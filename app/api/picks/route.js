import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function fredScore(title, selectedMoods) {
  const moodMatches = (title.moods || []).filter(m => selectedMoods.includes(m)).length;
  const moodBonus   = moodMatches * 20;
  const ratingScore = ((title.rating || 0) / 10) * 40;
  const lbBonus     = title.letterboxd ? 10 : 0;
  const pickBonus   = { safe: 5, stretch: 2, wildcard: 8 }[title.pick_type] || 0;
  const jitter      = Math.random() * 12;
  return moodBonus + ratingScore + lbBonus + pickBonus + jitter;
}

// Fetch real poster from TMDB by ID
async function fetchPoster(tmdbId, type, token) {
  if (!token || !tmdbId) return null;
  try {
    const endpoint = type === 'series'
      ? `${TMDB_BASE}/tv/${tmdbId}`
      : `${TMDB_BASE}/movie/${tmdbId}`;
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 86400 }, // cache 24h
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.poster_path || null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const platforms = (searchParams.get('platforms') || '').split(',').filter(Boolean);
  const moods     = (searchParams.get('moods') || 'smart').split(',').filter(Boolean);

  if (!platforms.length) {
    return NextResponse.json({ error: 'No platforms selected' }, { status: 400 });
  }

  const tmdbToken = process.env.TMDB_TOKEN;

  try {
    const { data: movies } = await supabase
      .from('titles').select('*')
      .eq('type', 'movie').eq('active', true)
      .in('platform', platforms).overlaps('moods', moods)
      .gte('rating', 6.5).order('rating', { ascending: false }).limit(30);

    const { data: series } = await supabase
      .from('titles').select('*')
      .eq('type', 'series').eq('active', true)
      .in('platform', platforms).overlaps('moods', moods)
      .gte('rating', 6.5).order('rating', { ascending: false }).limit(20);

    let moviePool = movies?.length ? movies : [];
    let seriesPool = series?.length ? series : [];

    // Fallback if no mood match
    if (!moviePool.length) {
      const { data: fb } = await supabase.from('titles').select('*')
        .eq('type', 'movie').eq('active', true).in('platform', platforms).limit(20);
      moviePool = fb || [];
    }
    if (!seriesPool.length) {
      const { data: fb } = await supabase.from('titles').select('*')
        .eq('type', 'series').eq('active', true).in('platform', platforms).limit(10);
      seriesPool = fb || [];
    }

    const rankedMovies = moviePool
      .map(t => ({ ...t, _score: fredScore(t, moods) }))
      .sort((a, b) => b._score - a._score);

    const rankedSeries = seriesPool
      .map(t => ({ ...t, _score: fredScore(t, moods) }))
      .sort((a, b) => b._score - a._score);

    const safeMovie    = rankedMovies.find(t => t.pick_type === 'safe');
    const stretchMovie = rankedMovies.find(t => t.pick_type !== 'safe' && t.id !== safeMovie?.id);
    const pick1 = safeMovie    || rankedMovies[0];
    const pick2 = stretchMovie || rankedMovies.find(t => t.id !== pick1?.id);
    const pick3 = rankedSeries[0];

    const rawPicks = [pick1, pick2, pick3].filter(Boolean);

    // Fetch real posters from TMDB in parallel
    const picksWithPosters = await Promise.all(
      rawPicks.map(async (t) => {
        const poster = await fetchPoster(t.tmdb_id, t.type, tmdbToken);
        return {
          id:         `${t.type}-${t.tmdb_id}`,
          tmdb_id:    t.tmdb_id,
          title:      t.title,
          year:       t.year,
          type:       t.type,
          platform:   t.platform,
          runtime:    t.runtime,
          director:   t.director,
          moods:      t.moods,
          rating:     t.rating,
          letterboxd: t.letterboxd,
          pick_type:  t.pick_type,
          poster:     poster || t.poster || null, // TMDB live → fallback to stored
          fred_note:  t.fred_note,
        };
      })
    );

    return NextResponse.json({ picks: picksWithPosters });

  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: err.message || 'Database error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// Fred Score: weighted ranking for curation
function fredScore(title, selectedMoods) {
  const moodMatches = (title.moods || []).filter(m => selectedMoods.includes(m)).length;
  const moodBonus   = moodMatches * 20;
  const ratingScore = ((title.rating || 0) / 10) * 40;
  const lbBonus     = title.letterboxd ? 10 : 0;
  const pickBonus   = { safe: 5, stretch: 2, wildcard: 8 }[title.pick_type] || 0;
  const jitter      = Math.random() * 12; // small randomness so picks rotate
  return moodBonus + ratingScore + lbBonus + pickBonus + jitter;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const platforms = (searchParams.get('platforms') || '').split(',').filter(Boolean);
  const moods     = (searchParams.get('moods') || 'smart').split(',').filter(Boolean);

  if (!platforms.length) {
    return NextResponse.json({ error: 'No platforms selected' }, { status: 400 });
  }

  try {
    // ── Fetch movies ──────────────────────────────────────────────
    const { data: movies, error: movErr } = await supabase
      .from('titles')
      .select('*')
      .eq('type', 'movie')
      .eq('active', true)
      .in('platform', platforms)
      .overlaps('moods', moods)
      .gte('rating', 6.5)
      .order('rating', { ascending: false })
      .limit(30);

    if (movErr) throw movErr;

    // ── Fetch series ──────────────────────────────────────────────
    const { data: series, error: serErr } = await supabase
      .from('titles')
      .select('*')
      .eq('type', 'series')
      .eq('active', true)
      .in('platform', platforms)
      .overlaps('moods', moods)
      .gte('rating', 6.5)
      .order('rating', { ascending: false })
      .limit(20);

    if (serErr) throw serErr;

    // ── Fallback: if no mood match, get any from those platforms ──
    let moviePool = movies?.length ? movies : [];
    let seriesPool = series?.length ? series : [];

    if (!moviePool.length) {
      const { data: fallbackMovies } = await supabase
        .from('titles').select('*').eq('type', 'movie')
        .eq('active', true).in('platform', platforms).limit(20);
      moviePool = fallbackMovies || [];
    }

    if (!seriesPool.length) {
      const { data: fallbackSeries } = await supabase
        .from('titles').select('*').eq('type', 'series')
        .eq('active', true).in('platform', platforms).limit(10);
      seriesPool = fallbackSeries || [];
    }

    // ── Score + rank ───────────────────────────────────────────────
    const rankedMovies = moviePool
      .map(t => ({ ...t, _score: fredScore(t, moods) }))
      .sort((a, b) => b._score - a._score);

    const rankedSeries = seriesPool
      .map(t => ({ ...t, _score: fredScore(t, moods) }))
      .sort((a, b) => b._score - a._score);

    // ── Pick 2 movies + 1 series ───────────────────────────────────
    // Try to mix pick_types: 1 safe + 1 stretch/wildcard for movies
    const safeMovie     = rankedMovies.find(t => t.pick_type === 'safe');
    const stretchMovie  = rankedMovies.find(t => t.pick_type !== 'safe' && t.id !== safeMovie?.id);
    const fallbackMovie = rankedMovies.find(t => t.id !== safeMovie?.id);

    const pick1 = safeMovie    || rankedMovies[0];
    const pick2 = stretchMovie || fallbackMovie || rankedMovies[1];
    const pick3 = rankedSeries[0];

    const picks = [pick1, pick2, pick3].filter(Boolean).map(t => ({
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
      poster:     t.poster,
      fred_note:  t.fred_note,
    }));

    return NextResponse.json({ picks });

  } catch (err) {
    console.error('Supabase error:', err);
    return NextResponse.json({ error: err.message || 'Database error' }, { status: 500 });
  }
}

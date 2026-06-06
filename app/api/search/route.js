import { NextResponse } from 'next/server';

const PROVIDER_IDS = {
  'Netflix': '8', 'Prime Video': '9', 'Hulu': '15',
  'Max': '1899', 'Apple TV+': '350', 'Disney+': '337', 'Peacock': '386',
};

const AWARDS_DB = {
  497698: { oscar: 'Winner' }, 603692: { oscar: 'Winner' },
  661374: { oscar: 'Winner' }, 872585: { oscar: 'Winner' },
  792307: { oscar: 'Nominated' }, 933131: { oscar: 'Nominated' },
  674324: { oscar: 'Nominated' }, 361743: { oscar: 'Nominated' },
  1079091:{ oscar: 'Winner' }, 1010581:{ oscar: 'Nominated' },
  557:    { cannes: "Palme d'Or" }, 696374: { cannes: "Palme d'Or" },
};

function awardBadge(id) {
  const a = AWARDS_DB[id];
  if (!a) return null;
  if (a.oscar === 'Winner')    return '🏆 Oscar Winner';
  if (a.oscar === 'Nominated') return '🎬 Oscar Nominated';
  if (a.cannes)                return `🌿 Cannes ${a.cannes}`;
  return null;
}

async function getDetails(id, isSeries, tmdbToken) {
  const base = isSeries
    ? `https://api.themoviedb.org/3/tv/${id}`
    : `https://api.themoviedb.org/3/movie/${id}`;

  const [detailRes, providerRes] = await Promise.all([
    fetch(`${base}?language=en-US`, { headers: { Authorization: `Bearer ${tmdbToken}` } }),
    fetch(`${base}/watch/providers`, { headers: { Authorization: `Bearer ${tmdbToken}` } }),
  ]);

  const detail    = await detailRes.json();
  const providers = await providerRes.json();
  const platform  = providers.results?.US?.flatrate?.[0]?.provider_name || 'Check streaming';

  let runtime = '';
  if (isSeries) {
    const s = detail.number_of_seasons;
    runtime = s ? `${s} season${s > 1 ? 's' : ''}` : '';
  } else {
    const mins = detail.runtime || 0;
    runtime = mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '';
  }

  return {
    platform,
    runtime,
    rating: detail.vote_average?.toFixed(1) || null,
    backdrop: detail.backdrop_path || null,
    poster:   detail.poster_path   || null,
    overview: detail.overview      || '',
    tagline:  detail.tagline       || '',
    genres:   (detail.genres || []).map(g => g.name).slice(0, 3),
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query     = searchParams.get('q')?.trim() || '';
  const tmdbToken = process.env.TMDB_TOKEN;

  if (!query) return NextResponse.json({ results: [] });
  if (!tmdbToken) return NextResponse.json({ error: 'TMDB token missing' }, { status: 500 });

  try {
    // Search movies + TV + people in parallel
    const [movieRes, tvRes, personRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1`,
        { headers: { Authorization: `Bearer ${tmdbToken}` } }),
      fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=1`,
        { headers: { Authorization: `Bearer ${tmdbToken}` } }),
      fetch(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(query)}&language=en-US&page=1`,
        { headers: { Authorization: `Bearer ${tmdbToken}` } }),
    ]);

    const [movieData, tvData, personData] = await Promise.all([
      movieRes.json(), tvRes.json(), personRes.json(),
    ]);

    // Person detection — if top person result is an actor/director, use their credits
    const person = personData.results?.[0];
    const movieTopResult = movieData.results?.[0];

    // Prefer person if: they exist, have decent popularity,
    // AND the top movie result doesn't closely match the query
    const queryLower = query.toLowerCase();
    const movieTitleMatch = movieTopResult
      ? movieTopResult.title.toLowerCase().includes(queryLower) || queryLower.includes(movieTopResult.title.toLowerCase())
      : false;

    if (person && person.popularity > 3 && !movieTitleMatch) {
      // Use movie_credits for full filmography — more reliable than known_for
      const creditsRes = await fetch(
        `https://api.themoviedb.org/3/person/${person.id}/movie_credits?language=en-US`,
        { headers: { Authorization: `Bearer ${tmdbToken}` } }
      );
      const creditsData = await creditsRes.json();

      // Top 4 films by vote_average, minimum vote threshold
      const topFilms = (creditsData.cast || [])
        .filter(f => f.vote_count > 100 && f.vote_average > 5)
        .sort((a, b) => b.vote_average - a.vote_average)
        .slice(0, 4);

      if (topFilms.length) {
        const enriched = await Promise.all(topFilms.map(async f => {
          const details = await getDetails(f.id, false, tmdbToken);
          return {
            id:          f.id,
            tmdb_id:     f.id,
            title:       f.title,
            type:        'movie',
            year:        f.release_date?.slice(0, 4) || '',
            poster:      details.poster   || f.poster_path   || null,
            backdrop:    details.backdrop || f.backdrop_path || null,
            platform:    details.platform,
            runtime:     details.runtime,
            rating:      details.rating,
            overview:    details.overview,
            genres:      details.genres,
            award_badge: awardBadge(f.id),
            meta:        `${details.platform} · ${details.runtime}`,
            person_name: person.name,
            person_role: person.known_for_department,
          };
        }));
        return NextResponse.json({ results: enriched, type: 'person', person_name: person.name });
      }
    }

    // Merge movie + TV results, sort by popularity, take top 5
    const movies = (movieData.results || []).map(r => ({ ...r, media_type: 'movie' }));
    const shows  = (tvData.results   || []).map(r => ({ ...r, media_type: 'tv'    }));
    const merged = [...movies, ...shows]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 5);

    const enriched = await Promise.all(merged.map(async r => {
      const isSeries = r.media_type === 'tv';
      const details  = await getDetails(r.id, isSeries, tmdbToken);
      return {
        id:          r.id,
        tmdb_id:     r.id,
        title:       r.title || r.name,
        type:        isSeries ? 'series' : 'movie',
        year:        (r.release_date || r.first_air_date || '').slice(0, 4),
        poster:      details.poster   || r.poster_path   || null,
        backdrop:    details.backdrop || r.backdrop_path || null,
        platform:    details.platform,
        runtime:     details.runtime,
        rating:      details.rating,
        overview:    details.overview,
        genres:      details.genres,
        award_badge: awardBadge(r.id),
        meta:        `${details.platform} · ${details.runtime}`,
      };
    }));

    return NextResponse.json({ results: enriched, type: 'title' });

  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

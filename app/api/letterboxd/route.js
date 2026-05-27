import { NextResponse } from 'next/server';

// Parse Letterboxd ratings.csv
function parseRatings(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    return {
      date:   vals[0]?.trim(),
      name:   vals[1]?.trim().replace(/^"|"$/g, ''),
      year:   vals[2]?.trim(),
      uri:    vals[3]?.trim(),
      rating: parseFloat(vals[4]?.trim()) || null,
    };
  }).filter(r => r.name && r.rating);
}

// Parse Letterboxd watchlist.csv
function parseWatchlist(csv) {
  const lines = csv.trim().split('\n');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    return {
      name: vals[1]?.trim().replace(/^"|"$/g, ''),
      year: vals[2]?.trim(),
    };
  }).filter(r => r.name);
}

// Build taste profile from ratings
function buildTasteProfile(ratings, watchlist) {
  if (!ratings.length) return null;

  const sorted = [...ratings].sort((a, b) => b.rating - a.rating);

  // Top films (rated 4+ out of 5)
  const favoriteFilms = sorted
    .filter(r => r.rating >= 4)
    .slice(0, 20)
    .map(r => `${r.name} (${r.year})`);

  // Disliked films (rated 2 or below)
  const dislikedFilms = sorted
    .filter(r => r.rating <= 2)
    .slice(0, 10)
    .map(r => r.name);

  // Average rating
  const avgRating = (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(2);

  // Recent films (last 20)
  const recentFilms = sorted
    .slice(0, 20)
    .map(r => r.name);

  // High-rated recent (last year, 4+)
  const currentYear = new Date().getFullYear();
  const recentHighRated = ratings
    .filter(r => r.rating >= 4 && parseInt(r.year) >= currentYear - 2)
    .map(r => r.name)
    .slice(0, 10);

  return {
    totalRated:       ratings.length,
    averageRating:    parseFloat(avgRating),
    favoriteFilms,
    dislikedFilms,
    recentHighRated,
    watchlistTitles:  watchlist.slice(0, 20).map(w => w.name),
    ratingDistribution: {
      five:      ratings.filter(r => r.rating === 5).length,
      four:      ratings.filter(r => r.rating >= 4 && r.rating < 5).length,
      three:     ratings.filter(r => r.rating >= 3 && r.rating < 4).length,
      two:       ratings.filter(r => r.rating >= 2 && r.rating < 3).length,
      one:       ratings.filter(r => r.rating < 2).length,
    },
  };
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const ratingsFile   = formData.get('ratings');
    const watchlistFile = formData.get('watchlist');

    if (!ratingsFile) {
      return NextResponse.json({ error: 'ratings.csv is required' }, { status: 400 });
    }

    const ratingsText   = await ratingsFile.text();
    const watchlistText = watchlistFile ? await watchlistFile.text() : '';

    const ratings   = parseRatings(ratingsText);
    const watchlist = watchlistText ? parseWatchlist(watchlistText) : [];

    if (!ratings.length) {
      return NextResponse.json({ error: 'No ratings found in file' }, { status: 400 });
    }

    const tasteProfile = buildTasteProfile(ratings, watchlist);

    return NextResponse.json({
      success: true,
      profile: tasteProfile,
      message: `Parsed ${ratings.length} ratings from Letterboxd.`,
    });

  } catch (err) {
    console.error('Letterboxd parse error:', err);
    return NextResponse.json({ error: 'Failed to parse CSV' }, { status: 500 });
  }
}

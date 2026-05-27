import { NextResponse } from 'next/server';

const JW_API   = 'https://apis.justwatch.com/graphql';
const JW_HEADERS = {
  'Content-Type':  'application/json',
  'User-Agent':    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Origin':        'https://www.justwatch.com',
  'Referer':       'https://www.justwatch.com/',
  'Accept':        'application/json',
};

// Map JustWatch package technicalName → our platform names
const JW_PACKAGE_MAP = {
  'nfx':  'Netflix',
  'prv':  'Prime Video',
  'hlu':  'Hulu',
  'hbm':  'Max',
  'atp':  'Apple TV+',
  'dnp':  'Disney+',
  'pct':  'Peacock',
};

const SEARCH_QUERY = `
query SearchTitle($title: String!, $country: String!, $type: MediaType!) {
  popularTitles(
    country: $country
    filter: { searchQuery: $title, objectTypes: [$type] }
    first: 5
  ) {
    edges {
      node {
        id
        content(country: $country, language: "en") {
          title
          originalReleaseYear
          posterUrl(profile: S166)
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          package {
            id
            clearName
            technicalName
          }
        }
      }
    }
  }
}`;

async function searchJustWatch(title, year, type, platforms) {
  const jwType = type === 'series' ? 'SHOW' : 'MOVIE';

  try {
    const res = await fetch(JW_API, {
      method: 'POST',
      headers: JW_HEADERS,
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: { title, country: 'US', type: jwType },
      }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const edges = data?.data?.popularTitles?.edges || [];

    // Find best match by title + year
    const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = edges.find(e => {
      const t = e.node?.content?.title || '';
      const y = e.node?.content?.originalReleaseYear;
      const titleMatch = clean(t) === clean(title);
      const yearMatch  = !year || !y || Math.abs(parseInt(y) - parseInt(year)) <= 1;
      return titleMatch && yearMatch;
    }) || edges[0];

    if (!match) return null;

    const node   = match.node;
    const offers = node.offers || [];

    // Only flatrate (subscription) offers
    const flatrate = offers.filter(o => o.monetizationType === 'FLATRATE');
    const available = flatrate
      .map(o => JW_PACKAGE_MAP[o.package?.technicalName])
      .filter(Boolean);

    // Filter to user's platforms
    const userPlatform = platforms.find(p => available.includes(p));

    return {
      platform:    userPlatform || available[0] || null,
      allPlatforms: available,
      jwPoster:    node.content?.posterUrl || null,
    };
  } catch (err) {
    console.error('JustWatch error:', err);
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title     = searchParams.get('title');
  const year      = searchParams.get('year');
  const type      = searchParams.get('type') || 'movie';
  const platforms = (searchParams.get('platforms') || '').split(',').filter(Boolean);

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const result = await searchJustWatch(title, year, type, platforms);

  return NextResponse.json(result || { platform: null, allPlatforms: [] });
}

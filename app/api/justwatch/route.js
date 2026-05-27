import { NextResponse } from 'next/server';

const JW_API = 'https://apis.justwatch.com/graphql';

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
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          package {
            clearName
            technicalName
          }
        }
      }
    }
  }
}`;

const JW_PACKAGE_MAP = {
  'nfx': 'Netflix',
  'prv': 'Prime Video',
  'hlu': 'Hulu',
  'hbm': 'Max',
  'atp': 'Apple TV+',
  'dnp': 'Disney+',
  'pct': 'Peacock',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title     = searchParams.get('title');
  const year      = searchParams.get('year');
  const type      = searchParams.get('type') || 'movie';
  const platforms = (searchParams.get('platforms') || '').split(',').filter(Boolean);

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const jwType = type === 'series' ? 'SHOW' : 'MOVIE';

  try {
    const res = await fetch(JW_API, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'User-Agent':     'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Origin':         'https://www.justwatch.com',
        'Referer':        'https://www.justwatch.com/us/search?q=' + encodeURIComponent(title),
        'Accept':         'application/json, text/plain, */*',
        'Accept-Language':'en-US,en;q=0.9',
        'Cache-Control':  'no-cache',
        'Pragma':         'no-cache',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      },
      body: JSON.stringify({
        operationName: 'SearchTitle',
        query: SEARCH_QUERY,
        variables: { title, country: 'US', type: jwType },
      }),
    });

    const text = await res.text();
    console.log('JW status:', res.status, 'body:', text.slice(0, 200));

    if (!res.ok) {
      return NextResponse.json({ platform: null, allPlatforms: [], error: `JW ${res.status}` });
    }

    const data   = JSON.parse(text);
    const edges  = data?.data?.popularTitles?.edges || [];

    const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = edges.find(e => {
      const t = e.node?.content?.title || '';
      const y = e.node?.content?.originalReleaseYear;
      return clean(t) === clean(title) && (!year || !y || Math.abs(parseInt(y) - parseInt(year)) <= 1);
    }) || edges[0];

    if (!match) return NextResponse.json({ platform: null, allPlatforms: [] });

    const flatrate = (match.node.offers || []).filter(o => o.monetizationType === 'FLATRATE');
    const available = flatrate.map(o => JW_PACKAGE_MAP[o.package?.technicalName]).filter(Boolean);
    const userPlatform = platforms.find(p => available.includes(p)) || available[0] || null;

    return NextResponse.json({ platform: userPlatform, allPlatforms: available });

  } catch (err) {
    console.error('JustWatch error:', err.message);
    return NextResponse.json({ platform: null, allPlatforms: [], error: err.message });
  }
}

import { NextResponse } from 'next/server';

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

  try {
    // Try JustWatch REST API v2
    const body = {
      content_types: [type === 'series' ? 'show' : 'movie'],
      search_query: title,
      page_size: 5,
      page: 1,
    };

    const res = await fetch('https://apis.justwatch.com/content/titles/en_US/popular', {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'User-Agent':     'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Origin':         'https://www.justwatch.com',
        'Referer':        'https://www.justwatch.com/',
        'Accept':         'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log('JW REST status:', res.status, text.slice(0, 300));

    if (!res.ok) {
      return NextResponse.json({ platform: null, allPlatforms: [], debug: `${res.status}: ${text.slice(0,100)}` });
    }

    const data  = JSON.parse(text);
    const items = data?.items || [];

    const clean = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const match = items.find(i => {
      const t = i.title || i.original_title || '';
      const y = i.original_release_year;
      return clean(t) === clean(title) && (!year || !y || Math.abs(y - parseInt(year)) <= 1);
    }) || items[0];

    if (!match) return NextResponse.json({ platform: null, allPlatforms: [] });

    const offers   = match.offers || [];
    const flatrate = offers.filter(o => o.monetization_type === 'flatrate');
    const available = [...new Set(
      flatrate.map(o => JW_PACKAGE_MAP[o.package_short_name]).filter(Boolean)
    )];

    const userPlatform = platforms.find(p => available.includes(p)) || available[0] || null;

    return NextResponse.json({ platform: userPlatform, allPlatforms: available });

  } catch (err) {
    console.error('JW error:', err.message);
    return NextResponse.json({ platform: null, allPlatforms: [], error: err.message });
  }
}

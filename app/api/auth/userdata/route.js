import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  const auth = request.headers.get('x-user-id');
  if (!auth) return NextResponse.json({ watched: [], watchlist: [] });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const [{ data: w }, { data: s }] = await Promise.all([
    supabase.from('user_watched').select('*').eq('user_id', auth),
    supabase.from('user_watchlist').select('*').eq('user_id', auth),
  ]);

  return NextResponse.json({
    watched:   (w||[]).map(r => ({ id: r.tmdb_id, title: r.title, type: r.type })),
    watchlist: (s||[]).map(r => ({ id: `${r.type}-${r.tmdb_id}`, tmdb_id: r.tmdb_id, title: r.title, type: r.type, platform: r.platform, poster: r.poster })),
  });
}

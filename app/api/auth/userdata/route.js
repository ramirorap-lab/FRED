import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ watched: [], watchlist: [] });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return Response.json({ watched: [], watchlist: [] });

    const [watchedRes, watchlistRes] = await Promise.all([
      supabase.from('user_seen').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('user_watchlist').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    return Response.json({
      watched:   (watchedRes.data  || []).map(r => ({ id: r.tmdb_id, title: r.title, type: r.type })),
      watchlist: (watchlistRes.data || []).map(r => ({
        id: r.tmdb_id, tmdb_id: r.tmdb_id, title: r.title,
        type: r.type, platform: r.platform, poster: r.poster,
      })),
    });
  } catch (e) {
    console.error('userdata error:', e);
    return Response.json({ watched: [], watchlist: [] });
  }
}

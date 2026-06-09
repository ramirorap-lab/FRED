import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tmdb_id, title, type, platform, poster } = await req.json();

    const { error: upsertError } = await supabase
      .from('user_watchlist')
      .upsert({
        user_id: user.id,
        tmdb_id,
        title,
        type:     type     || 'movie',
        platform: platform || '',
        poster:   poster   || '',
      }, { onConflict: 'user_id,tmdb_id' });

    if (upsertError) throw upsertError;
    return Response.json({ ok: true });
  } catch (e) {
    console.error('save error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tmdb_id } = await req.json();

    await supabase.from('user_watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('tmdb_id', tmdb_id);

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

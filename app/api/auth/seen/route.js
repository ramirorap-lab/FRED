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

    const { tmdb_id, title, type } = await req.json();

    const { error: upsertError } = await supabase
      .from('user_seen')
      .upsert({
        user_id: user.id,
        tmdb_id,
        title,
        type: type || 'movie',
      }, { onConflict: 'user_id,tmdb_id' });

    if (upsertError) throw upsertError;
    return Response.json({ ok: true });
  } catch (e) {
    console.error('seen error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

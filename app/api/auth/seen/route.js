import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  const { tmdb_id, title, type, user_id } = await request.json();
  if (!user_id || !tmdb_id) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  await supabase.from('user_watched').upsert(
    { user_id, tmdb_id, title, type },
    { onConflict: 'user_id,tmdb_id' }
  );
  return NextResponse.json({ success: true });
}

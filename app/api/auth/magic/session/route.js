import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );
    const token = cookieStore.get('sb-access-token')?.value ||
                  cookieStore.get(`sb-${process.env.SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`)?.value;
    if (!token) return NextResponse.json({ user: null });
    const { data: { user } } = await supabase.auth.getUser(token);
    return NextResponse.json({ user: user ? { id: user.id, email: user.email } : null });
  } catch {
    return NextResponse.json({ user: null });
  }
}

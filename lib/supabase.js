import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export const supabase = {
  from: (...args) => getSupabase().from(...args),
  auth: {
    getSession: (...args) => getSupabase().auth.getSession(...args),
    signInWithOtp: (...args) => getSupabase().auth.signInWithOtp(...args),
  },
};
 

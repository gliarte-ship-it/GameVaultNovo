import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Clean keys
const supabaseUrl = rawUrl.trim()
  .replace(/^["']|["']$/g, '')
  .replace(/^NEXT_PUBLIC_SUPABASE_URL=/, '');
const supabaseAnonKey = rawKey.trim()
  .replace(/^["']|["']$/g, '')
  .replace(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=/, '');

// Singleton instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder') || supabaseUrl.length < 10) {
    if (typeof window !== 'undefined') {
      console.warn('Supabase credentials missing or invalid. Auth and database features will be disabled.');
    }
    return null;
  }
  
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return supabaseInstance;
};

// For backward compatibility and ease of use, we export the instance directly.
// In a real application, you should handle the potential null value.
export const supabase = getSupabase() as NonNullable<ReturnType<typeof createClient>>;

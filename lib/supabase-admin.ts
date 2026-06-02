import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Initialize Supabase Admin client for secure server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

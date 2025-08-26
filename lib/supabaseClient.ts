import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
	if (browserClient) {
		return browserClient;
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
	}

	browserClient = createClient(supabaseUrl, supabaseAnonKey, {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true,
	});

	return browserClient;
}

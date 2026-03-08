
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabaseUrl = "https://REPLACE_WITH_YOUR_PROJECT.supabase.co";
export const supabaseAnonKey = "YOUR_ANON_KEY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabaseUrl = "https://sijpqgxdspmbhmsaenic.supabase.co";
// Das ist der öffentliche Key, das ist okay so.
export const supabaseAnonKey = "sb_publishable_1xULWSXyGkieZbTEwthCIA_CeoC_0SG";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
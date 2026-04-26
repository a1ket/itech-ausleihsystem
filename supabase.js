import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
export const supabaseUrl = "https://sijpqgxdspmbhmsaenic.supabase.co";
export const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpanBxZ3hkc3BtYmhtc2FlbmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDYyOTksImV4cCI6MjA4ODcyMjI5OX0.OEYWcKLkUUu9GQmttTRFDvoSzqf7GAOJIlQjoL6hJA4";
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
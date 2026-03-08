/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Menggunakan kredensial yang Anda berikan
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wutzrnvnvwigbfxlmlve.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dHpybnZudndpZ2JmeGxtbHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDY1OTEsImV4cCI6MjA4ODAyMjU5MX0.Zu04SFPfowvU9NOzOljUgw7SoYZuke5JJlvMY_T5UCE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

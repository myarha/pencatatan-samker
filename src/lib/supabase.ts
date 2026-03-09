/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Menggunakan kredensial yang Anda berikan
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = (envUrl && envUrl !== 'YOUR_SUPABASE_URL' && envUrl.startsWith('http')) 
  ? envUrl 
  : 'https://wutzrnvnvwigbfxlmlve.supabase.co';
  
const supabaseAnonKey = (envKey && envKey !== 'YOUR_SUPABASE_ANON_KEY') 
  ? envKey 
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dHpybnZudndpZ2JmeGxtbHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDY1OTEsImV4cCI6MjA4ODAyMjU5MX0.Zu04SFPfowvU9NOzOljUgw7SoYZuke5JJlvMY_T5UCE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

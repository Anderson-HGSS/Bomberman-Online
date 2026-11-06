const SUPABASE_URL = "https://adcblpccjrwbzmsipyiy.supabase.co" ;
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JgVTOLsz9ERpqIXd0xLjWA_c6Dl1AS0";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

console.log("Cliente Supabase inicializado!");

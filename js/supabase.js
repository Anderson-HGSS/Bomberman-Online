const SUPABASE_URL = "https://adcblpccjrwbzmsipyiy.supabase.co" ;
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JgVTOLsz9ERpqIXd0xLjWA_c6Dl1AS0";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function garantirUsuarioAnonimo(){
    //Verifica se já existe uma sessão
    const { data: sessionData, error:sessionError } = await supabaseClient.auth.getSession();

    if(sessionError){
        throw sessionError;
    }

    if(sessionData.session){
        return sessionData.session.user;
    }

    const {data, error} = await supabaseClient.auth.signInAnonymously();

    if(error){
        throw error;
    }

    return data.user;
}

console.log("Cliente Supabase inicializado!");

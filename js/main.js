//Main
const campoNome = document.getElementById("nickname");
const campoCodigo = document.getElementById("codigoSala");

const btnCriar = document.getElementById("criarSala");
const btnEntrar = document.getElementById("entrarSala");

const mensagemCriar = document.getElementById("mensagemCriar");
const mensagemEntrar = document.getElementById("mensagemEntrar");
const codigoGerado = document.getElementById("codigoGerado");

const digitosCodigo = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"]

const areaLobby = document.getElementById("lobby");

const codigoLobby = document.getElementById("codigoLobby");
const statusLobby = document.getElementById("statusLobby");

const contadorJogadores = document.getElementById("contadorJogadores");
const listaJogadores = document.getElementById("listaJogadores");

//canal de comunicação da sala
let canalSala = null;

let salaAtualId = null;
let jogadorAtualId = null;
let souAnfitriao = false;

function exibirMensagem(msg, elemento){
    elemento.textContent = msg;
}

function gerarCodigoSala(){
    let codigo = "";

    for(let i=0; i < 5; i++){
        let indiceCaractere = Math.floor(Math.random() * digitosCodigo.length);
        codigo += digitosCodigo[indiceCaractere];
    }

    return codigo;
}

btnCriar.addEventListener("click", async function () {
    const nickname = campoNome.value.trim();
    if(nickname === ""){
        exibirMensagem("Insira um nome antes de criar uma sala!", mensagemCriar);
        return;
    }

    btnCriar.disabled = true;

    codigoGerado.textContent = "";

    exibirMensagem("Criando sala...", mensagemCriar);

    try{
        const codigo = gerarCodigoSala();

        const {data, error} = await supabaseClient.rpc(
            "criar_sala",
            {
                p_codigo: codigo,
                p_criador_nome: nickname,
                p_max_jogadores: 4
            }
        );

        if(error){
            throw error;
        }

        const sala = data?.[0];

        if(!sala){
            throw new Error("Nenhum dado de sala foi retornado.");
        }

        salaAtualId = sala.atual_id;

        //Aqui é feita a conexão ao lobby como anfitrião
        souAnfitriao = true;
        await conectarAoLobby(sala.codigo, nickname);

        exibirMensagem("Sala Criada com sucesso! Compartilhe esse código com seus amigos:", mensagemCriar);
        codigoGerado.textContent = sala.codigo;

        console.log("Sala criada:", sala);
    } catch(error){
        console.error("Erro ao criar a sala:", error);

        exibirMensagem("não foi possível criar a sala. Verifique o console.", mensagemCriar);
    } finally{
        btnCriar.disabled = false;
    }

});

btnEntrar.addEventListener("click", async function(){
    let nickname = campoNome.value.trim();
    let codigo = campoCodigo.value.toUpperCase().replaceAll(" ", "");

    if(nickname === ""){
        exibirMensagem("Digite seu nome antes de entrar em uma sala!", mensagemEntrar);
    }
    else if(codigo === ""){
        exibirMensagem("Digite o código da sala para entrar!", mensagemEntrar);
    }
    else if(codigo.length !== 5){
        exibirMensagem("O código deve conter 5 caracteres!", mensagemEntrar);
    }

    btnEntrar.disabled = true;

    exibirMensagem("Procurando sala...", mensagemEntrar);

    try{
        const {data, error} = await supabaseClient.rpc(
            "entrar_sala",
            {
                p_codigo: codigo,
                p_nickname: nickname
            }
        );

        if(error){
            throw(error);
        }

        
        const jogador = data?.[0];

        if(!jogador){
            throw new Error("Nenhum jogador foi retornado.");
        }

        salaAtualId = jogador.sala_id;
        jogadorAtualId = jogador.jogador_id;
        souAnfitriao = jogador.is_host;
    
        await conectarAoLobby();

        exibirMensagem(`Você entrou na sala ${jogador.codigo} com sucesso!`, mensagemEntrar);

        console.log("Jogador concetado a sala:", jogador)

    } catch(error){
        console.error("Erro ao entrar na sala:", error);

        const errosConhecidos = [
            "Código de sala inválido!",
            "Nickname inválido!",
            "Sala não encontrada!",
            "Esta sala não está aceitando jogadores!",
            "Esta sala está cheia!",
            "Este nickname já está sendo utilizado nesta sala!"
        ];

        const erroConhecido = errosConhecidos.find(
            msg => error.message?.includes(msg)
        );

        exibirMensagem(erroConhecido || "Não foi possível entrar na sala. Verifique o console.", mensagemEntrar);
    } finally{
        btnEntrar.disabled = false;
    }    
});

function atualizarListaJogadores(){
    //presenceState retorna os dados dos clientes conectados no canal
    const estado = canalSala.presenceState();
    //A função flat transforma uma lista de listas emu
    const jogadores = Object.values(estado).flat();

    listaJogadores.replaceChildren();

    contadorJogadores.textContent = jogadores.length;

    jogadores.forEach(function(jogador){
        const item = document.createElement("li");

        let identificacao = jogador.is_host? " (Anfitrião)": "";

        item.textContent = jogador.nickname + identificacao;

        listaJogadores.appendChild(item);
    });
}

async function conectarAoLobby(codigo, nickname) {
    
    //Caso já esteja conectado ao um canal, aqui a gente remove este canal para poder colocar o novo
    if(canalSala){
        await supabaseClient.removeChannel(canalSala);
        canalSala = null;
    }

    canalSala = supabaseClient.channel(
        `sala:${salaAtualId}`,
        {config: {private: false}}
    );

    canalSala.on(
        "presence", {event: "sync"},
        function(){
            atualizarListaJogadores();
        }
    );

    return new Promise(function(resolve, reject){
        let processando = false;

        canalSala.subscribe(async function(status) {
            if(status === "SUBSCRIBED" && !processando){
                processando = true;

                try{
                    //Informa que o jogador está online
                    const resultado = await canalSala.track({
                        nickname: nickname,
                        is_host: souAnfitriao
                    });

                    if(resultado !== "ok"){
                        throw new Error("Não foi possível registrar a presença.");
                    }

                    //Mostra o lobby
                    codigoLobby.textContent = codigo;
                    statusLobby.textContent = "Aguardando outros jogadores...";

                    areaLobby.hidden = false;

                    atualizarListaJogadores();

                    resolve();
                }catch(error){
                    reject(error);
                }
            }

            else if(status === "CHANNEL_ERROR" || status === "TIMED_OUT" && !processando){
                processando = true;

                reject(new Error("Falha ao conectar ao canal da sala: " + status));
            }
        })
    })
}
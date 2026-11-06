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

const btnIniciar = document.getElementById("iniciarPartida");

//canal de comunicação da sala
let canalSala = null;

let temporizadorAnfitriao = null;

const TEMPO_TOLERANCIA_ANFITRIAO = 30000;

let encerrandoSalaLocalmente = false;

let salaAtualId = null;
let jogadorAtualId = null;
let souAnfitriao = false;

function exibirMensagem(msg, elemento) {
    elemento.textContent = msg;
}

function gerarCodigoSala() {
    let codigo = "";

    for (let i = 0; i < 5; i++) {
        let indiceCaractere = Math.floor(Math.random() * digitosCodigo.length);
        codigo += digitosCodigo[indiceCaractere];
    }

    return codigo;
}

btnCriar.addEventListener("click", async function () {
    const nickname = campoNome.value.trim();
    if (nickname === "") {
        exibirMensagem("Insira um nome antes de criar uma sala!", mensagemCriar);
        return;
    }

    btnCriar.disabled = true;

    codigoGerado.textContent = "";

    exibirMensagem("Criando sala...", mensagemCriar);

    try {
        const codigo = gerarCodigoSala();

        const usuario = await garantirUsuarioAnonimo();
        console.log("Identidade do jogador:", usuario.id);

        const { data, error } = await supabaseClient.rpc(
            "criar_sala",
            {
                p_codigo: codigo,
                p_criador_nome: nickname,
                p_max_jogadores: 4
            }
        );

        if (error) {
            throw error;
        }

        const sala = data?.[0];

        if (!sala) {
            throw new Error("Nenhum dado de sala foi retornado.");
        }

        salaAtualId = sala.sala_id;

        //Aqui é feita a conexão ao lobby como anfitrião
        souAnfitriao = true;
        await conectarAoLobby(sala.codigo, nickname, true);

        exibirMensagem("Sala Criada com sucesso! Compartilhe esse código com seus amigos:", mensagemCriar);
        codigoGerado.textContent = sala.codigo;

        console.log("Sala criada:", sala);
    } catch (error) {
        console.error("Erro ao criar a sala:", error);

        exibirMensagem("não foi possível criar a sala. Verifique o console.", mensagemCriar);
    } finally {
        btnCriar.disabled = false;
    }

});

btnEntrar.addEventListener("click", async function () {
    let nickname = campoNome.value.trim();
    let codigo = campoCodigo.value.toUpperCase().replaceAll(" ", "");

    if (nickname === "") {
        exibirMensagem("Digite seu nome antes de entrar em uma sala!", mensagemEntrar);
        return;
    }
    else if (codigo === "") {
        exibirMensagem("Digite o código da sala para entrar!", mensagemEntrar);
        return;
    }
    else if (codigo.length !== 5) {
        exibirMensagem("O código deve conter 5 caracteres!", mensagemEntrar);
        return;
    }

    btnEntrar.disabled = true;

    exibirMensagem("Procurando sala...", mensagemEntrar);

    try {

        const usuario = await garantirUsuarioAnonimo();
        console.log("Identidade do jogador:", usuario.id);

        const { data, error } = await supabaseClient.rpc(
            "entrar_sala",
            {
                p_codigo: codigo,
                p_nickname: nickname
            }
        );

        if (error) {
            throw (error);
        }


        const jogador = data?.[0];

        if (!jogador) {
            throw new Error("Nenhum jogador foi retornado.");
        }

        salaAtualId = jogador.sala_id;
        jogadorAtualId = jogador.jogador_id;
        const isHost = jogador.is_host === true;

        souAnfitriao = isHost;

        console.log("Dados recebidos do Supabase:", jogador);
        console.log("É anfitrião?", isHost);

        await conectarAoLobby(jogador.codigo, nickname, isHost);

        exibirMensagem(`Você entrou na sala ${jogador.codigo} com sucesso!`, mensagemEntrar);

        console.log("Jogador concetado a sala:", jogador)

    } catch (error) {
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
    } finally {
        btnEntrar.disabled = false;
    }
});

async function sairDoLobbyPorAusenciaDoAnfitriao() {
    if(encerrandoSalaLocalmente){
        return;
    }

    encerrandoSalaLocalmente = true;

    if(temporizadorAnfitriao !== null){
        clearTimeout(temporizadorAnfitriao);
        temporizadorAnfitriao = null;
    }

    statusLobby.textContent = "O anfitrião saiu. Você será desconectado da sala.";

    const canalAnterior = canalSala;

    canalSala = null;

    try {
        if(canalAnterior){
            await supabaseClient.removeChannel(canalAnterior);
        }

    } catch(error){
        console.error("Erro ao sair do canal:", error);
    }

    listaJogadores.replaceChildren();

    contadorJogadores.textContent = "0";
    areaLobby.hidden = true;
    salaAtualId = null;
    jogadorAtualId = null;
    souAnfitriao = false;

    exibirMensagem("O anfitrião saiu da sala. Você foi desconectado.", mensagemEntrar);

    console.log("Jogador desconectado do lobby.");
    encerrandoSalaLocalmente = false;

}

function verificaAnfitriaoOnline(jogadores){
    
    if(souAnfitriao || encerrandoSalaLocalmente){
        return;
    }

    //Verifica se existe um anfitrião conectado na sala
    const anfitriaoOnline = jogadores.some(jogador => jogador.is_host === true);

    if(anfitriaoOnline){
        if(temporizadorAnfitriao !== null){
            clearTimeout(temporizadorAnfitriao);

            temporizadorAnfitriao = null;

            console.log("Anfitrião reconectado!");
        }

        return;
    }

    if(temporizadorAnfitriao !== null){
        return;
    }

    statusLobby.textContent = "Anfitrião desconectado! Aguardando reconexão...";

    console.log("Anfitrião desconectado. Iniciando contagem...");

    temporizadorAnfitriao = setTimeout(async function(){
        temporizadorAnfitriao = null;

        if(!canalSala){
            return;
        }

        const estadoAtual = canalSala.presenceState();
        const jogadoresAtuais = Object.values(estadoAtual).flat();
        const anfitriaoVoltou = jogadoresAtuais.some(jogador => jogador.is_host === true);

        if(!anfitriaoVoltou){
            console.log("Tempo esgotado! Encerrando lobby.");

            await sairDoLobbyPorAusenciaDoAnfitriao();
        }
    }, TEMPO_TOLERANCIA_ANFITRIAO);
}

function atualizarListaJogadores() {
    //presenceState retorna os dados dos clientes conectados no canal
    const estado = canalSala.presenceState();
    //A função flat transforma uma lista de listas emu
    const jogadores = Object.values(estado).flat();
    verificaAnfitriaoOnline(jogadores);

    listaJogadores.replaceChildren();

    contadorJogadores.textContent = jogadores.length;
    btnIniciar.disabled = jogadores.length < 2;

    const anfitriaoOnline = souAnfitriao || jogadores.some(jogador => jogador.is_host === true);
    if(!anfitriaoOnline){
        statusLobby.textContent = "Anfitrião desconectado. Aguardando reconexão...";
    }
    else if (jogadores.length < 2) {
        statusLobby.textContent = "Aguardando pelo menos 2 jogadores...";
    } else {
        statusLobby.textContent = "Jogadores conectados! A partida pode começar.";
    }

    jogadores.forEach(function (jogador) {
        const item = document.createElement("li");

        let identificacao = jogador.is_host ? " (Anfitrião)" : "";

        item.textContent = jogador.nickname + identificacao;

        listaJogadores.appendChild(item);
    });
}

async function conectarAoLobby(codigo, nickname, isHost) {

    //Caso já esteja conectado ao um canal, aqui a gente remove este canal para poder colocar o novo
    if (canalSala) {
        await supabaseClient.removeChannel(canalSala);
        canalSala = null;
    }

    canalSala = supabaseClient.channel(
        `sala:${salaAtualId}`,
        { config: { private: false } }
    );

    canalSala.on(
        "presence", { event: "sync" },
        function () {
            atualizarListaJogadores();
        }
    );

    return new Promise(function (resolve, reject) {
        let processando = false;

        canalSala.subscribe(async function (status, err) {

            console.log("Status Realtime:", status);

            if (err) {
                console.error("Erro Realtime:", err);
            }

            if (status === "SUBSCRIBED" && !processando) {
                processando = true;

                try {

                    console.log("Registrando presença:");
                    console.log("Nickname:", nickname);
                    console.log("Código:", codigo);
                    console.log("ID da sala:", salaAtualId);
                    console.log("É anfitrião?", isHost);

                    //Informa que o jogador está online
                    const resultado = await canalSala.track({
                        nickname: nickname,
                        is_host: isHost
                    });

                    if (resultado !== "ok") {
                        throw new Error("Não foi possível registrar a presença.");
                    }

                    //Mostra o lobby
                    codigoLobby.textContent = codigo;
                    statusLobby.textContent = "Aguardando outros jogadores...";

                    areaLobby.hidden = false;
                    btnIniciar.hidden = !isHost;

                    atualizarListaJogadores();

                    resolve();
                } catch (error) {
                    reject(error);
                }
            }

            else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !processando) {
                processando = true;

                reject(new Error("Falha ao conectar ao canal da sala: " + status));
            }
        })
    })
}


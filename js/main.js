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

//Heartbeat para controle das salas sem ninguém
let intervaloHeartbeat = null;
let hearbeatEmAndamento = false;
const INTERVALO_HEARTBEAT = 10000;

let usuarioAtualId = null;
let jogadorLocal = null;
let jogadoresRemotos = [];
let jogadoresConectados = [];

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
        usuarioAtualId = usuario.id;

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
        await conectarAoLobby(sala.codigo, nickname, true, sala.spawn_slot);

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
        usuarioAtualId = usuario.id;

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

        await conectarAoLobby(jogador.codigo, nickname, isHost, jogador.spawn_slot);

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
    if (encerrandoSalaLocalmente || !salaAtualId) {
        return;
    }

    encerrandoSalaLocalmente = true;

    if (temporizadorAnfitriao !== null) {
        clearTimeout(temporizadorAnfitriao);
        temporizadorAnfitriao = null;
    }

    const salaIdParaEncerrar = salaAtualId;

    statusLobby.textContent = "Confirmando encerramento da sala...";

    try {
        const { data, error } = await supabaseClient.rpc(
            "encerrar_sala_abandonada", { p_sala_id: salaIdParaEncerrar }
        );

        if (error) {
            if (error.message?.includes("O anfitrião ainda está ativo!")) {
                statusLobby.textContent = "Verificando novamente a conexão do anfitrião...";

                temporizadorAnfitriao = setTimeout(async function () {
                    temporizadorAnfitriao = null;

                    if (!canalSala) {
                        return;
                    }

                    const estado = canalSala.presenceState();
                    const jogadores = Object.values(estado).flat();

                    const anfitriaoOnline = jogadores.some(jogador => jogador.is_host === true);

                    if (anfitriaoOnline) {
                        atualizarListaJogadores();
                    } else {
                        await sairDoLobbyPorAusenciaDoAnfitriao();
                    }
                }, 5000);

                return;
            }
            throw error;
        }

        console.log("Sala encerrada no supabase:", data);

        pararHeartbeatAnfitriao();

        const canalAnterior = canalSala;
        canalSala = null;

        if (canalAnterior) {
            try {
                await supabaseClient.removeChannel(canalAnterior);
            } catch (error) {
                console.error("Erro ao remover o canal:", error);
            }
        }

        listaJogadores.replaceChildren();

        contadorJogadores.textContent = "0";

        areaLobby.hidden = true;

        salaAtualId = null;
        jogadorAtualId = null;
        souAnfitriao = false;

        exibirMensagem("O anfitrião saiu. A sala foi encerrada e você foi desconectado.", mensagemEntrar);

        console.log("Participante removido do lobby.");

    } catch (error) {
        console.log("Erro ao encerrar a sala:", error);

        statusLobby.textContent = "Não foi possível confirmar o encerramento da sala.";

        exibirMensagem("Erro ao encerrar a sala. Verifique o console.", mensagemEntrar);
    } finally {
        encerrandoSalaLocalmente = false;
    }
}

function verificaAnfitriaoOnline(jogadores) {

    if (souAnfitriao || encerrandoSalaLocalmente) {
        return;
    }

    //Verifica se existe um anfitrião conectado na sala
    const anfitriaoOnline = jogadores.some(jogador => jogador.is_host === true);

    if (anfitriaoOnline) {
        if (temporizadorAnfitriao !== null) {
            clearTimeout(temporizadorAnfitriao);

            temporizadorAnfitriao = null;

            console.log("Anfitrião reconectado!");
        }

        return;
    }

    if (temporizadorAnfitriao !== null) {
        return;
    }

    statusLobby.textContent = "Anfitrião desconectado! Aguardando reconexão...";

    console.log("Anfitrião desconectado. Iniciando contagem...");

    temporizadorAnfitriao = setTimeout(async function () {
        temporizadorAnfitriao = null;

        if (!canalSala) {
            return;
        }

        const estadoAtual = canalSala.presenceState();
        const jogadoresAtuais = Object.values(estadoAtual).flat();
        const anfitriaoVoltou = jogadoresAtuais.some(jogador => jogador.is_host === true);

        if (!anfitriaoVoltou) {
            console.log("Tempo esgotado! Encerrando lobby.");

            await sairDoLobbyPorAusenciaDoAnfitriao();
        }
    }, TEMPO_TOLERANCIA_ANFITRIAO);
}

async function encerrarSalaComoAnfitriao(){
    if(!souAnfitriao || !salaAtualId){
        return;
    }

    const salaIdParaEncerrar = salaAtualId;

    try {
        const {data, error} = await supabaseClient.rpc(
            "encerrar_sala_anfitriao", {p_sala_id: salaIdParaEncerrar}
        );

        if(error){
            throw error;
        }

        const status = await canalSala.send({
            type: "broadcast",
            event: "sala_encerrada",
            payload: {
                sala_id: salaIdParaEncerrar
            }
        });

        if(status !== "ok"){
            console.warn("Não foi possível notificar todos os jogadores:", status);
        }

        await limparLobbyLocal("você encerrou a sala.");

        console.log("Sala encerrada pelo anfitrião.")

    }catch(error){
        console.log("Erro ao encerrar a sala:", error)
    }
}

function atualizarListaJogadores() {
    //presenceState retorna os dados dos clientes conectados no canal
    const estado = canalSala.presenceState();

    //A função flat transforma uma lista de listas em uma só
    const jogadores = Object.values(estado).flat();

    identificarJogadores(jogadores);

    console.log("Jogador local:", jogadorLocal);
    console.log("Jogadores remotos:", jogadoresRemotos);


    verificaAnfitriaoOnline(jogadores);

    listaJogadores.replaceChildren();

    contadorJogadores.textContent = jogadores.length;
    btnIniciar.disabled = jogadores.length < 2;

    const anfitriaoOnline = souAnfitriao || jogadores.some(jogador => jogador.is_host === true);
    if (!anfitriaoOnline) {
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

async function limparLobbyLocal(mensagem) {
    //interrompe temporizadores
    if (temporizadorAnfitriao !== null){
        clearTimeout(temporizadorAnfitriao);
        temporizadorAnfitriao = null;
    }

    pararHeartbeatAnfitriao();

    //remove o canal realtime
    const canalAnterior = canalSala;
    canalSala = null;

    if(canalAnterior){
        await supabaseClient.removeChannel(canalAnterior);
    }

    //Sessão de limpeza
    listaJogadores.replaceChildren();
    contadorJogadores.textContent = "0";
    areaLobby.hidden = true;

    salaAtualId = null;
    jogadorAtualId = null;
    souAnfitriao = false;

    jogadoresConectados = [];
    jogadoresRemotos = [];
    jogadorLocal = null;

    exibirMensagem(mensagem, mensagemEntrar);

    console.log("Lobby local encerrado.")
}

async function conectarAoLobby(codigo, nickname, isHost, spawnSlot) {

    pararHeartbeatAnfitriao();

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

        canalSala.on(
            "broadcast",
            {event: "sala_encerrada"},
            async () => {
                console.log("O anfitrião encerrou a sala.");

                await limparLobbyLocal("O anfitrião encerrou a sala, você foi desconectado.");
            }
        );

        canalSala.on(
            "broadcast",
            {event: "movimento"},
            ({payload}) => {
                const jogador = jogadoresConectados.find(jogador => jogador.id === payload.auth_user_id);

                if(!jogador || jogador.isLocal){
                    return;
                }

                if(!Number.isFinite(payload.x) || !Number.isFinite(payload.y)){
                    return;
                }

                jogador.alvoX = payload.x;
                jogador.alvoY = payload.y;
            }
        );

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
                        auth_user_id: usuarioAtualId,
                        nickname: nickname,
                        is_host: isHost,
                        spawn_slot: spawnSlot
                    });

                    if (resultado !== "ok") {
                        throw new Error("Não foi possível registrar a presença.");
                    }

                    if (isHost) {
                        souAnfitriao = true;
                        iniciarHeartbeatAnfitriao();
                    } else {
                        souAnfitriao = false;
                        pararHeartbeatAnfitriao();
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

async function enviarHeartbeatAnfitriao(salaId) {
    // impede que duas solicitações sejam executadas ao mesmo tempo
    if (hearbeatEmAndamento) {
        return;
    }

    hearbeatEmAndamento = true;

    try {
        const { data, error } = await supabaseClient.rpc(
            "registrar_heartbeat_anfitriao", { p_sala_id: salaId }
        );

        if (error) {
            throw error;
        }

        console.log("Heartbeat registrado.", data);
    } catch (error) {
        console.log("Erro ao registrar heartbeat:", error);
    } finally {
        hearbeatEmAndamento = false;
    }
}

function pararHeartbeatAnfitriao() {
    if (intervaloHeartbeat !== null) {
        clearInterval(intervaloHeartbeat);
        intervaloHeartbeat = null;
    }
}

function iniciarHeartbeatAnfitriao() {
    pararHeartbeatAnfitriao();

    const salaIdMonitorada = salaAtualId;

    if (!salaIdMonitorada || !souAnfitriao) {
        return;
    }

    enviarHeartbeatAnfitriao(salaIdMonitorada);

    intervaloHeartbeat = setInterval(function () {
        if (salaAtualId !== salaIdMonitorada || !souAnfitriao) {
            pararHeartbeatAnfitriao();
            return;
        }
        enviarHeartbeatAnfitriao(salaIdMonitorada);
    }, INTERVALO_HEARTBEAT);
}

function identificarJogadores() {
    const estado = canalSala.presenceState();
    const presencas = Object.values(estado).flat();

    const dadosjogadores = presencas.map(presenca => ({
        id: presenca.auth_user_id,
        nickname: presenca.nickname,
        is_host: presenca.is_host,
        isLocal: presenca.auth_user_id === usuarioAtualId,
        spawn_slot: presenca.spawn_slot
    }));

    const personagensAnteriores = new Map(jogadoresConectados.map(jogador => [jogador.id, jogador]));

    jogadoresConectados = dadosjogadores.map(dados => {
        const existente = personagensAnteriores.get(dados.id);

        if(existente){
            existente.nickname = dados.nickname;
            existente.is_host = dados.is_host;
            existente.isLocal = dados.isLocal;
            existente.spawn_slot = dados.spawn_slot;

            return existente;
        }

        return criaPersonagem(dados);
    }).filter(jogador => jogador !== null);

    jogadorLocal = jogadoresConectados.find(jogador => jogador.isLocal) || null;

    jogadoresRemotos = jogadoresConectados.filter(jogador => !jogador.isLocal);

    console.log(jogadoresConectados);
}

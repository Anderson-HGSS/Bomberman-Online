const canvasJogo = document.getElementById("canvasJogo");
const contexto = canvasJogo.getContext("2d");

const COLUNAS = 13;
const LINHAS = 11;

const TAMANHO_CELULA = 48;

//O intervalo entre os payloads enviados para o supabase através do broadcats será de 50 milisegundos
let ultimoBroadcast = 0;
const INTERVALO_BROADCAST = 50; //em milisegundos

const mapa1 = Array.from(Array(LINHAS), (_, i) => Array.from(Array(COLUNAS), (_, j) => {
    const ehPar = (i % 2 === 0 && j % 2 === 0);
    const ehBorda = (i === 0 || i === LINHAS - 1 || j === 0 || j === COLUNAS - 1);

    if (ehBorda || ehPar) {
        return 1;
    }
    return 0;

}));

const mapas = [mapa1];

function sorteiaMapa(mapas) {
    const indiceSorteado = Math.floor(Math.random() * mapas.length);

    const mapaSorteado = mapas[indiceSorteado].map(
        linha => [...linha]
    );

    return mapaSorteado;
}

function desenharMapa(mapa) {

    contexto.clearRect(0, 0, canvasJogo.width, canvasJogo.height);

    for (let linha = 0; linha < LINHAS; linha++) {
        for (let coluna = 0; coluna < COLUNAS; coluna++) {

            const tipo = mapa[linha][coluna];

            const x = coluna * TAMANHO_CELULA;
            const y = linha * TAMANHO_CELULA;


            switch (tipo) {
                case 0: //piso
                    contexto.fillStyle = "#2c2c2a";
                    contexto.strokeStyle = "#101010";
                    break;

                case 1: //parede indestrutivel
                    contexto.fillStyle = "#a7a39a";
                    contexto.strokeStyle = "#6B6963";
                    break;

                case 2: //bloco destrutivel
                    contexto.fillStyle = "#8b7f6e";
                    contexto.strokeStyle = "#4A4239";
                    break;
            }

            contexto.fillRect(x, y, TAMANHO_CELULA, TAMANHO_CELULA);
            contexto.strokeRect(x, y, TAMANHO_CELULA, TAMANHO_CELULA);
        }
    }

    return mapa;
}

function adicionarBlocosDestrutiveis(mapaSorteado) {

    for (let linha = 0; linha < LINHAS; linha++) {
        for (let coluna = 0; coluna < COLUNAS; coluna++) {

            const probabilidadeDestrutivel = Math.random();

            const ehCanto = ((linha === 1 && coluna === 1) || (linha === 2 && coluna === 1) || (linha === 1 && coluna === 2) ||
                (linha === 1 && coluna === COLUNAS - 2) || (linha === 2 && coluna === COLUNAS - 2) || (linha === 1 && coluna === COLUNAS - 3) ||
                (linha === LINHAS - 2 && coluna === 1) || (linha === LINHAS - 2 && coluna === 2) || (linha === LINHAS - 3 && coluna === 1) ||
                (linha === LINHAS - 2 && coluna === COLUNAS - 2) || (linha === LINHAS - 2 && coluna === COLUNAS - 3) || (linha === LINHAS - 3 && coluna === COLUNAS - 2));

            const ehCaixaInicial = ((linha === 1 && coluna === 3) || (linha === 1 && coluna === COLUNAS - 4) ||
                (linha === 3 && coluna === 1) || (linha === 3 && coluna === COLUNAS - 2) ||
                (linha === LINHAS - 4 && coluna === 1) || (linha === LINHAS - 2 && coluna === 3) ||
                (linha === LINHAS - 4 && coluna === COLUNAS - 2) || (linha === LINHAS - 2 && coluna === COLUNAS - 4))

            if (mapaSorteado[linha][coluna] === 0 && !ehCanto && probabilidadeDestrutivel < 0.45) {

                mapaSorteado[linha][coluna] = 2;
            }

            if (mapaSorteado[linha][coluna] === 0 && ehCaixaInicial) {

                mapaSorteado[linha][coluna] = 2;
            }
        }
    }
}

const cores = {
    amarelo: "#CCFF00",
    azul: "#00F5FF",
    verde: "#00E676",
    roxo: "#BD00FF",
}

const POSICOES_SPAWN = [
    { linha: 1, coluna: 1 },
    { linha: 1, coluna: COLUNAS - 2 },
    { linha: LINHAS - 2, coluna: 1 },
    { linha: LINHAS - 2, coluna: COLUNAS - 2 }
];

const CORES_SPAWN = [
    cores.amarelo,
    cores.azul,
    cores.verde,
    cores.roxo
];

function criaPersonagem(jogador) {
    const slot = Number(jogador.spawn_slot);

    if(!Number.isInteger(slot) || slot < 0 || slot >= POSICOES_SPAWN.length){
        console.error("Spawn inválido:", jogador);
        return null;
    }

    const posicao = POSICOES_SPAWN[slot];

    const x = (posicao.coluna * TAMANHO_CELULA) + TAMANHO_CELULA / 2;
    const y = (posicao.linha * TAMANHO_CELULA) + TAMANHO_CELULA / 2;

    return {
        id: jogador.id,
        nickname: jogador.nickname,
        x: x,
        y: y,
        alvoX: x,
        alvoY: y,
        velocidade: 300, // em pixels por segundo
        vivo: true,
        cor: CORES_SPAWN[slot],
        is_host: jogador.is_host,
        isLocal: jogador.isLocal,
        spawn_slot: slot
    }
}

function desenharJogadores(jogadores) {

    jogadores.forEach((jogador) => {

        contexto.beginPath();

        //Aqui é desenhado o jogador
        contexto.arc(jogador.x, jogador.y, 20, 0, Math.PI * 2);

        contexto.fillStyle = jogador.cor;

        contexto.shadowColor = jogador.cor;
        contexto.shadowBlur = 50;

        contexto.fill();

        contexto.shadowBlur = 0;
    });
}

const mapaSorteado = sorteiaMapa(mapas);
adicionarBlocosDestrutiveis(mapaSorteado);

const teclas = {
    KeyS: false,
    KeyW: false,
    KeyA: false,
    KeyD: false,
}

document.addEventListener("keydown", (event) => {
    if (event.code === 'KeyS' || event.code === 'ArrowDown') {
        teclas.KeyS = true;
        // event.preventDefault();
    }
    if (event.code === 'KeyW' || event.code === 'ArrowUp') {
        teclas.KeyW = true;
        // event.preventDefault();
    }
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        teclas.KeyA = true;
        // event.preventDefault();
    }
    if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        teclas.KeyD = true;
        // event.preventDefault();
    }
});

document.addEventListener("keyup", (event) => {
    if (event.code === 'KeyS' || event.code === 'ArrowDown') {
        teclas.KeyS = false;
    }
    if (event.code === 'KeyW' || event.code === 'ArrowUp') {
        teclas.KeyW = false;
    }
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        teclas.KeyA = false;
    }
    if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        teclas.KeyD = false;
    }
});

let ultimoTimestamp = 0;

function atualizarMapa(timestampAtual) {

    if (!ultimoTimestamp) {
        ultimoTimestamp = timestampAtual;
    }

    const deltaTime = Math.min((timestampAtual - ultimoTimestamp) / 1000, 0.05);

    ultimoTimestamp = timestampAtual;

    if(jogadorLocal && jogadorLocal.vivo){

        let direcaoX = Number(teclas.KeyD) - Number(teclas.KeyA);
        let direcaoY = Number(teclas.KeyS) - Number(teclas.KeyW);
    
        const comprimentoVetor = Math.sqrt(Math.pow(direcaoX, 2) + Math.pow(direcaoY, 2));
    
        if (comprimentoVetor > 0) {
            direcaoX = direcaoX / comprimentoVetor;
            direcaoY = direcaoY / comprimentoVetor;
        }
    
        const proximoX = jogadorLocal.x + (jogadorLocal.velocidade * direcaoX * deltaTime);
        const proximoY = jogadorLocal.y + (jogadorLocal.velocidade * direcaoY * deltaTime);
    
        //verifica colisão horizontal
        if (!verificarColisao(proximoX, jogadorLocal.y, mapaSorteado)) {
            jogadorLocal.x = proximoX;
        }
    
        //verifica colisão veritical
        if (!verificarColisao(jogadorLocal.x, proximoY, mapaSorteado)) {
            jogadorLocal.y = proximoY;
        }


        //Aqui é enviado o payload para o supabase através do broadcast
        if(comprimentoVetor > 0 && timestampAtual - ultimoBroadcast >= INTERVALO_BROADCAST && canalSala){
            ultimoBroadcast = timestampAtual;

            canalSala.send({
                type: "broadcast",
                event: "movimento",
                payload: {
                    auth_user_id: usuarioAtualId,
                    x: jogadorLocal.x,
                    y: jogadorLocal.y
                }
            }).then(status => {
                if(status !== "ok"){
                    console.warn("Falha ao transmitir evento:", status);
                }
            });
        }
    }

    const intensidadeInterpolacao = 14;

    const alpha = 1 - Math.exp(-intensidadeInterpolacao * deltaTime);

    for (const jogador of jogadoresRemotos){
        jogador.x += (jogador.alvoX - jogador.x) * alpha;
        jogador.y += (jogador.alvoY - jogador.y) * alpha;
    }

    contexto.clearRect(0, 0, canvasJogo.width, canvasJogo.height);
    desenharMapa(mapaSorteado);
    desenharJogadores(jogadoresConectados);

    requestAnimationFrame(atualizarMapa);
}

function verificarColisao(x, y, mapa) {
    const yMin = y - 20;
    const yMax = y + 20;
    const xMin = x - 20;
    const xMax = x + 20;

    const colunaInicial = Math.floor(xMin / TAMANHO_CELULA);
    const colunaFinal = Math.floor(xMax / TAMANHO_CELULA);

    const linhaInicial = Math.floor(yMin / TAMANHO_CELULA);
    const linhaFinal = Math.floor(yMax / TAMANHO_CELULA);

    const totalLinhas = mapa.length;
    const totalColunas = mapa[0].length;

    const dentroDoLimite = linhaInicial >= 0 && colunaInicial >= 0 && linhaFinal < totalLinhas && colunaFinal < totalColunas;

    if (!dentroDoLimite) {
        return true;
    }

    //Colisão superior
    if (mapa[linhaInicial][colunaInicial] !== 0 || mapa[linhaInicial][colunaFinal] !== 0) {
        return true;
    }

    //Colisão esquerda
    if (mapa[linhaInicial][colunaInicial] !== 0 || mapa[linhaFinal][colunaInicial] !== 0) {
        return true;
    }

    //Colisão inferior
    if (mapa[linhaFinal][colunaInicial] !== 0 || mapa[linhaFinal][colunaFinal] !== 0) {
        return true;
    }

    //Colisão direita
    if (mapa[linhaFinal][colunaFinal] !== 0 || mapa[linhaInicial][colunaFinal] !== 0) {
        return true;
    }

    return false;

}

desenharMapa(mapaSorteado);
desenharJogadores(jogadoresConectados);
requestAnimationFrame(atualizarMapa);
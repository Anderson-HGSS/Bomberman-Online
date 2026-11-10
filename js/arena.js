const canvasJogo = document.getElementById("canvasJogo");
const contexto = canvasJogo.getContext("2d");

const COLUNAS = 13;
const LINHAS = 11;

const TAMANHO_CELULA = 48;

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

const valoresCores = Object.values(cores);
const corSoretada = valoresCores[Math.floor(Math.random() * valoresCores.length)]

const posicoesPossiveisParaSpawn = [[1, 1], [COLUNAS - 2, 1], [1, LINHAS - 2], [COLUNAS - 2, LINHAS - 2]];
const posicaoSorteada = posicoesPossiveisParaSpawn[Math.floor(Math.random() * posicoesPossiveisParaSpawn.length)];

const jogador = {
    id: 12,
    nickname: "Anderson",
    x: (posicaoSorteada[0] * TAMANHO_CELULA) + (TAMANHO_CELULA / 2),
    y: (posicaoSorteada[1] * TAMANHO_CELULA) + (TAMANHO_CELULA / 2),
    velocidade: 5,
    vivo: true,
    cor: corSoretada
}

function desenharJogador(jogador) {

    contexto.beginPath();
    contexto.arc(jogador.x, jogador.y, 20, 0, Math.PI * 2);
    contexto.fillStyle = jogador.cor;

    switch (jogador.cor) {
        case "#CCFF00":
            contexto.shadowColor = cores.amarelo;
            break;
        case "#00F5FF":
            contexto.shadowColor = cores.azul;
            break;
        case "#00E676":
            contexto.shadowColor = cores.verde;
            break;
        case "#BD00FF":
            contexto.shadowColor = cores.roxo;
            break;
    }

    contexto.shadowBlur = 50;
    contexto.fill();
    contexto.shadowBlur = 0;
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
        event.preventDefault();
    }
    if (event.code === 'KeyW' || event.code === 'ArrowUp') {
        teclas.KeyW = true;
        event.preventDefault();
    }
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        teclas.KeyA = true;
        event.preventDefault();
    }
    if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        teclas.KeyD = true;
        event.preventDefault();
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

function atualizarMapa() {
    if (teclas.KeyS) {
        jogador.y += jogador.velocidade;
    }

    if (teclas.KeyW) {
        jogador.y -= jogador.velocidade;
    }

    if (teclas.KeyA) {
        jogador.x -= jogador.velocidade;
    }

    if (teclas.KeyD) {
        jogador.x += jogador.velocidade;
    }

    contexto.clearRect(0, 0, canvasJogo.width, canvasJogo.height);
    desenharMapa(mapaSorteado);
    desenharJogador(jogador);
    requestAnimationFrame(atualizarMapa);
}

desenharMapa(mapaSorteado);
desenharJogador(jogador);

requestAnimationFrame(atualizarMapa)
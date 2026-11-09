const canvasJogo = document.getElementById("canvasJogo");
const contexto = canvasJogo.getContext("2d");

const COLUNAS = 13;
const LINHAS = 11;

const TAMANHO_CELULA = 48;

const mapa1 = Array.from(Array(LINHAS), (_, i) => Array.from(Array(COLUNAS), (_, j) => {
    const ehPar = (i % 2 === 0 && j % 2 === 0);
    const ehBorda = (i === 0 || i === LINHAS - 1 || j === 0 || j === COLUNAS - 1);

    if(ehBorda || ehPar){
        return 1;
    }
    return 0;

}));

const mapas = [mapa1];

function desenharMapa(){

    const indiceSorteado = Math.floor(Math.random() * mapas.length);

    const mapaSorteado = mapas[indiceSorteado].map(
        linha => [...linha]
    );

    for(let linha = 0; linha < LINHAS; linha++){
        for(let coluna = 0; coluna < COLUNAS; coluna++){

            const tipo = mapaSorteado[linha][coluna];

            const x = coluna * TAMANHO_CELULA;
            const y = linha * TAMANHO_CELULA;

            if(tipo === 1){
                contexto.fillStyle = "#a7a39a";

                contexto.fillRect(x, y, TAMANHO_CELULA, TAMANHO_CELULA);
            }

            contexto.strokeStyle = "#8b7f6e";
            contexto.strokeRect(x, y, TAMANHO_CELULA, TAMANHO_CELULA);
        }
    }

    return mapaSorteado;
}

function desenharBlocosDestrutiveis(mapaSorteado){

    for(let linha = 0; linha < LINHAS; linha++){
        for(let coluna = 0; coluna < COLUNAS; coluna++){

            const probabilidadeDestrutivel = Math.random();

            const ehCanto = ((linha === 1 && coluna === 1) || (linha === 2 && coluna === 1) || (linha === 1 && coluna === 2) ||
                             (linha === 1 && coluna === COLUNAS - 2) || (linha === 2 && coluna === COLUNAS - 2) || (linha === 1 && coluna === COLUNAS - 3) ||
                             (linha === LINHAS - 2 && coluna === 1) || (linha === LINHAS - 2 && coluna === 2) || (linha === LINHAS - 3 && coluna === 1)||
                             (linha === LINHAS - 2 && coluna === COLUNAS - 2) || (linha === LINHAS - 2 && coluna === COLUNAS - 3) || (linha === LINHAS - 3 && coluna === COLUNAS - 2));

            if(mapaSorteado[linha][coluna] === 0 && !ehCanto && probabilidadeDestrutivel < 0.65){
            
                contexto.fillStyle = "#8b7f6e"
                
                const x = coluna * TAMANHO_CELULA;
                const y = linha * TAMANHO_CELULA;
                
                contexto.fillRect(x, y, TAMANHO_CELULA, TAMANHO_CELULA)

                mapaSorteado[linha][coluna] = 2;
            
            }
        }
    }
}

const mapaSorteado = desenharMapa();
desenharBlocosDestrutiveis(mapaSorteado);
console.table(mapaSorteado);
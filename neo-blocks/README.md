# Neo Blocks — protótipo jogável

Jogo arcade 2D inspirado no gênero de encaixe de blocos. Projeto original, executado 100% no navegador, sem dependências, login ou servidor.

**Jogar:** https://alusionbr.github.io/teste1/neo-blocks/

## Controles
- **Celular:** botões na interface para esquerda, direita, girar, acelerar queda, soltar e HOLD (reservar).
- **Computador:** setas para mover/girar; Espaço para queda instantânea; C ou Shift para reservar; P para pausar; X para ativar poder no Laboratório.
- **Som:** botão no cabeçalho, desligado inicialmente.
- Ao trocar de modo, a partida atual é reiniciada; a melhor pontuação de cada modo é guardada no navegador via localStorage.

## Modos implementados
1. **Clássico:** 7-bag, nível aumenta a cada dez linhas.
2. **Contra o Tempo:** pontuação máxima em 120 segundos.
3. **Turbo:** queda acelera a cada 20 segundos.
4. **Sobrevivência:** linha de obstáculos sobe a cada 25 segundos.
5. **Puzzle:** tente apagar as quatro linhas pré-montadas em até oito peças.
6. **Laboratório:** linhas eliminadas recarregam um poder que remove uma linha ocupada do fundo; ativação por botão ou tecla X.
7. **Gravidade Caótica:** três velocidades de queda alternadas a cada quinze segundos. **Nesta versão a direção da gravidade não muda**, apenas sua velocidade.
8. **Zen:** tabuleiro reinicia automaticamente ao atingir o topo, permitindo jogar sem derrota.

## Pontuação
1/2/3/4 linhas: 100/300/500/800 × nível; +50 × nível × combo por limpezas consecutivas; queda suave +1 célula, queda instantânea +2 células. O protótipo utiliza giros com pequenos ajustes de posição, **não** implementa SRS completo ou regras oficiais de torneio.

## Arquivos
- index.html: estrutura e controles da interface;
- style.css: visual neon responsivo;
- game.js: regras, renderização canvas, teclado, toque e armazenamento local.

O jogo não utiliza recursos de rede nem bibliotecas externas. Publicado como pasta isolada para não modificar outros aplicativos do monorepo. Se a página ainda não estiver disponível, verifique o término da implantação automática do GitHub Pages.

## Próximos passos
- Mais efeitos e artes de partículas, temas e skins;
- Som e música originais;
- Suporte a acessibilidade e controles configuráveis;
- Modo versus local/online (não implementado);
- Power-ups balanceados e campanhas de puzzles.

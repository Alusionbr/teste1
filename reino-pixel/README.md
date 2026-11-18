# Reino Pixel — Vale de Arvandor

Protótipo jogável de RPG 2D com estética de pixel art medieval, construído para navegador.

## Jogar

- **Online:** https://alusionbr.github.io/teste1/reino-pixel/
- **Localmente:** abra `index.html` diretamente no navegador. Não precisa de servidor nem de internet.

## Funcionalidades

- Mapa explorável com vilarejo, floresta, rio, ponte e ruínas.
- Personagem controlável por teclado, botões na tela ou clique/toque no terreno.
- Obstáculos e colisões.
- NPC Eldric e missão de três cristais.
- Editor de mapa, desfazer e exportar dados em JSON.
- Iluminação dia/noite.

## Implementação

O jogo está em um único arquivo **`index.html`**, com CSS, JavaScript e imagens PNG embutidas em Base64. Assim, funciona como página estática no GitHub Pages, sem dependências e sem referências externas.

O protótipo ainda não possui backend, conta de usuário ou multiplayer. Mudanças no mapa precisam ser exportadas para não depender apenas do estado da sessão.

## Próximas melhorias

Separar os tilesets, personagens e dados do mapa em arquivos individuais; criar interiores, inventário, monstros e múltiplos mapas conectados.

**Projeto:** parte do repositório de ferramentas e jogos [teste1](https://github.com/Alusionbr/teste1).

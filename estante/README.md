# Estante — letras e cifras no palco

Leitor de letras e cifras feito para tocar: repertórios salvos no aparelho, busca em várias fontes, rolagem automática, sincronia com letras temporizadas, transposição, capotraste e anotações por música.

Faz parte do [conjunto de ferramentas](../README.md) deste repositório.

## No palco

| Recurso | Como funciona |
|---|---|
| **Busca inteligente** | Consulta LRCLIB, Vagalume e o catálogo da Apple em paralelo, junta versões repetidas e ordena por relevância. Os outros modos priorizam uma fonte só (Brasil, Sincro) ou procuram por um trecho da letra. |
| **Repertórios** | Vários repertórios, um por show. Criar, renomear, duplicar, apagar e trocar pela barra da aba Repertório. Mostra quantas músicas e a duração estimada. |
| **Ajustes por música** | Tom, capotraste, velocidade de rolagem e anotações ficam salvos em cada música do repertório. O tamanho da letra é global. |
| **Rolar / Sincro** | Rolagem contínua com velocidade ajustável; em letras `.lrc` a sincronia acompanha o relógio e você pode tocar numa linha para reposicionar. |
| **Modo palco** | Fundo escuro de alto contraste e tela sempre acesa (wake lock). |
| **Imprimir** | Ordem do show em papel ou PDF, só a lista ou com as letras (uma música por página). |
| **Compartilhar** | Gera um link com a ordem do repertório; quem recebe escolhe juntar ao repertório aberto ou criar um novo. |
| **Offline** | Depois da primeira abertura o app funciona sem internet e pode ser instalado no celular. A busca precisa de rede; o repertório salvo, não. |

### Atalhos de teclado

Funcionam também com pedaleiras Bluetooth que enviam essas teclas.

| Tecla | Ação |
|---|---|
| Espaço | rola / pausa (com Shift, liga a sincronia) |
| ← → | música anterior / próxima |
| ↑ ↓ | velocidade de rolagem |
| Page Up / Page Down | rola meia tela |
| P | modo palco |
| F | tela cheia |
| Esc | para tudo |

## Arquivos

```txt
index.html         estrutura da tela e diálogos
styles.css         visual, modo palco e folha de impressão
core.js            estado, armazenamento, versão do app e fontes de letra
search-engine.js   busca inteligente: várias fontes, variações e ranqueamento
library.js         lista, ordenação do repertório, LRC, cifras e transposição
setlists.js        vários repertórios: criar, trocar, migrar e persistir
song-prefs.js      tom, capotraste, velocidade e anotações por música
player.js          abrir música, desenhar a letra, rolagem, sincronia e arquivos
print.js           impressão da ordem do show
ui.js              eventos da interface, atalhos e compartilhamento
search-ui.js       formulário de busca e modos de fonte
offline.js         registra o service worker e avisa de versão nova
sw.js              cache do app para funcionar offline
```

## Dados guardados no navegador

| Chave | Conteúdo |
|---|---|
| `estante:v3:setlists` | `{version:3, activeId, setlists:[{id, name, date, songs}]}` |
| `estante:v2:prefs` | fonte de busca, velocidade padrão, tamanho da letra, modo palco e chave do Vagalume |
| `estante:v2:setlist` | formato antigo (um repertório só); migrado automaticamente e mantido como backup |

Campos de cada música:

```js
{ title, artist, album, duration, lyrics, synced, instrumental, source, vagUrl,
  key,    // transposição em semitons
  capo,   // casa do capotraste (só muda a exibição das cifras)
  speed,  // velocidade de rolagem desta música
  notes } // anotação de palco
```

Cifras exibidas = `transposeLine(linha, key - capo)`.

## Ao alterar o código

1. Atualize `APP_VERSION` em `core.js` **e** `VERSION` em `sw.js`, e o `?v=` dos `<script>`/`<link>` em `index.html`. Sem isso o service worker continua servindo a versão antiga.
2. Se acrescentar um arquivo, inclua-o na lista `SHELL` de `sw.js`.
3. Sirva por HTTP para testar (`python3 -m http.server`): service worker não funciona em `file://`.
4. Rode o roteiro de `checklist-manual.md`.

## Fontes de letra

Letras e cifras pertencem aos autores e editoras. O app apenas exibe o que as fontes públicas devolvem e mostra o crédito da fonte no rodapé de cada música. A chave da API do Vagalume, quando cadastrada, fica somente no aparelho.

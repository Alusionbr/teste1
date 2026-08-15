# Estante — letras e cifras no palco

Leitor de letras e cifras feito para tocar: repertórios salvos no aparelho, busca em várias fontes, rolagem automática, sincronia com letras temporizadas, transposição, capotraste e anotações por música.

Faz parte do [conjunto de ferramentas](../README.md) deste repositório.

## No palco

| Recurso | Como funciona |
|---|---|
| **Busca inteligente** | Consulta LRCLIB, Vagalume, Deezer, Apple e MusicBrainz em paralelo, junta versões repetidas e ordena por relevância. É o modo mais resistente: continua achando música mesmo com uma fonte fora do ar. Os outros modos priorizam uma fonte só (Brasil e Trecho dependem só do Vagalume; Sincro prioriza o LRCLIB). |
| **Fonte fora do ar** | Erro passageiro (502/503/504) do Vagalume é repetido uma vez sozinho. Se continuar fora do ar, o chip **Brasil**/**Trecho** ganha um sinal vermelho e a busca oferece um atalho de um toque para tentar de novo na Inteligente. |
| **Busca no aparelho** | Toda busca procura antes no repertório salvo e no acervo do site — inclusive **dentro do texto da letra**. Responde na hora, funciona offline e é a única busca por trecho que não depende do Vagalume. O que já está no aparelho vem primeiro, com a sua letra e os seus ajustes. |
| **Acervo do site** | `acervo.json` guarda letras no próprio repositório, para o que as fontes públicas não têm (autoral, regional, tradicional). Entra na busca e no cache offline. Vem vazio — ver [`acervo.md`](acervo.md). |
| **Reserva de letra** | Faixa achada só no catálogo (Apple/Deezer) não abre mais vazia: o app tenta o acervo do site e depois a `lyrics.ovh`, que não pede chave. |
| **Repertórios** | Vários repertórios, um por show. Criar, renomear, duplicar, apagar e trocar pela barra da aba Repertório. Mostra quantas músicas e a duração estimada. |
| **Ajustes por música** | Tom, capotraste, velocidade de rolagem e anotações ficam salvos em cada música do repertório. O tamanho da letra é global. |
| **Rolar / Sincro** | Rolagem contínua com velocidade ajustável; em letras `.lrc` a sincronia acompanha o relógio. Encostar na letra **pausa**; para começar de outro ponto, **toque duas vezes** na linha. |
| **Velocidade automática** | O botão **auto** calcula a velocidade pela duração da música, para a letra terminar junto com ela. Recalcula sozinho ao mudar o tamanho da letra ou girar a tela; mexer no −/+ volta ao manual. Se a versão não tiver duração, o app pergunta. |
| **Editar letra** | Corrige verso errado, apaga lixo da fonte e guarda o arranjo da banda, sem perder tom, capotraste, velocidade nem anotações. |
| **Atalhos de seção** | `[Refrão]`, `[Solo]` e `[Final]` escritos na letra viram botões acima do texto: um toque e a letra rola até lá. Funciona também em letra sincronizada, e com a rolagem ligada o salto é imediato — com a sincronia, o relógio vai junto. |
| **Modo palco** | Fundo escuro de alto contraste e tela sempre acesa (wake lock). |
| **Imprimir** | Ordem do show em papel ou PDF, só a lista ou com as letras (uma música por página). |
| **Compartilhar** | Gera um link com o repertório. **Com as letras** (padrão) o show inteiro abre no aparelho de quem recebeu, sem internet; **só a ordem** faz um link curto que exige buscar cada letra. O app mostra o tamanho dos dois antes e avisa quando o link fica longo demais para colar. Quem recebe escolhe juntar ao repertório aberto ou criar um novo. |
| **Offline** | Depois da primeira abertura o app funciona sem internet e pode ser instalado no celular. A busca precisa de rede; o repertório salvo, não. |
| **Karaokê** | Modo à parte, para festa: vídeo do YouTube atrás da letra, som saindo por Bluetooth. Cole o link do vídeo em ⚙, calibre o atraso da caixa uma vez e ajuste a introdução por música. Sem `.lrc` a letra rola pela posição do vídeo; com `.lrc`, destaca a linha certa. Ver detalhes abaixo. |

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

Dentro do **karaokê** as mesmas teclas mudam de sentido — ver a seção abaixo.

## Karaokê

Modo separado dos outros três (Rolar, Sincro, Palco) — não dá para ligar dois
ao mesmo tempo, os pedais ficam apagados enquanto ele está ativo. Pensado para
festa: caixa de som Bluetooth (com microfone Bluetooth ligado nela, não no
celular — ver aviso abaixo), projetor espelhando a tela.

### Como ligar

1. Abra a música e toque no pedal **⚙** ao lado de Karaokê.
2. Cole o link do vídeo (aceita link comum, `youtu.be`, `/embed/`, YouTube
   Music, ou só o id de 11 caracteres) e confirme em **Usar este vídeo**. Sem
   chave de API nesta versão: o botão **Procurar no YouTube ↗** abre a busca
   pronta numa aba nova, para copiar o link de lá.
3. Toque no pedal **Karaokê**. Se o navegador recusar tocar sozinho (comum no
   iPhone na primeira vez), toque diretamente no vídeo — depois disso o app
   consegue trocar de música sozinho pelo resto da sessão.

O vídeo fica salvo na música, junto com tom e capo — monte o repertório uma
vez, com internet, e na festa é só tocar.

### Os dois ajustes

| Ajuste | Vale para | Corrige |
|---|---|---|
| Sincronia desta música | só a música aberta | a introdução do vídeo do YouTube, que quase nunca bate com a gravação que o `.lrc` mede |
| Atraso da caixa Bluetooth | o aparelho inteiro | o atraso de 100–300ms comum em caixas Bluetooth — calibre uma vez ouvindo, vale para toda música depois |

### Letra sem sincronia (a maioria)

Poucas músicas têm `.lrc`. Sem ele, a letra **rola pela posição do vídeo** —
fração já tocada, não velocidade — em vez de destacar linha. Adiantar, atrasar
ou pausar o vídeo reposiciona a letra na hora, como um scrubber; não acumula
erro do jeito que uma rolagem por velocidade acumularia.

### O que muda com o karaokê ligado

- **Teclas**: Espaço/Enter tocam e pausam o vídeo; ↑↓ ajustam a sincronia
  desta música em vez da velocidade; Esc pausa uma vez, sai do modo na
  segunda; ←→ continuam trocando de música.
- **Anúncio**: o app percebe pela duração diferente e congela a letra até a
  música voltar — sem isso a letra correria durante o comercial.
- **Fim da música**: só avança sozinha para a próxima depois que o navegador
  já provou que deixa tocar por programa nesta sessão (normal em Android;
  no iPhone geralmente pede um toque a cada mudança de página, não a cada
  música). Sem isso, mostra "toque em › para a próxima" em vez de travar.
- **Offline**: precisa de internet enquanto está ligado. Sem rede, o pedal
  avisa e sugere continuar no Rolar/Sincro normal.

### Aviso de Bluetooth

Um telefone só mantém **uma** saída de áudio Bluetooth por vez. Se o
microfone parear direto no celular, o app costuma forçar tudo — inclusive a
música — para o canal de voz (baixa qualidade). Pareie o microfone **na
caixa de som**, e o celular só com a caixa.

### Por que um `<iframe>` não quebra a regra de nada externo

O vídeo é um documento à parte, com o JavaScript dele rodando no contexto
dele — nenhum script de terceiro entra nesta página, o service worker ignora
tudo que é de outra origem e o casco do app continua cacheado e abrindo sem
internet. O que fica fora dos limites é carregar o `iframe_api`
do próprio YouTube: aí sim seria script externo dentro do app. O protocolo é
falado na mão — conferido no código-fonte público do `www-widgetapi.js` do
Google — nunca com `targetOrigin:"*"`.

### Fica de fora desta versão

Busca de vídeo **dentro do app** com chave da API do YouTube (existe API
gratuita, 100 buscas/dia, mesmo modelo de chave-só-no-aparelho do Vagalume) —
colar link e o atalho de busca externa já cobrem o essencial sem exigir
cadastro no Google. Fica anotado para uma versão futura.

## Arquivos

```txt
index.html         estrutura da tela e diálogos
styles.css         visual, modo palco e folha de impressão
core.js            estado, armazenamento, versão do app e fontes de letra
search-engine.js   busca inteligente: várias fontes, variações, ranqueamento e busca no repertório
acervo.js          acervo do site: letras que moram no repositório
acervo.json        conteúdo do acervo (vem vazio; ver acervo.md)
library.js         lista, ordenação do repertório, LRC, cifras, transposição e seções
setlists.js        vários repertórios: criar, trocar, migrar e persistir
song-prefs.js      tom, capotraste, velocidade e anotações por música
autoscroll.js      velocidade de rolagem calculada pela duração
player.js          abrir música, desenhar a letra, rolagem, sincronia e arquivos
karaoke.js         modo karaokê: iframe do YouTube, protocolo, relógio extrapolado
song-edit.js       editar a letra de uma música já aberta
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
| `estante:v2:prefs` | fonte de busca, velocidade padrão, tamanho da letra, modo palco, chave do Vagalume, chave do YouTube e atraso da caixa Bluetooth |
| `estante:v2:setlist` | formato antigo (um repertório só); migrado automaticamente e mantido como backup |

Campos de cada música:

```js
{ title, artist, album, duration, lyrics, synced, instrumental, source, vagUrl,
  key,    // transposição em semitons
  capo,   // casa do capotraste (só muda a exibição das cifras)
  speed,  // velocidade de rolagem desta música
  auto,   // true = velocidade calculada pela duração, ignorando speed
  notes,  // anotação de palco
  videoId,      // id do vídeo do YouTube usado no karaokê desta música
  videoOffset } // segundos: posição no VÍDEO onde a letra começa (introdução)
```

Cifras exibidas = `transposeLine(linha, key - capo)`.

Letra sincronizada passa pelo mesmo `classify()` da letra comum: `.lrc` também
tem cifra, transposição, capotraste e atalhos de seção. O `parseLRC` remove só
as marcas de tempo e os cabeçalhos do formato (`[ar:]`, `[ti:]`, `[offset:]`) —
apagar tudo entre colchetes levava junto o `[Refrão]` escrito na letra.

Velocidade automática = `(fim da última linha − altura da tela) / (duration − 4s de entrada)`.

A distância é medida até a **última linha real**, não até o `scrollHeight`: o
papel tem 55vh de preenchimento embaixo e os créditos dentro do mesmo viewport.
Contar esse vazio deixava a velocidade 21% rápida demais e a letra terminava bem
antes da música. A rolagem também para nesse ponto — depois da última linha só
há espaço em branco, e continuar subindo esconderia justamente o verso final.

No karaokê o relógio não é o `performance.now()` do app: é o tempo do vídeo,
extrapolado entre as entregas do player (chegam a cada ~250ms, não a cada
quadro) com o mesmo teto de 1s que o próprio YouTube usa para o seu
`getCurrentTime`.

```txt
tempoDaLetra = tempoDoVídeoExtrapolado − videoOffset − audioDelay
```

Os dois se subtraem porque os dois atrasam a letra em relação ao vídeo cru:
`videoOffset` porque o vídeo começa antes da letra (introdução do upload),
`audioDelay` porque o som que sai da caixa Bluetooth chega depois do que o
vídeo mostra. Sem `.lrc`, esse `tempoDaLetra` vira posição de rolagem —
`scrollTop = ((tempoDaLetra − 4s) / (duração − 4s)) × distância` — em vez de
destacar linha; é fração tocada, não velocidade, então não acumula erro: um
salto no vídeo reposiciona a letra na hora.

## Compartilhamento

O link carrega o repertório inteiro no `#` da URL. Duas marcas:

| Marca | Conteúdo |
|---|---|
| `#setlistz=` | JSON compactado com `deflate-raw` (`CompressionStream`, do próprio navegador — não é biblioteca) |
| `#setlist=` | JSON sem compactar, para navegador sem `CompressionStream` |

O formato `v:2` leva `lyrics`, `synced`, `instrumental`, `source` e `notes` além
de título, artista, álbum, duração, tom e capotraste. A opção "só a ordem" omite
letra e anotações, mas **mantém tom e capotraste**: são dois números e a banda
precisa deles. Links `v:1` (versões anteriores, sem letra) continuam abrindo.

## Gravação

Ajuste que se repete (tom, capotraste, velocidade) **não** grava a cada clique: a
escrita é adiada em `saveSoon()` (`core.js`) e fechada por `flushSaves()` ao sair
da página. Gravar serializa todos os repertórios com letra e tudo — fazer isso a
cada toque travava a rolagem no meio da música. O que não pode se perder
(adicionar, remover, mover, trocar de repertório, editar letra) continua gravando
na hora.

## Ao alterar o código

1. Atualize `APP_VERSION` em `core.js` **e** `VERSION` em `sw.js`, e o `?v=` dos `<script>`/`<link>` em `index.html`. Sem isso o service worker continua servindo a versão antiga.
2. Se acrescentar um arquivo, inclua-o na lista `SHELL` de `sw.js`.
3. Sirva por HTTP para testar (`python3 -m http.server`): service worker não funciona em `file://`.
4. Rode o roteiro de `checklist-manual.md`.

## Fontes

Todas gratuitas e sem cadastro, exceto onde indicado. Nenhuma biblioteca externa: as que não liberam CORS para o navegador são consultadas por JSONP.

| Fonte | Traz | Chave | Como é chamada |
|---|---|---|---|
| **LRCLIB** | letra e **letra sincronizada** (`.lrc`) | não | `fetch` (CORS aberto) |
| **Vagalume** | letra e busca **por trecho** | opcional, só para abrir a letra | `fetch`, com repetição em erro passageiro |
| **Acervo do site** | letra própria, offline | não | arquivo local |
| **lyrics.ovh** | letra simples, como reserva | não | `fetch` (CORS aberto) |
| **Deezer** | catálogo: título, artista, duração | não | JSONP |
| **Apple (iTunes)** | catálogo: título, artista, duração | não | JSONP |
| **MusicBrainz** | catálogo: **álbum e duração exatos** | não | `fetch` (CORS aberto), 1 consulta por busca |

Deezer, Apple e MusicBrainz **não têm letra**. Entram para identificar a faixa: com o álbum e a duração certos, o LRCLIB casa no `/api/get` e a lyrics.ovh acerta a grafia do artista. Ajudam menos a "achar mais" e mais a achar a letra **certa**.

Busca **por trecho da letra** só existe no Vagalume. LRCLIB, Deezer, Apple e MusicBrainz comparam título, artista e álbum — nunca o texto. Quando o Vagalume está fora do ar, a busca por trecho fica limitada ao repertório salvo e ao acervo, que guardam a letra inteira. Testei ChartLyrics (fora do ar), Musixmatch e Genius (sem CORS, exigem chave) — nenhuma serve para uso direto no navegador.

Letras e cifras pertencem aos autores e editoras. O app apenas exibe o que as fontes públicas devolvem e mostra o crédito da fonte no rodapé de cada música. A chave da API do Vagalume, quando cadastrada, fica somente no aparelho.

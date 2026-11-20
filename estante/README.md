# Estante — letras e cifras no palco

## Aparência (versão 4.2.1)

Em **Aparência**, escolha **Palco Premium** (escuro e imersivo), **Biblioteca Clean** (claro e organizado) ou **Híbrido inteligente** (biblioteca clara e palco escuro). Os temas anteriores continuam disponíveis em **Ver temas clássicos**. O Híbrido inteligente é o tema inicial. Uma migração única atualiza temas antigos para esse padrão; após isso, a escolha do usuário sempre prevalece. A preferência é salva no aparelho, sem alterar músicas ou repertórios. No celular, **Mais** revela as ações adicionais do cabeçalho e **Ajustes** revela os controles secundários da pedaleira.


Organizador de ensaios e repertórios feito para tocar: biblioteca de arranjos reutilizáveis, sessões de ensaio, repertórios salvos no aparelho, busca em várias fontes, rolagem automática, sincronia, transposição e anotações.

Faz parte do [conjunto de ferramentas](../README.md) deste repositório.

## No palco

| Recurso | Como funciona |
|---|---|
| **Busca inteligente** | Consulta LRCLIB, Vagalume, Deezer, Apple e MusicBrainz em paralelo, junta versões repetidas e ordena por relevância. É o modo mais resistente: continua achando música mesmo com uma fonte fora do ar. Se o Vagalume falhar no modo Brasil, o app passa automaticamente para essa busca. Trecho continua dependendo do Vagalume ou das letras salvas. |
| **Fonte fora do ar** | Erro passageiro (502/503/504) do Vagalume ou do LRCLIB é repetido uma vez sozinho. Se continuar fora do ar, o chip **Brasil**/**Trecho** ganha um sinal vermelho e a busca oferece um atalho de um toque para tentar de novo na Inteligente. A fonte que falhou é poupada por 20 s e depois volta a ser consultada sozinha, sem recarregar a página. |
| **Letra não abriu** | A tela "não achei a letra" tem **Tentar de novo** (repete a mesma música consultando todas as fontes), **Buscar outras versões** e **Colar minha letra**. Se alguma fonte estiver fora do ar, ela avisa que pode ser instabilidade passageira. Quando outro artista gravou uma música com o mesmo título, aparece **Letra de …** para usar a letra daquela versão com um toque — só se você confirmar, porque mesmo título nem sempre é a mesma música. |
| **Mesma música, outra versão** | Se a gravação aberta não tem letra, mas o mesmo artista tem a versão ao vivo (ou com participação) no LRCLIB, a letra dela abre sozinha. O rodapé diz de qual gravação veio. A sincronia só vem junto quando a duração é a mesma. |
| **Busca no aparelho** | Toda busca mostra primeiro a biblioteca local e depois incorpora o acervo e as fontes online. Pedidos antigos são descartados quando uma busca mais nova começa. Também procura **dentro do texto da letra** e funciona offline. |
| **Acervo do site** | `acervo.json` guarda letras no próprio repositório, para o que as fontes públicas não têm (autoral, regional, tradicional). Entra na busca e no cache offline. Vem vazio — ver [`acervo.md`](acervo.md). |
| **Reserva de letra** | Faixa achada só no catálogo (Apple/Deezer) tenta o acervo, o LiriQo e a `lyrics.ovh`. O LiriQo exige correspondência de título e artista; para o medley “Ouve-se o Júbilo / Leão da Tribo de Judá”, há uma versão de ensaio identificada quando a gravação exata não tem transcrição. |
| **Biblioteca e arranjos** | Uma música pode ter vários arranjos, com letra/cifra, tom, capo, velocidade, vídeo, notas e histórico próprios. A edição escolhe entre atualizar o arranjo reutilizado ou criar uma versão só para o repertório atual. |
| **Repertórios** | Criar, renomear, duplicar, arquivar, imprimir e mover para a lixeira. Músicas entram em lote pela Biblioteca; a ordem aceita arrastar e também botões ↑/↓. Pausas e trocas de instrumento podem fazer parte da ordem. |
| **Ensaio** | Cada música passa por **A aprender**, **Em ensaio** e **Pronta**. Iniciar/encerrar cria um histórico com data, estados e resumo da sessão. |
| **Prontidão offline** | O resumo mostra quantas músicas já têm letra/cifra ou são instrumentais. Assim a banda vê o que ainda depende da rede antes de sair para o ensaio ou show. |
| **Salvamento e recuperação** | O cabeçalho mostra Salvando/Salvo/Falha. Remoções têm Desfazer e ficam na Lixeira; o banco principal é IndexedDB, com cópia local de recuperação e proteção contra alterações em outra aba. |
| **Rolar / Sincro** | Rolagem contínua com velocidade ajustável; em letras `.lrc` a sincronia acompanha o relógio. Encostar na letra **pausa**; para começar de outro ponto, **toque duas vezes** na linha. |
| **Velocidade automática** | O botão **auto** calcula a velocidade pela duração da música, para a letra terminar junto com ela. Recalcula sozinho ao mudar o tamanho da letra ou girar a tela; mexer no −/+ volta ao manual. Se a versão não tiver duração, o app pergunta. |
| **Editar letra** | Corrige verso errado e salva uma revisão. O editor deixa claro se a mudança vale para todos os repertórios que usam o arranjo ou somente para a lista atual. |
| **Atalhos de seção** | `[Refrão]`, `[Solo]` e `[Final]` viram atalhos e aceitam anotações próprias. Funciona também em letra sincronizada. |
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

## Acompanhar

Na tela da música, **Acompanhar** abre um catálogo de batidas completas, faixas gravadas e trilhas criadas no aparelho. Quando há estilo informado no arranjo, nas etiquetas ou no catálogo da música, as sugestões aparecem acima de todas as bases. Os filtros ficam disponíveis para explorar outros estilos. O BPM vale quando é conhecido. O botão **Dados desta música para sugestões** salva ritmo e BPM escolhidos para o arranjo.

- **Ouvir uma base** permite ouvir uma prévia, tocar com a letra e salvar a base no arranjo. As batidas podem ser editadas em cópia. Faixas gravadas ficam offline depois de **Baixar offline**.
- **Usar meu playback** abre um MP3, WAV ou M4A de até 100 MB. Em uma letra com tempos, ative **Seguir o playback** e informe a posição onde a letra entra. Os áudios importados ficam no navegador. Ao abrir um backup em outro aparelho, selecione o arquivo novamente.
- **Criar uma trilha** monta introdução, base, variações e final a partir de estilo, duração e instrumentos. Em **Mais ajustes**, é possível mudar BPM, tom, passos e ordem dos trechos. Salve em **Minhas trilhas** para reutilizar em outros arranjos ou baixe o resultado em WAV mono. O backup JSON inclui os projetos editáveis. Os links de repertório com letra só incluem referências às bases públicas.

As bases do catálogo têm [créditos e licenças próprios](assets/acompanhamento/CREDITOS.md). A aba **Ensaio** mostra se a base pode ser tocada offline.

## Estatísticas de uso

Em **Ferramentas e configurações → Privacidade e uso**, a opção **Ajudar a melhorar o Estante** vem desligada. Quando a pessoa ativa, o app guarda uma fila local por até sete dias. Envia contagens diárias de faixas públicas usadas em ensaio, tentativas sem letra e ritmos do catálogo tocados. A fila usa IndexedDB para funcionar também sem rede. Ao desativar, o app descarta os contadores pendentes.

O relatório dos últimos 30 dias fica em `/estante/estatisticas/`. O acesso exige uma conta Supabase Auth com e-mail e senha cujo identificador conste em `public.estante_admins`, a mesma lista usada para os relatos de bugs. O painel consulta o nome oficial da faixa pelo ID público. Gravações de catálogos diferentes podem aparecer como itens separados.

Para publicar, use a pasta `estante/` como diretório do projeto Supabase. Confira o histórico de migrações no projeto que já recebe os relatos do Estante, revise a migração de estatísticas e publique a função `estante-usage` antes de publicar o front-end. A função aceita contadores sem login e guarda os totais em um esquema privado. Só administradores podem ler o relatório. A limpeza remove recibos de lotes com mais de oito dias e totais com mais de 180 dias quando novos lotes são recebidos.

Além dos testes do app, rode `node estante/tests/usage-browser.js` com o servidor local ativo na porta 8765. Para checar a migração com Postgres local, instale `@electric-sql/pglite` em uma pasta temporária e aponte `ESTANTE_PGLITE` para o módulo ao executar `node estante/tests/usage-db.js`.

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
domain.js          modelo v4, migração, arranjos, revisões, prontidão e sessões
storage.js         IndexedDB, cópia de recuperação, estado de gravação e multiaba
core.js            estado de execução, versão do app e fontes de letra
search-engine.js   busca inteligente: várias fontes, variações, ranqueamento e busca no repertório
acervo.js          acervo do site: letras que moram no repositório
acervo.json        conteúdo do acervo (vem vazio; ver acervo.md)
library.js         biblioteca, seleção em lote, lista, ordem, LRC, cifras e seções
setlists.js        repertórios, arranjos, lixeira, ensaios e persistência
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
| IndexedDB `estante/workspace/current` | workspace v4: biblioteca, repertórios, lixeira, sessões e revisão global |
| `estante:v4:workspace` | cópia de recuperação/compatibilidade do mesmo workspace |
| `estante:v2:prefs` | fonte de busca, velocidade padrão, tamanho da letra, modo palco, chave do Vagalume, chave do YouTube e atraso da caixa Bluetooth |
| `estante:v3:setlists` / `estante:v2:setlist` | formatos antigos, migrados automaticamente e mantidos como backup |

Campos de cada música:

```js
{ id, songId, arrangementId, arrangementName, revision, history,
  title, artist, album, duration, lyrics, synced, instrumental, source, vagUrl,
  key,    // transposição em semitons
  capo,   // casa do capotraste (só muda a exibição das cifras)
  speed,  // velocidade de rolagem desta música
  auto,   // true = velocidade calculada pela duração, ignorando speed
  notes, sectionNotes, status, tags,
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

O formato `v:4` leva IDs estáveis, nome e revisão do arranjo, estado de ensaio,
notas e conteúdo offline. A opção "só a ordem" omite letra/cifra, mas mantém os
ajustes necessários para a banda. Links `v:1` e `v:2` continuam abrindo.

## Gravação

Ajuste que se repete (tom, capotraste, velocidade) usa `saveSoon()`; ações
estruturais gravam na hora. A escrita entra numa fila para não inverter revisões,
vai ao IndexedDB e mantém uma cópia de recuperação. `BroadcastChannel` avisa
quando outra aba gravou uma revisão mais nova, evitando sobrescrita silenciosa.

## Ao alterar o código

1. Atualize `APP_VERSION` em `core.js` **e** `VERSION` em `sw.js`, e o `?v=` dos `<script>`/`<link>` em `index.html`. Sem isso o service worker continua servindo a versão antiga.
2. Se acrescentar um arquivo, inclua-o na lista `SHELL` de `sw.js`.
3. Sirva por HTTP para testar (`python3 -m http.server`): service worker não funciona em `file://`.
4. Rode o roteiro de `checklist-manual.md`.
5. Rode `node --test estante/tests/*.test.js` e, com um servidor local ativo,
   `node estante/tests/browser-smoke.js`.
   Rode também `node estante/tests/cache-upgrade.js`: o teste reproduz um cache legado, verifica a atualização automática e conserva a biblioteca offline.
   Para testar as fontes externas, use `ESTANTE_LIVE_LYRICS=1` no teste de navegador. O diagnóstico `node estante/scripts/check-sources.mjs` não imprime letras.

## Fontes

Todas gratuitas e sem cadastro, exceto onde indicado. Nenhuma biblioteca externa: as que não liberam CORS para o navegador são consultadas por JSONP.

| Fonte | Traz | Chave | Como é chamada |
|---|---|---|---|
| **LRCLIB** | letra e **letra sincronizada** (`.lrc`) | não | `fetch` (CORS aberto), com repetição em erro passageiro; se a busca livre falhar, procura pelo título |
| **Vagalume** | letra e busca **por trecho** | opcional, só para abrir a letra | `fetch`, com repetição em erro passageiro |
| **Acervo do site** | letra própria, offline | não | arquivo local |
| **LiriQo** | letra simples de outras fontes, com confirmação de título e artista | não | `fetch` (CORS aberto) |
| **lyrics.ovh** | letra simples, como reserva | não | `fetch` (CORS aberto) |
| **Deezer** | catálogo: título, artista, duração | não | JSONP |
| **Apple (iTunes)** | catálogo: título, artista, duração | não | JSONP |
| **MusicBrainz** | catálogo: **álbum e duração exatos** | não | `fetch` (CORS aberto), 1 consulta por busca |

Deezer, Apple e MusicBrainz **não têm letra**. Entram para identificar a faixa: com o álbum e a duração certos, o LRCLIB casa no `/api/get` e a lyrics.ovh acerta a grafia do artista. Ajudam menos a "achar mais" e mais a achar a letra **certa**.

Busca **por trecho da letra** só existe no Vagalume. LRCLIB, Deezer, Apple e MusicBrainz comparam título, artista e álbum — nunca o texto. Quando o Vagalume está fora do ar, a busca por trecho fica limitada ao repertório salvo e ao acervo, que guardam a letra inteira. Testei ChartLyrics (fora do ar), Musixmatch e Genius (sem CORS, exigem chave) — nenhuma serve para uso direto no navegador.

Letras e cifras pertencem aos autores e editoras. O app apenas exibe o que as fontes públicas devolvem e mostra o crédito da fonte no rodapé de cada música. A chave da API do Vagalume, quando cadastrada, fica somente no aparelho.

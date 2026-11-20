# Karaokê em Casa

Karaokê para a família, direto no navegador. Monte playlists, escolha o **playback** de cada música (YouTube, YouTube Music, Spotify ou um arquivo do aparelho) e cante com a **letra grande, sincronizada, enchendo na cor de quem está cantando**. Deixe a TV ou o projetor como **tela da festa** e controle tudo pelos celulares.

Publicado em: <https://alusionbr.github.io/teste1/karaoke/>

## Como usar

1. **Família** — cadastre quem vai cantar: nome, emoji e cor. A cor pinta a letra da pessoa no palco.
2. **Músicas → + Nova música** — busque pelo nome. Os resultados com **✓ sincronizada** já vêm com o tempo de cada verso. Depois escolha o playback:
   - **YouTube / YouTube Music**: cole o link (`youtube.com/watch?v=…`, `youtu.be/…` ou `music.youtube.com/watch?v=…`). Procure por “playback” ou “karaokê”, ou seja, vídeo só com a música, sem a voz. Com uma chave da API do YouTube em Ajustes, a busca acontece dentro do app e só mostra vídeos que podem tocar aqui.
   - **Spotify**: cole o link de uma faixa (`open.spotify.com/track/…`). Sem login no Spotify naquele navegador, toca só a prévia de 30 s, e o primeiro play é um toque no ▶ do próprio Spotify.
   - **Arquivo**: escolha um MP3/M4A do aparelho. Fica guardado só ali e toca **sem internet**. É a forma mais precisa.
3. **Playlist** — adicione as músicas. O app sugere o próximo cantor (rodízio: quem cantou menos vai primeiro). Marque **Dueto** para dois cantores.
4. **▶ Começar karaokê** — tela cheia com “Agora é a vez de…”, contagem, letra no estilo karaokê e, no fim, o **aplausômetro** (mede o barulho da plateia pelo microfone; não mede afinação e não grava nada).

### Usar como lista compartilhada de faixas (vídeo do YouTube com a letra)

Para a festa em que **a letra já vem no vídeo de karaokê do YouTube**: o app vira a lista compartilhada de faixas e a fila, e a tela mostra o vídeo.

1. **É o padrão**: o fundo “Só o vídeo do YouTube — a letra vem no próprio vídeo” já vem ligado (Ajustes → Palco → Fundo da letra). O vídeo ocupa a tela inteira; depois de 4 s sem mexer somem as barras e **só o player fica na tela**, com a sala funcionando por trás (celulares, fila, vez e aplausos continuam valendo).
2. **Ligar e desligar a letra sincronizada sem atrapalhar o vídeo**: botão **🎞 Só vídeo / 🔤 Letra** no palco, tecla **L** e botão no **celular da sala**. É só troca de camada: o player do YouTube não é recarregado nem muda de tamanho, então o som e o relógio seguem sem soluço. Ligada, a letra volta com o vídeo escurecido atrás (ou o último fundo que você usava). O botão 🎬 alterna entre os quatro fundos.
3. **Nada leva a TV para a página do YouTube**: o player não mostra controles, título nem logo e não aceita cliques (só o primeiro toque que o iPhone/iPad exige). Quem comanda é o app, o teclado e os celulares.
4. **Achar e adicionar o vídeo sem sair do app**: Músicas → + Nova música → campo “Buscar vídeo de karaokê ou colar o link” (veja “Buscar vídeos no YouTube” abaixo). No celular da sala: **✨ Música nova**, mesmo campo; o resultado tocado entra na fila da tela.
5. A família escolhe, troca o playback e manda tocar pelo celular (painel da música). A vez, o rodízio e o aplausômetro continuam valendo.

Músicas que não são do YouTube (Spotify, arquivo) continuam mostrando a letra do app mesmo nesse modo. Vídeo que o dono bloqueou fora do YouTube é recusado na hora, antes de entrar na lista.

### Buscar vídeos no YouTube

**No editor da música a busca é o caminho principal**: ao abrir uma música sem playback do YouTube (por exemplo logo depois de escolher a letra em Nova música), o app já busca `título artista playback karaokê` e lista os vídeos com miniatura, canal e duração. Os de duração parecida com a da letra (±8 s) vêm primeiro com o selo “✓ duração parecida”; tocar num confere se toca embutido e troca o playback. O campo de busca é editável. “Já tenho o link do vídeo” fica recolhido (e abre sozinho, com o atalho para o site do YouTube, se a busca cair). No celular, ✨ Música nova faz o mesmo depois de escolher a letra.

A busca funciona dentro do app, na tela e no celular, **sem chave**: o navegador não consegue consultar `youtube.com/results` (sem CORS), então a busca passa por serviços públicos Piped. O app consulta até 4 ao mesmo tempo e usa a primeira resposta válida; instância que falha fica poupada por 20 s. Com uma chave da API do YouTube em Ajustes, a busca usa a oficial (só vídeos que tocam embutidos, cerca de 100 buscas por dia) e, se a chave for recusada ou a cota acabar, cai para os serviços públicos.

- A busca ganha “karaokê playback” quando você não escreve karaokê/playback/instrumental (sem isso vêm os clipes oficiais, quase sempre bloqueados fora do YouTube).
- Resultado de serviço público **não garante** que o vídeo toca embutido: ao escolher, o app confere (`YouTubeBase.verificar`) e recusa vídeo bloqueado.
- **Se a busca parar de responder** (instância pública caiu): edite a lista `INSTANCIAS_BUSCA` em `busca-youtube.js` (a instância precisa devolver JSON com `access-control-allow-origin`; confira com `curl -D- "<base>/search?q=teste&filter=videos"`), ou use uma chave. O atalho “Procurar no YouTube” abre o site em outra aba e você cola o link.
- Privacidade: o texto buscado vai para o serviço público (ou para o Google, com chave). Nada mais é enviado.

### Cantar sozinho

Para treinar, cantar sem festa ou testar o app sem ninguém por perto — não precisa cadastrar a Família.

- **🎤 Cantar sozinho** (aba Playlist): toca a playlist na ordem, ignorando quem está marcado em cada item.
- **🎤** em cada música (aba Músicas): canta só aquela. O **▶** ao lado continua sendo o ensaio (só ouvir, sem nota).
- No palco aparece “🎤 Você”, uma contagem curta de até 3 s (nenhuma com “Sem contagem” nos Ajustes) e, no fim, os aplausos. Se o aplausômetro estiver ligado, a nota entra no **placar pessoal**: a tela diz “🏆 Primeira nota desta música!”, “🏆 Novo recorde!” ou “Seu recorde: N”. **↺ Cantar de novo** repete a música na hora.
- Músicas com nota ganham o selo **🏆 N** (a maior nota). **Ajustes → Apagar meu placar** zera tudo. O placar vai no backup.
- O controle remoto pelo celular funciona igual no modo solo (dá para testar a sala sozinho, com o celular na mão).

### No palco

| Ação | Botão | Teclado |
|---|---|---|
| Tocar / pausar | ▶ / ⏸ | espaço |
| Próxima / anterior | ⏭ / ⏮ | → / ← |
| Letra chegando tarde / cedo (só esta música) | Letra − / Letra + | `[` / `]` |
| Fundo da letra (só som, vídeo escurecido, vídeo) | 🎬 | — |
| Tela cheia | ⛶ | F |
| Sair | ✕ | Esc |

- **YouTube em modo “só som”** (padrão): o vídeo toca escondido atrás da letra. Se o navegador pedir um toque (comum no iPhone/iPad na primeira música), o vídeo aparece no centro com o aviso “toque no ▶ do vídeo”. Depois disso ele volta para trás da letra e o app comanda sozinho.
- **Vídeo bloqueado fora do YouTube** (comum em clipes oficiais): o app avisa e oferece **Trocar playback** ou **Seguir sem playback** (a letra anda pelo relógio).
- **Atraso da caixa Bluetooth**: em Ajustes. Vale para o aparelho, não para a música.

**Escolher um vídeo do YouTube:** ao colar o link, o app abre por alguns segundos um player invisível para conferir se o vídeo **pode tocar fora do YouTube**. Clipes de gravadora (Sia, Despacito…) costumam ser bloqueados: o app recusa na hora e pede outro, em vez de descobrir isso com a festa começada. (O oEmbed do YouTube não serve para isso: responde "200 OK" até para vídeo bloqueado.) Se a verificação não responder (sem internet), o vídeo é aceito com um aviso.

### Gravar sincronia tocando

Para música com letra sem tempo (ou com tempo de outra gravação): **Músicas → Editar → ⏺ Gravar sincronia**. O playback toca e você aperta **Marcar** (ou espaço) quando cada verso começa. **♪ Pausa** marca uma parte instrumental. Ao salvar, a música toca do começo para conferir.

### Dueto

**Editar → 👥 Marcar dueto**: escolha A, B ou Todos para cada verso. Na playlist, o item com dois cantores pinta cada parte na cor de cada um.

### Controle pelo celular (tela da festa)

1. Na TV/projetor/computador: **📱 Controle remoto → Abrir sala**. Aparecem um QR code e um código de 6 letras.
2. Nos celulares: leia o QR code (ou abra `…/karaoke/controle.html` e digite o código). Cada pessoa diz o nome e entra na família.
3. Pelo celular dá para: tocar, pausar, pular, ajustar a letra, mudar o volume, começar a próxima, medir os aplausos, ver a fila, **pedir música** da lista salva e pedir **música nova** (a letra é buscada no celular e vai junto; o link do playback é opcional).

4. **Tocar uma música da lista**: tocar nela abre um painel com o playback atual, o campo para **pôr ou trocar o link** (YouTube, YouTube Music ou Spotify; no YouTube o celular já confere se o vídeo toca fora do YouTube) e os botões **▶ Tocar agora** (pede confirmação, interrompe a música atual), **⏫ Tocar a seguir** e **＋ Pôr no fim da fila**.
5. **Playback que falhou**: quando o vídeo da música tocando não funciona, o celular mostra “⚠️ O playback desta música falhou” com **🎧 Trocar playback**; a tela recarrega a música sozinha com o link novo.

Regras: qualquer celular da sala pode fazer isso e a tela avisa quem fez. Playback do tipo **arquivo** (áudio guardado na tela) não é trocado pelo celular. Tudo viaja como comando `pedir` com campos opcionais (`modo`: fila, seguir, agora, playback; `playback`), então **não existe SQL novo**: `supabase/001_sala.sql` continua igual.

A tela da festa funciona em qualquer navegador moderno, inclusive o de projetores e TVs com Android. Precisa de internet nos dois lados.

### Compartilhar e backup

- **🔗 Compartilhar**: link com a playlist, os cantores e os playbacks do YouTube/Spotify (com ou sem as letras). Áudio de arquivo não vai.
- **Ajustes → Exportar/Importar backup**: arquivo `.json` com tudo, menos os áudios do aparelho. Importar sempre pergunta: **Adicionar** ou **Substituir**.

## Privacidade

- Playlists, letras, cantores e áudios ficam **só no aparelho** (IndexedDB, com cópia de segurança no localStorage).
- A chave da API do YouTube fica só no aparelho e nunca vai no link nem no backup.
- A sala da festa guarda no servidor apenas o que a tela publica (o que está tocando, a fila, os títulos da biblioteca e os nomes da família) e os pedidos dos celulares. Comandos somem depois de 1 dia; salas paradas, depois de 2 dias.
- O microfone só liga quando alguém aperta **Medir os aplausos** e desliga sozinho.

---

## Guia de continuidade (para quem for continuar o projeto)

### Regras do repositório que valem aqui

- Pasta autossuficiente, **JavaScript puro, sem biblioteca, sem CDN, sem fonte externa**.
- **Versão única**: `APP_VERSION` (`core.js`), `VERSION` (`sw.js`), `data-version` e todos os `?v=` de `index.html` e `controle.html`. Alterou qualquer arquivo, suba os três. O teste `tests/contracts.test.js` falha se divergirem.
- Arquivo novo entra no `index.html` (ou `controle.html`) **e** no `SHELL` do `sw.js`.

### Arquivos

```txt
index.html / styles.css    tela principal e palco
controle.html / controle.js   página do celular (controle remoto)
core.js          versão, utilidades, rede (fetchSafe/fetchRetrying), saúde das fontes, saveSoon, wake lock
storage.js       IndexedDB "karaoke" (gavetas "dados" e "audio") + cópia no localStorage
estado.js        modelo de dados, normalização (importação nunca quebra), salvar
lrc.js           PURO: lê/escreve LRC (tempo por palavra, dueto A/B/T), preenchimento da linha
links.js         PURO: reconhece links do YouTube/YouTube Music/Spotify
familia.js       cantores e rodízio (proximoCantor é puro)
biblioteca.js    músicas, áudio do aparelho
playlists.js     playlists, link de compartilhamento (CompressionStream), backup
letras.js        LRCLIB → lyrics.ovh; título por oEmbed; busca do YouTube com chave opcional
fontes.js        interface comum de playback + relógio manual + arquivo (<audio>)
busca-youtube.js   busca de vídeos: chave oficial → serviços Piped (INSTANCIAS_BUSCA), mapeamento e cooldown
verificar-youtube.js PEÇAS do YouTube usadas pela tela e pelo celular: origens, erros, endereço do player e a conferência “toca fora do YouTube?”
fonte-youtube.js protocolo postMessage do YouTube falado à mão (sem iframe_api)
fonte-spotify.js protocolo postMessage do Spotify falado à mão (sem o script deles)
palco.js         fases (vez → cantando → nota → fim), desenho da letra, um requestAnimationFrame só; modo solo (`P.solo`)
placar.js        PURO: placar pessoal do Cantar sozinho (registrarNota, melhorNota, limite de 300 registros)
sincronia.js     gravar sincronia tocando
aplausometro.js  microfone → nota (notaDosAplausos é pura)
qr.js            gerador de QR code (byte, nível M, versões 1–10)
sala.js          cliente RPC do Supabase (fetch puro)
sala-host.js     tela da festa: publica estado, aplica comandos dos celulares
telas.js / ui.js desenho das listas / eventos e inicialização
supabase/001_sala.sql  schema "karaoke" e funções public.karaoke_*
```

### Relógio da letra

```txt
tempoDaLetra = fonte.tempo() − musica.offset − prefs.audioDelay/1000
```

- `musica.offset` (por música, “Letra −/+”) corrige introdução diferente do playback.
- `prefs.audioDelay` (do aparelho) corrige o atraso da caixa Bluetooth. Um nunca escreve no outro.
- YouTube e Spotify mandam o tempo a cada ~250 ms; entre as entregas o tempo é extrapolado com **teto de 1 s**: se o player parar de responder, a letra congela em vez de disparar.

### Protocolos dos players (conferidos no código oficial)

- **YouTube** (`www-widgetapi.js`): envia `JSON {event:"listening"|"command", func, args, id:1, channel:"widget"}` com `targetOrigin` `https://www.youtube-nocookie.com`; recebe `infoDelivery` (`playerState`, `currentTime`, `duration`), `onReady` e `onError` (101/150 = dono bloqueou tocar fora do YouTube). **Um iframe para a sessão inteira** (iOS só deixa tocar por comando um player que já recebeu toque). Anúncio é detectado pela duração diferente e congela a letra.
- **Spotify** (`iframe_api` do `embed-cdn.spotifycdn.com`, lido em 20/11/2026): mensagens são **objetos**; recebe `{type:"ready"}` (responder `{command:"load_complete_ack"}`) e `{type:"playback_update", payload:{isPaused, isBuffering, position, duration}}` em ms; envia `{command:"play"|"pause"|"resume"|"toggle"}` e `{command:"seek", timestamp:segundos}`.
- Nunca carregar o script oficial de nenhum dos dois: quebraria o offline e a regra “sem biblioteca”. Bug de sincronia se resolve em `tempo()`/`aplicar()`, não adicionando o script.
- Toda mensagem recebida confere `e.origin` **e** `e.source === iframe.contentWindow`.

### Sala (Supabase)

- Projeto `iowuejrpzoibyidiuvpt` (o mesmo do Mapa do Parque e do Financeiro360). Tudo no schema `karaoke`, que a API não expõe; RLS ligado, sem política, sem GRANT para `anon`. A única porta são as funções `public.karaoke_*` (SECURITY DEFINER).
- `karaoke_sala_abrir` (tela), `karaoke_host_sync` (tela, a cada 1,5 s: publica estado e recebe comandos; exige o token), `karaoke_sala_ver` (celular, a cada 2 s), `karaoke_comando` (celular; lista fechada de tipos, até 40 KB, 60 por minuto), `karaoke_sala_fechar`.
- O celular **pede**; a tela **decide**. A playlist e as letras continuam morando só na tela.
- A tela limita o que os celulares podem acrescentar (`MAX_CANTORES`, `MAX_MUSICAS`, `MAX_FILA` em `sala-host.js`): o código da sala é o convite, e o limite por minuto do servidor vale por aparelho, que o cliente escolhe.
- Sem websocket de propósito: consulta periódica é simples e aguenta rede ruim.
- Só a chave **publicável** no navegador. Nunca a `service_role`.

### Testes

```bash
node --test karaoke/tests/*.test.js          # unidade e contrato (sem rede)
python3 -m http.server 8765 -d karaoke       # em outro terminal
node karaoke/tests/browser-smoke.js [pasta]  # ponta a ponta no Chromium (Playwright)
```

`node karaoke/tests/browser-uso.js` roda 22 cenários de **uso real** (o `browser-smoke.js` cobre o caminho feliz): ✕ em todas as telas, teclado, backup, link de compartilhar, offline, XSS, YouTube bloqueado, prévia do Spotify, celular em pé e o Cantar sozinho (nota, recorde, playlist sem cantores, backup e apagar placar). Cada cenário nasceu de um bug achado testando com YouTube e Spotify de verdade.

O teste de navegador simula LRCLIB, o player do YouTube (servido na origem verdadeira) e a sala do Supabase. Variáveis opcionais: `KARAOKE_VIEWPORT=1920x1080` (testa o palco em TV; `390x844` em celular em pé) e `KARAOKE_SALA_URL=http://127.0.0.1:8766` (em vez da sala em memória, usa funções SQL de verdade; veja abaixo). Roteiro manual: `checklist-manual.md`.

**Testes da sala (banco):**

```bash
# 1. Depois de aplicar supabase/001_sala.sql no Supabase: confere tudo contra o banco real
#    (cria uma sala aleatória, percorre o fluxo, testa as recusas de segurança e apaga a sala)
node karaoke/tests/sala-real.js

# 2. Antes de aplicar (ou ao mexer no SQL): testa as funções num Postgres comum.
#    Instruções no topo de supabase/teste_sala.sql (cria os papéis anon/authenticated).
psql -q -f karaoke/supabase/teste_sala.sql
```

`sala-real.js` aceita `KARAOKE_SUPABASE_URL` para apontar para outro servidor com a mesma API (por exemplo um PostgREST local).

### Bugs achados testando com serviços reais (20/11/2026) e como ficaram

- **✕ coberto**: nas telas "a vez de…", aplausos, fim e erro a camada de tela cheia tapava o botão de sair (impossível sair no celular). `#palcoTopo` agora fica acima das camadas (`z-index:18` contra `15`).
- **Seta na barra de progresso trocava de música**: o atalho de teclado ignorava que o foco estava num `range`.
- **Prévia do Spotify**: sem login ela termina aos 30 s e o app tratava isso como "fim da música" (ia para os aplausos no meio da canção). Agora avisa que foi só a prévia e oferece trocar o playback ou seguir só com a letra.
- **"Seguir sem playback" recomeçava do zero**: agora continua de onde estava.
- **Clipe bloqueado descoberto tarde**: o oEmbed devolve 200 para vídeo bloqueado; ver "Escolher um vídeo do YouTube" acima. No player real, `onReady` e `onError 150` chegam no **mesmo milissegundo**, por isso a verificação espera 1,5 s depois do "pronto" antes de aceitar.
- **`postMessage` antes de o iframe existir**: o navegador recusava e poluía o console. O app só envia depois de receber uma mensagem do player ou do evento `load` (o que vier primeiro; o `ready` do Spotify pode chegar **antes** do `load`, e depender só dele perdia o pedido de tocar).
- Celular em pé: título e botão em uma linha, seletor de playlist com a largura toda, abas com nome para leitor de tela.

### Cantar sozinho: como funciona por dentro

- **`P.solo`** (`palco.js`) é um sinalizador do palco, não um modo novo de fila. A playlist em solo abre como `modo:"festa"` com `solo:true` (fila, próxima música e controle pela sala seguem iguais); uma música avulsa abre como `modo:"solo"` (um item só, termina em nota → fim, ao contrário do `ensaio`, que termina direto).
- Com `P.solo`: `cantoresDoItem` devolve ninguém (cores padrão A/B/Todos, sem nomes), `rotuloPalco` mostra “🎤 Você”, `mostrarVez` vira “Prepare-se!” com contagem de no máximo 3 s. O `rotuloCantores` original continua valendo para a fila mostrada no celular.
- **Placar**: `K.dados.placar = [{musicaId, nota, em}]`. Só `medirAplausos` grava (sem microfone ou com o aplausômetro desligado não há nota, então nada é registrado). `placar.js` é puro e tem teste próprio (`tests/placar.test.js`). Apagar a música apaga as notas dela; importar backup antigo sem `placar` continua válido.

### Ideias para evoluir

1. Tempo real por websocket (Supabase Realtime) quando a consulta a cada 2 s ficar lenta.
2. Fila de pedidos com aprovação na tela (hoje o pedido entra direto).
3. Tom do playback (pitch shift) para o arquivo do aparelho, com `AudioContext` e sem biblioteca.
4. Nota de afinação de verdade (detecção de altura pelo microfone) — só se for honesta sobre o que mede.
5. Modo “só celular” com a letra também no telefone de quem está cantando.
6. Cantar sozinho: histórico de notas por música (gráfico) e metas (“bater 80 pontos”); hoje só o recorde aparece.

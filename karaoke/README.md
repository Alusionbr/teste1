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

### Gravar sincronia tocando

Para música com letra sem tempo (ou com tempo de outra gravação): **Músicas → Editar → ⏺ Gravar sincronia**. O playback toca e você aperta **Marcar** (ou espaço) quando cada verso começa. **♪ Pausa** marca uma parte instrumental. Ao salvar, a música toca do começo para conferir.

### Dueto

**Editar → 👥 Marcar dueto**: escolha A, B ou Todos para cada verso. Na playlist, o item com dois cantores pinta cada parte na cor de cada um.

### Controle pelo celular (tela da festa)

1. Na TV/projetor/computador: **📱 Controle pelo celular → Abrir sala**. Aparecem um QR code e um código de 6 letras.
2. Nos celulares: leia o QR code (ou abra `…/karaoke/controle.html` e digite o código). Cada pessoa diz o nome e entra na família.
3. Pelo celular dá para: tocar, pausar, pular, ajustar a letra, mudar o volume, começar a próxima, medir os aplausos, ver a fila, **pedir música** da lista salva e pedir **música nova** (a letra é buscada no celular e vai junto; o link do playback é opcional).

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
fonte-youtube.js protocolo postMessage do YouTube falado à mão (sem iframe_api)
fonte-spotify.js protocolo postMessage do Spotify falado à mão (sem o script deles)
palco.js         fases (vez → cantando → nota → fim), desenho da letra, um requestAnimationFrame só
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
- Sem websocket de propósito: consulta periódica é simples e aguenta rede ruim.
- Só a chave **publicável** no navegador. Nunca a `service_role`.

### Testes

```bash
node --test karaoke/tests/*.test.js          # unidade e contrato (sem rede)
python3 -m http.server 8765 -d karaoke       # em outro terminal
node karaoke/tests/browser-smoke.js [pasta]  # ponta a ponta no Chromium (Playwright)
```

O teste de navegador simula LRCLIB, o player do YouTube (servido na origem verdadeira) e a sala do Supabase. Roteiro manual: `checklist-manual.md`.

### Ideias para evoluir

1. Tempo real por websocket (Supabase Realtime) quando a consulta a cada 2 s ficar lenta.
2. Fila de pedidos com aprovação na tela (hoje o pedido entra direto).
3. Tom do playback (pitch shift) para o arquivo do aparelho, com `AudioContext` e sem biblioteca.
4. Nota de afinação de verdade (detecção de altura pelo microfone) — só se for honesta sobre o que mede.
5. Modo “só celular” com a letra também no telefone de quem está cantando.

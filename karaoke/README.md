# Karaokê em Casa

> **Quem for continuar o projeto (pessoa ou outra ferramenta): comece por [`CONTINUIDADE.md`](CONTINUIDADE.md)** — histórico das versões, decisões, como testar, o que falta e onde procurar melhorias.

Karaokê para a família, direto no navegador. Monte playlists, escolha o **playback** de cada música (YouTube, YouTube Music, Spotify ou um arquivo do aparelho) e cante com a **letra grande, sincronizada, enchendo na cor de quem está cantando**. Deixe a TV ou o projetor como **tela da festa** e controle tudo pelos celulares.

Publicado em: <https://alusionbr.github.io/teste1/karaoke/>

O botão 🎬 no palco percorre os quatro fundos a partir do que aparece na tela, inclusive quando a música já tem uma escolha de letra salva.

## Como usar

1. **Família** — cadastre quem vai cantar: nome, emoji e cor. A cor pinta a letra da pessoa no palco.
2. **Músicas → + Nova música** — busque pelo nome. Os resultados com **✓ sincronizada** já vêm com o tempo de cada verso. Depois escolha o playback:
   - **YouTube / YouTube Music**: cole o link (`youtube.com/watch?v=…`, `youtu.be/…` ou `music.youtube.com/watch?v=…`). Procure por “playback” ou “karaokê”, ou seja, vídeo só com a música, sem a voz. Com uma chave da API do YouTube em Ajustes, a busca acontece dentro do app e só mostra vídeos que podem tocar aqui.
   - **Spotify**: cole o link de uma faixa (`open.spotify.com/track/…`). Sem login no Spotify naquele navegador, toca só a prévia de 30 s, e o primeiro play é um toque no ▶ do próprio Spotify.
   - **Arquivo**: escolha um MP3/M4A do aparelho. Fica guardado só ali e toca **sem internet**. É a forma mais precisa.
3. **Playlist** — adicione as músicas. O app sugere o próximo cantor (rodízio: quem cantou menos vai primeiro). Marque **Dueto** para dois cantores.
4. **▶ Começar karaokê** — tela cheia com “Agora é a vez de…”, contagem, letra no estilo karaokê e, no fim, o **aplausômetro** (mede o barulho da plateia pelo microfone; não mede afinação e não grava nada).

### Conhecer, testar e compartilhar o projeto

O QR **“Gostou da festa?”** aparece só em telas grandes (a partir de 900×600), nas pausas de uma playlist: aplausos e fim. Fica por até 25 segundos e só volta depois de 15 minutos. Nunca aparece durante canto, contagem, ensaio, gravação ou erro. O QR da sala tem prioridade. Fechar o convite o dispensa até encerrar a sessão do navegador; em **Ajustes → Conheça o projeto**, é possível desligar ou reativar.

O destino é a página pública `projeto.html`, com apresentação, botão para experimentar, compartilhamento/cópia do link e sugestões via GitHub. O QR não carrega código de sala nem dados da família. Não há pedido de dinheiro ou funcionalidade de pagamento nesta etapa. A página e os scripts entram no cache offline do app.

### Usar a conta do YouTube no navegador da tela

Em **Ajustes → Conta do YouTube**, habilite **Usar minha sessão do YouTube neste navegador** e abra o YouTube para entrar na conta. Faça isso no mesmo navegador e aparelho que exibe o palco. A mudança vale na próxima música, sem interromper a atual.

O player passa a usar `youtube.com`, com cookies, em vez do modo de privacidade `youtube-nocookie.com`. A recuperação de falhas preserva essa escolha. Com YouTube Premium ativo e cookies permitidos, o YouTube pode reconhecer o benefício sem anúncios ([ajuda oficial](https://support.google.com/youtube/answer/7437519?hl=pt-BR)). Conta gratuita continua com anúncios; login no app da TV ou no celular não conecta o navegador da tela. O karaokê não recebe credenciais nem confirma login ou assinatura. Desligar a opção volta a priorizar o modo de privacidade na próxima música, mas não desloga do YouTube. Sem a opção, a recuperação continua podendo tentar o domínio padrão, como nas versões anteriores.

Esta opção não é um bloqueador. Navegadores de TVs/projetores podem não reconhecer a sessão. Se o YouTube não reconhecer o Premium, confira conta/cookies ou use um arquivo local de áudio. O site não consegue instalar um bloqueador automaticamente nesses aparelhos.

### Usar como lista compartilhada de faixas (vídeo do YouTube com a letra)

Para a festa em que **a letra já vem no vídeo de karaokê do YouTube**: o app vira a lista compartilhada de faixas e a fila, e a tela mostra o vídeo.

1. **É o padrão**: o fundo “Só o vídeo do YouTube — a letra vem no próprio vídeo” já vem ligado (Ajustes → Palco → Fundo da letra). O vídeo ocupa a tela inteira; depois de 4 s sem mexer somem as barras e **só o player fica na tela**, com a sala funcionando por trás (celulares, fila, vez e aplausos continuam valendo).
2. **Ligar e desligar a letra sincronizada sem atrapalhar o vídeo**: botão **🎞 Só vídeo / 🔤 Letra** no palco, tecla **L** e botão no **celular da sala**. É só troca de camada: o player do YouTube não é recarregado nem muda de tamanho, então o som e o relógio seguem sem soluço. Ligada, a letra volta com o vídeo escurecido atrás (ou o último fundo que você usava). O botão 🎬 alterna entre os quatro fundos.
3. **Nada leva a TV para a página do YouTube**: o player não mostra controles, título nem logo e não aceita cliques (só o primeiro toque que o iPhone/iPad exige). Quem comanda é o app, o teclado e os celulares.
4. **Achar e adicionar o vídeo sem sair do app**: Músicas → + Nova música → digite o nome e o artista no campo único e toque em **➕ Adicionar**: o app escolhe sozinho o melhor vídeo de karaokê, busca a letra sincronizada e já põe a música na playlist (veja “Adicionar pelo nome e em lote” abaixo). No celular da sala: **✨ Música nova**, mesmo campo; o app mostra o vídeo escolhido e você toca em **Pedir na fila** (ou **Outros vídeos**).
5. A família escolhe, troca o playback e manda tocar pelo celular (painel da música). A vez, o rodízio e o aplausômetro continuam valendo.

Músicas que não são do YouTube (Spotify, arquivo) continuam mostrando a letra do app mesmo nesse modo. Vídeo que o dono bloqueou fora do YouTube é recusado na hora, antes de entrar na lista.

### Adicionar pelo nome e em lote (acervo da família)

- **Um nome só** (Nova música → campo único → ➕ Adicionar): o app procura vídeos, dá pontos a cada um (palavras karaokê/playback/instrumental, palavras do que você digitou, duração, e tira pontos de “ao vivo”, cover, remix, coletânea) e confere o melhor com o player invisível; se o melhor for bloqueado, tenta o seguinte (até 3). Em paralelo busca a letra (LRCLIB): com “Música - Artista” usa a busca exata; sem artista, usa a primeira da busca livre e preenche título e artista. A música entra no fim da playlist com a linha **▶ vídeo · duração**, o selo da letra, e os botões **Trocar vídeo** e **Tirar**. “🔎 Ver opções” mostra a lista de vídeos para escolher à mão (como antes).
- **Várias de uma vez** (Nova música → “📋 Adicionar várias de uma vez”): cole uma música por linha (`Evidências - Chitãozinho e Xororó`; numeração e marcadores são ignorados, repetidas também; máximo 30 por vez). O app resolve uma a uma (cerca de 1 a 3 s cada), mostra “3 de 12” e **Parar**. No fim, cada linha mostra o vídeo escolhido; troque só as que erraram. Linha sem vídeo que toque mas com letra entra **sem playback** (botão “Escolher vídeo”); linha sem nada fica marcada em vermelho e nada é criado.
- A escolha automática pode errar (versão ao vivo, outro idioma). Por isso sempre há **Trocar vídeo**, e vídeo com pontuação baixa vem com “confira se é este mesmo”.
- **Acervo da família**: cada música guarda a letra e o id do vídeo no aparelho. Para levar a outro aparelho: **Ajustes → Exportar backup** (ou o link compartilhado da playlist) e importe lá. **Não coloque o acervo (letras) dentro do repositório**: o site é público e letra de música é obra protegida.
- Código: `busca-youtube.js` (`pontuarVideo`, `ordenarCandidatos`, `resolverPlayback`, `lerListaDeMusicas`, puros e testados em `tests/busca.test.js`) e `auto-adicionar.js` (`adicionarPeloNome`, trocar e tirar; a tela liga os botões em `ui.js`).

### Vários celulares: reprodução, fila e repertório de cada um

- **Controles da música:** todos os celulares na sala podem tocar, pausar, ajustar o volume e mexer na letra.
- **Ordem da fila:** toda sugestão entra no fim. Na tela principal, toque no código da sala e marque **Permitir que os celulares pulem ou mudem a ordem da fila** para liberar os atalhos da fila. A opção começa desligada. Depois dos aplausos, qualquer pessoa pode seguir para a próxima música da fila.
- **Cada um com o seu repertório:** ao pedir música, o seletor "Quem vai cantar?" já vem com o seu nome; na aba Fila, **"Só as minhas músicas"** inclui seus solos e duetos, mesmo quando outro cantor tem nome parecido. No celular de quem é a vez aparece "🎤 É a sua vez! Toque em Começar".
- **Letra por música:** em música de YouTube que tem letra, o botão 🎞/🔤 (ou a tecla L, ou o botão do celular) guarda a escolha **na música**: "a do vídeo" (padrão, só o vídeo) ou "a do app" (sincronizada). No editor, "Letra no palco (vídeo do YouTube)" faz o mesmo. A preferência de Ajustes é só a base.
- **Letra das músicas pedidas pelo celular:** a tela procura a letra do app sozinha, em segundo plano (uma música por vez), depois de pôr a música na fila; se não achar, a música segue só com o vídeo.

### Minha lista no celular

Na página de controle, cada pessoa pode buscar e guardar músicas no próprio celular mesmo sem sala aberta. Ao entrar numa sala, marca uma ou mais músicas e envia para o fim da fila. O envio não interrompe quem está cantando. Quando uma música com playback chega à sala, seu link também é salvo no catálogo compartilhado. Se a tela já tiver um playback cadastrado para essa música, o pedido contribui com o novo link sem substituir a fonte que a tela já usa.

### Mudar a tela principal para o projetor

No projetor, abra **Controle remoto**, digite o código da sala e toque em **Pedir para assumir**. A tela atual mostra o pedido; alguém nela precisa aprovar. A fila inteira, letras, cantores e música atual são transferidos criptografados pelo Supabase. A tela antiga entrega o controle e para o playback; no projetor novo, a música abre no ponto em que estava e aguarda um toque em **Começar**. O conteúdo transferido não inclui a chave do YouTube nem arquivos de áudio guardados no aparelho antigo. Se alguma música da fila usa um arquivo local, será preciso escolher esse arquivo novamente no projetor.

### Playback compartilhado entre salas

Ao salvar uma música com playback do YouTube, a tela compartilha título, artista, ID e título do vídeo. Na próxima busca pelo nome ou pelo nome e artista, o primeiro link salvo tem preferência. Outros links ficam como alternativas. Se o catálogo falhar, a busca externa continua disponível.

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

4. **Pedir uma música da lista**: o painel permite pôr ou trocar o playback e pedir a música no fim da fila.
5. **Playback que falhou**: se o player não responder em seis segundos, o palco tenta a outra URL de incorporação e libera os controles do YouTube. Quando o player responde, mas demora a tocar, a tela mostra os controles do YouTube. Se aparecer o aviso de demora, o vídeo pode voltar sozinho. O aviso também oferece tentar novamente, abrir no YouTube, trocar o playback ou seguir sem áudio. Quem está no celular também pode usar **Trocar playback**.

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
busca-youtube.js   busca de vídeos: chave oficial → serviços Piped (INSTANCIAS_BUSCA), mapeamento, cooldown e escolha automática
auto-adicionar.js  "Adicionar pelo nome": vídeo + letra + playlist, trocar e tirar (tela)
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
- `karaoke_sala_abrir` (tela), `karaoke_host_sync` (tela, a cada 1,5 s: publica estado e recebe comandos; exige o token), `karaoke_sala_ver` (celular, a cada 2 s), `karaoke_comando` (celular; lista fechada de tipos, até 40 KB, 60 por minuto), `karaoke_sala_transferir` (troca o token da tela atual pelo token do projetor aprovado), `karaoke_sala_fechar`.
- O celular **pede**; a tela **decide**. A playlist e as letras ficam na tela. Só numa transferência aprovada, a fila ativa é enviada temporariamente e criptografada para o novo projetor.
- A tela limita o que os celulares podem acrescentar (`MAX_CANTORES`, `MAX_MUSICAS`, `MAX_FILA` em `sala-host.js`): o código da sala é o convite, e o limite por minuto do servidor vale por aparelho, que o cliente escolhe.
- Sem websocket de propósito: consulta periódica é simples e aguenta rede ruim.
- Só a chave **publicável** no navegador. Nunca a `service_role`.

### Testes

```bash
node --test karaoke/tests/*.test.js          # unidade e contrato (sem rede)
python3 -m http.server 8765 -d karaoke       # em outro terminal
node karaoke/tests/browser-smoke.js [pasta]  # ponta a ponta no Chromium (Playwright)
```

`node karaoke/tests/browser-uso.js` roda 33 cenários de **uso real** (o `browser-smoke.js` cobre o caminho feliz): ✕ em todas as telas, teclado, backup, link de compartilhar, offline, XSS, YouTube bloqueado, prévia do Spotify, celular em pé e o Cantar sozinho (nota, recorde, playlist sem cantores, backup e apagar placar). Cada cenário nasceu de um bug achado testando com YouTube e Spotify de verdade.

O teste de navegador simula LRCLIB, o player do YouTube (servido na origem verdadeira) e a sala do Supabase. Variáveis opcionais: `KARAOKE_VIEWPORT=1920x1080` (testa o palco em TV; `390x844` em celular em pé) e `KARAOKE_SALA_URL=http://127.0.0.1:8766` (em vez da sala em memória, usa funções SQL de verdade; veja abaixo). Roteiro manual: `checklist-manual.md`.

**Testes da sala (banco):**

```bash
# 1. Depois de aplicar supabase/001_sala.sql e 003_transferencia_tela.sql no Supabase: confere sala e troca de tela contra o banco real
#    (cria uma sala aleatória, percorre o fluxo, testa as recusas de segurança e apaga a sala)
node karaoke/tests/sala-real.js

# 2. Antes de aplicar (ou ao mexer no SQL): aplica 001_sala.sql e 003_transferencia_tela.sql e testa as funções num Postgres comum.
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

Teste da opção de sessão: `node karaoke/tests/browser-sessao.js` (Playwright/Chromium; servidor local na porta 8767 ou `KARAOKE_URL`). Verifica uso sem conta, origens e outra mídia em progresso por mais de 12 segundos com player simulado; não valida login/cookies/Premium reais.

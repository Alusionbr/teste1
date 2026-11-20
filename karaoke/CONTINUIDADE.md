# Karaokê em Casa — guia de continuidade

Documento para quem for assumir o projeto (pessoa ou outra ferramenta): o que existe, o que foi feito e por quê, como testar, o que está pendente e onde procurar melhorias. Complementa o `README.md` (uso), o `checklist-manual.md` (roteiro de teste) e a seção "Karaokê em Casa" do `CLAUDE.md` da raiz (regras do projeto).

## 1. O que é

Karaokê da família em JavaScript puro (sem bibliotecas, sem build), PWA que funciona offline. Uma **tela** (TV, projetor ou computador) é o palco; os **celulares** viram controle remoto por uma sala no Supabase. Playlists com playback do YouTube, YouTube Music, Spotify ou arquivo do aparelho, e letra sincronizada (LRC) opcional.

- Pasta: `karaoke/` · Site: GitHub Pages publica a `main` (mudança só aparece depois do merge).
- Dados: IndexedDB no aparelho da tela (cópia no localStorage) + backup em arquivo. A sala no Supabase guarda só dados passageiros (comandos 1 dia, salas 2 dias).
- A migração `003_transferencia_tela.sql` adiciona a troca segura do token da tela; ela já foi aplicada ao projeto Supabase usado pelo app. Ao configurar outro projeto, aplique `001_sala.sql`, `002_catalogo.sql` e `003_transferencia_tela.sql`.

## 2. Mapa rápido do código

| Arquivo | Para quê |
|---|---|
| `core.js` | `APP_VERSION`, utilidades, rede (`fetchSafe`, `fetchRetrying`), saúde das fontes (`markSource`/`sourceCoolingDown`), `saveSoon` |
| `estado.js` | modelo de dados e `normalizarDados` (nunca lança; descarta lixo) |
| `biblioteca.js` / `playlists.js` / `familia.js` | músicas, playlists, cantores e rodízio |
| `letras.js` | LRCLIB → lyrics.ovh, `acharLetra`, `buscarLetras`, oEmbed |
| `busca-youtube.js` | busca de vídeos (chave oficial → serviços Piped), **pontuação e escolha automática** (`pontuarVideo`, `resolverPlayback`), `lerListaDeMusicas` |
| `auto-adicionar.js` | "Adicionar pelo nome" na tela: vídeo + letra + playlist, trocar, tirar |
| `verificar-youtube.js` | `YouTubeBase`: confere se um vídeo toca fora do YouTube |
| `fontes.js`, `fonte-youtube.js`, `fonte-spotify.js` | interface comum de playback (protocolo `postMessage` falado à mão) |
| `palco.js` | fases vez → cantando → nota → fim; `fundoEfetivo` (letra do vídeo ou do app); comandos de teclado |
| `sala.js` / `sala-host.js` | cliente RPC; tela da festa (publica estado, aplica comandos, **permissão para mudar a fila**) |
| `controle.html` / `controle.js` | página do celular |
| `telas.js` / `ui.js` | desenho / eventos da tela principal |
| `sw.js` | cache do casco (lista `SHELL`) |
| `tests/` | ver seção 5 |

Scripts são carregados em ordem no HTML, sem módulos. Arquivo novo entra no `index.html` (e `controle.html` se o celular usa) **e** no `SHELL` do `sw.js`.

## 3. Histórico do que foi feito (versões)

A versão é única: `APP_VERSION` (`core.js`) = `VERSION` (`sw.js`) = `data-version` e todos os `?v=` de `index.html` e `controle.html`. `tests/contracts.test.js` falha se divergirem. **Mexeu em qualquer arquivo do app? Suba a versão nos quatro lugares**, senão o service worker segue servindo o antigo.

| Versão | O que entrou |
|---|---|
| 1.0.16 | Mudança de duração deixa de marcar anúncio. A tela mostra os controles nativos quando o vídeo demora a começar. Depois de um aviso de demora, o player ainda pode recuperar sozinho. |
| 1.0.15 | Se o player do YouTube não responder, o palco tenta a URL alternativa com os controles nativos. O aviso também dá acesso ao vídeo direto no YouTube. |
| 1.0.14 | O palco dá até 12 s para o playback do YouTube avançar e oferece nova tentativa. Todos podem usar os controles da música. Sugestões entram no fim e a tela decide se os celulares podem pular ou reordenar. |
| 1.0.13 | Troca da tela principal pelo código da sala: o aparelho atual aprova, a fila/letras são transferidas de forma criptografada e a nova tela retoma a música do ponto salvo. Migração adicional `003_transferencia_tela.sql`. |
| 1.0.2 | Base: playlists, letra sincronizada, sala e controle pelo celular (a que estava na `main` antes do PR #64) |
| 1.0.3 | **Cantar sozinho**: `P.solo`, placar pessoal (`placar.js`), recorde, sem precisar de cantores |
| 1.0.4 | **Celular põe/troca playback e toca** (tocar agora / a seguir / fila) via comando `pedir` com `dados.modo` e `dados.playback`; `verificar-youtube.js` extraído |
| 1.0.5 | **Modo "só o vídeo do YouTube"** (padrão, `prefs.fundo="tela"`), letra do app liga/desliga sem recarregar o vídeo; música só com o link |
| 1.0.6 | **Busca de vídeos dentro do app** (`busca-youtube.js`): chave oficial opcional, senão serviços Piped em paralelo com descanso de 20 s por instância |
| 1.0.7 | Editor e celular já abrem listando os vídeos do playback (duração parecida primeiro, `diferencaDuracao`) |
| 1.0.8 | **Adicionar pelo nome**: o app escolhe o melhor vídeo sozinho, confere se toca, busca a letra; **adicionar várias de uma vez** (lote até 30); celular mostra o vídeo escolhido e pede na fila |
| 1.0.9 | **Trava do cantor**; "Só as minhas músicas"; **letra por música** (`musica.letraDe`); tela busca a letra de músicas pedidas pelo celular |
| 1.0.12 | Minha lista no celular: preparar, selecionar e enviar músicas para a fila, mesmo antes de entrar numa sala. Pedido com playback também contribui imediatamente para o catálogo compartilhado; se a tela já tinha outra fonte para a música, ela continua preservada. |
| 1.0.11 | Catálogo entre salas no Supabase (002_catalogo.sql). A tela contribui ao salvar e o celular consulta antes da busca externa. Conferir disponibilidade e qualidade das contribuições durante o uso. |
| 1.0.10 | O ciclo de fundos parte do fundo visível. A fila envia os identificadores dos cantores para filtrar solos e duetos. As páginas usam a cor do manifesto durante a atualização. |

Os PRs/commits têm o detalhe (`git log -- karaoke/`). O PR #64 reúne 1.0.3 a 1.0.10.

## 4. Decisões importantes e por quê

1. **Sem script de terceiro.** YouTube e Spotify por `<iframe>` criado por JS depois de um gesto; protocolo falado à mão, `targetOrigin` explícito, confere `origin` **e** `source`. Nunca carregar `iframe_api`.
2. **O celular só pede, a tela decide.** Lista fechada de comandos (`karaoke_comando`). Tudo novo desde a 1.0.4 foi feito com campos opcionais em `pedir`/`pedir_nova`, sem mexer no SQL.
3. **Trocar a camada da letra nunca recria o iframe** (o vídeo soluçaria). Só CSS (`#palco[data-fundo=…]`). O player do YouTube não é clicável (a TV não pode sair da sala).
4. **Resultado de busca Piped não garante que o vídeo toca embutido.** Quem escolhe confere com `YouTubeBase.verificar` (player invisível, ~1,5 s). Com a chave oficial a busca já filtra (`videoEmbeddable=true`).
5. **Escolha automática nunca esconde a dúvida**: toda música adicionada pelo nome volta com "Trocar vídeo" e "Tirar"; pontuação baixa vira "confira se é este mesmo".
6. **Ordem da fila**: a tela aplica a preferência `pularFila`, desligada por padrão. Sugestões sempre entram no fim. A permissão governa os atalhos que mudam a ordem, e a reprodução fica disponível a todos.
7. **Letra por música** (`letraDe`): a preferência do aparelho (`prefs.fundo`) é só a base e nunca muda por causa de uma música (`fundoEfetivo()`).
8. **Acervo da família mora no aparelho** (backup/link compartilhado). **Não commitar letras no repositório**: o site é público e letra é obra protegida.
9. **Sem dado de exemplo** na biblioteca.
10. **Fonte que falhou é poupada por 20 s, nunca para sempre** (`sourceCoolingDown`).

## 5. Como testar

Servidor local (porta 8765) e, a partir da raiz do repositório:

```bash
python3 -m http.server 8765 -d karaoke &        # em segundo plano
node --test karaoke/tests/*.test.js              # unidade/contrato (≈70 testes, sem rede)
node karaoke/tests/browser-uso.js                # 33 cenários de uso real (Playwright, rede simulada)
node karaoke/tests/browser-smoke.js              # caminho feliz em 3 tamanhos de tela + Supabase real
node karaoke/tests/sala-real.js                  # sala e transferência contra o Supabase real (se mexer no SQL)
```

- Os testes de navegador simulam YouTube, Spotify, Piped e LRCLIB por rotas do Playwright; nada depende da internet para passar (o smoke usa uma sala em memória por padrão).
- Não rode dois testes de navegador escrevendo na mesma pasta de saída ao mesmo tempo.
- O teste de uso leva cerca de 1,5 a 2 minutos.

## 6. O que NÃO foi testado (precisa de aparelho real)

- TV/projetor de verdade e navegador de TV.
- iPhone: o primeiro vídeo da sessão pode pedir um toque no player.
- Spotify logado (sem login toca só 30 s de prévia).
- Dois ou mais celulares reais com a ordem protegida e liberada (o teste simula os comandos, não os aparelhos).
- Busca com a internet real depois de semanas: os serviços Piped públicos mudam e caem.

## 7. Pendências e ideias de melhoria (por onde começar a varredura)

Fragilidades conhecidas:
- **Serviços Piped públicos** (`INSTANCIAS_BUSCA`): podem cair ou sair do ar; hoje a reserva é link colado ou a chave grátis do YouTube. Vale reavaliar a lista e a ordem periodicamente (`curl -D- "<base>/search?q=teste&filter=videos"` precisa devolver `access-control-allow-origin`).
- **Pontuação dos vídeos** (`pontuarVideo`): pesos e listas de palavras são heurística; ajustar com exemplos reais de erro (o teste `busca.test.js` é o lugar para fixar cada caso).
- **Trava por nome**: dois celulares com o mesmo nome se confundem; nome sem cantor correspondente na tela não tem dono. Ideia: identificar por `idDoAparelho()` e associar ao cantor.
- Letra buscada automaticamente (celular e lote) pode ser de outra gravação; a sincronia só é confiável com duração parecida.
- O lote só existe na tela; no celular é um nome por vez.

Ideias sem dono:
- Importar playlist de karaokê do YouTube (testado: o serviço público devolveu a playlist vazia, por isso não foi feito).
- Lote no celular; revisão/edição de várias músicas de uma vez.
- Exportar/importar só o "acervo" (músicas + vídeos) sem playlists e placar.
- Acessibilidade (foco, contraste, tamanhos de toque) na página do celular.
- Medir desempenho do palco em TV fraca (um `requestAnimationFrame` só).

## 8. Como publicar

1. Branch de trabalho → commit → push.
2. Abrir PR para a `main` (o PR #64 reúne as versões 1.0.3 a 1.0.10; enquanto estiver aberto, novos commits na mesma branch entram nele).
3. **Dar merge**; o site (GitHub Pages) atualiza em 1–2 minutos; nos aparelhos aparece o aviso "Atualizar".
4. Conferir a versão em Ajustes.

## 9. Armadilhas já encontradas

- Resultado de busca não é "toca fora do YouTube" (clipes oficiais costumam ser bloqueados).
- O oEmbed do YouTube devolve 200 mesmo para vídeo bloqueado.
- Teste de uso: digitar um texto como "link inválido" agora vira busca (use `https://exemplo.com/video`).
- Em testes, `deepEqual` entre contextos do `vm` falha por referência; compare `length` ou JSON.
- Clicar num botão que some logo depois (ex.: "Tirar") pode dar timeout; espere a contagem diminuir antes do próximo clique.
- Esquecer de subir a versão nos quatro lugares deixa o aparelho preso na versão antiga.

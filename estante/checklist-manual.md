# Checklist manual — Estante

Rode antes de publicar qualquer alteração. Sirva o repositório por HTTP (`python3 -m http.server`) e abra `http://localhost:8000/estante/` — no `file://` o service worker não roda.

## 1. Abertura

- [ ] A página abre sem erro no console.
- [ ] A etiqueta de rede mostra "online".
- [ ] Sem repertório salvo, a aba Repertório mostra o texto de lista vazia.

## 2. Busca

- [ ] Buscar por artista e música no modo **Inteligente** traz resultados e o aviso diz quais fontes responderam (LRCLIB, Vagalume, Deezer e/ou Apple).
- [ ] Abrir um resultado carrega a letra; o rodapé mostra o crédito da fonte.
- [ ] Quando a fonte não devolve letra, aparece a mensagem explicando e os links da faixa.
- [ ] Modo **Trecho** encontra a música por um pedaço da letra (depende só do Vagalume — sem ele disponível, não há como buscar por trecho).
- [ ] Com o Vagalume fora do ar (simule bloqueando `api.vagalume.com.br` nas ferramentas de rede do navegador): os chips **Brasil** e **Trecho** ganham um ponto vermelho; buscar neles mostra a mensagem certa com o botão **Tentar na Inteligente**, e clicar nele repete a busca no modo Inteligente.
- [ ] Ainda com o Vagalume fora do ar, o modo **Inteligente** continua trazendo resultados (via LRCLIB/Deezer/Apple/MusicBrainz).
- [ ] No modo **Trecho** com o Vagalume fora, a mensagem explica que procurar por pedaço da letra depende só dele e **não** oferece o atalho para a Inteligente (que também não faz busca por texto).
- [ ] Buscar por um artista brasileiro pouco conhecido traz resultado do **MusicBrainz** com duração preenchida.

## 2b. Busca no que já está no aparelho

- [ ] Com uma música salva no repertório, buscar pelo título traz ela **no topo**, com a etiqueta "no seu repertório".
- [ ] Buscar por um **verso** dessa música também acha, com a etiqueta "na letra · seu repertório".
- [ ] A mesma música vinda da rede não aparece duplicada, e a letra mostrada é a que você salvou/corrigiu.
- [ ] Offline, buscar ainda encontra o que está no repertório e no acervo; a mensagem diz que é do aparelho, sem parecer erro.
- [ ] Com o acervo preenchido (`acervo.json`), buscar por título ou por trecho acha a música com a etiqueta "acervo do site", e ela abre com a letra mesmo sem rede.
- [ ] Abrir um resultado que veio só do catálogo (Apple/Deezer) agora carrega letra pela reserva (acervo ou `lyrics.ovh`); se nenhuma tiver, a mensagem de sempre aparece.

## 3. Letra colada e cifras

- [ ] "Colar letra" abre o texto colado; linhas só com acordes viram cifras.
- [ ] Colar um `.lrc` (com marcas `[00:12.30]`) habilita o botão **Sincro**.
- [ ] Um `.lrc` com linha de acordes mostra as cifras e faz aparecer **Tom** e **Capo**; transpor funciona igual à letra comum.
- [ ] Um `.lrc` com `[Refrão]` e `[Solo]` faz aparecer a tira de seções; os cabeçalhos `[ar:]`/`[ti:]`/`[offset:]` não viram linha na letra.
- [ ] Os controles **Tom** e **Capo** só aparecem quando a música tem cifras.

## 4. Ajustes por música

- [ ] Mudar o tom transpõe as cifras (C +2 vira D).
- [ ] Mudar o capo desloca as cifras para baixo (tom +2 com capo 1 mostra C#).
- [ ] "Anotações" salva o texto e ele aparece na faixa acima da letra.
- [ ] Trocar de música e voltar traz tom, capo, velocidade e anotação de cada uma.
- [ ] Recarregar a página mantém tudo (só vale para músicas do repertório).
- [ ] A lista do repertório mostra as etiquetas de tom e capo.

## 4b. Velocidade automática

- [ ] Numa música com duração conhecida, **auto** acende e a velocidade muda sozinha.
- [ ] Rolando até o fim, a letra termina por volta do tempo da música.
- [ ] Mudar o tamanho da letra com o **auto** ligado recalcula a velocidade.
- [ ] Tocar em −/+ desliga o **auto** e volta ao manual.
- [ ] Numa letra colada sem duração, **auto** pergunta a duração; digitar `3:45` liga o automático.
- [ ] A etiqueta `auto` aparece na lista do repertório.

## 4c. Editar a letra

- [ ] **Editar letra** abre com o texto atual; salvar redesenha a letra na hora.
- [ ] Tom, capotraste, velocidade e anotações continuam iguais depois de salvar.
- [ ] Trocar o título pela edição não cria uma segunda cópia no repertório.
- [ ] Colar um `.lrc` pela edição reativa o botão **Sincro**.
- [ ] Escrever `[Refrão]` e `[Solo]` faz aparecer a tira de atalhos; tocar num deles rola até a seção.
- [ ] A tira some quando a música tem menos de duas seções.

## 4d. Gravação sem travar

- [ ] Segurar o `+` da velocidade durante a rolagem não engasga a letra.
- [ ] O valor ajustado continua lá depois de recarregar a página.
- [ ] Ajustar a velocidade de uma música do repertório não muda a velocidade das outras.

## 4e. Rolagem confiável no palco

- [ ] Com a rolagem ligada, sair do app por ~30 s e voltar: a letra continua de onde estava, **sem salto** e sem parar sozinha.
- [ ] Com **auto** ligado, rolar até o fim: a última linha chega ao rodapé junto com o fim da música, e a rolagem para **ali** — não continua subindo para dentro do espaço em branco.
- [ ] Numa letra curta que cabe na tela, **auto** avisa que não precisa rolar.
- [ ] Depois de parar a rolagem e sair do modo palco, a tela volta a apagar sozinha (wake lock liberado).

## 4f. Navegação entre músicas

- [ ] Tocando a música 2 de 3, buscar e abrir pelos resultados a **mesma** música: apertar › vai para a **3**, não para a 1.
- [ ] Na última música do repertório, apertar › não faz nada — não reabre a música nem volta a letra para o topo.
- [ ] Salvar uma música nova com **+ Repertório**: apertar › vai para a seguinte a ela.

## 5. Repertórios

- [ ] Criar um segundo repertório: o novo abre vazio e o anterior continua intacto.
- [ ] Renomear e duplicar funcionam; a duplicata vem com as mesmas músicas.
- [ ] Apagar pede confirmação; ao apagar o último, ele é esvaziado em vez de sumir.
- [ ] ↑ ↓ mudam a ordem e × remove; a música em execução continua marcada corretamente.
- [ ] O rodapé mostra o número de músicas e a duração estimada.

## 6. Palco

- [ ] **Rolar** desce a letra; a velocidade responde aos botões e às setas ↑ ↓.
- [ ] Tocar na letra durante a rolagem pausa.
- [ ] **Sincro** acompanha a letra temporizada.
- [ ] Com o **Sincro** rodando, encostar na letra **pausa** e não muda o ponto da música.
- [ ] Com o **Sincro** desligado, um toque na linha não liga a sincronia — só aparece a dica do toque duplo.
- [ ] **Toque duplo** numa linha começa a tocar dali (liga o Sincro se estiver desligado); dois toques lentos não contam.
- [ ] Com o **Sincro** rodando, tocar num atalho de seção leva o relógio junto — a letra não volta sozinha para a linha de antes.
- [ ] Com a **rolagem** ligada, tocar num atalho de seção salta na hora.
- [ ] **Modo palco** escurece o papel; a tela não apaga sozinha.
- [ ] ← → trocam de música dentro do repertório.

## 6b. Karaokê

**No navegador (lógica, sem depender de rede real — automatizado em `karaoke-test.js`):**

- [ ] Colar link comum, `youtu.be`, `/embed/`, YouTube Music e id puro extraem o mesmo id; texto sem link ou de outro site não vira id.
- [ ] O envelope do `postMessage` bate com o protocolo do `www-widgetapi.js` do Google (`event`, `func`, `args`, `id`, `channel:"widget"`), sempre para a origem do `youtube-nocookie.com`, nunca `"*"`.
- [ ] Mensagem de origem errada, remetente errado, dado que não é string ou JSON quebrado são rejeitados sem quebrar a página.
- [ ] O relógio extrapola entre entregas e tem teto de 1s; durante um "anúncio" (duração muito diferente da música) a letra congela e volta a andar sozinha quando a duração real reaparece.
- [ ] `videoOffset` e `audioDelay` deslocam a letra na direção certa e não vazam entre músicas ou sessões (offset é por música; delay é do aparelho).
- [ ] Letra sem `.lrc` rola pela fração tocada, não por velocidade; tocar na tela abre uma janela de rolagem manual que a posição automática não briga.
- [ ] `stopAll()` pausa o vídeo sem sair do modo karaokê; trocar de música troca o vídeo **antes** de esperar a busca de letra; trocar para uma música sem vídeo não dispara avanço automático sozinho.
- [ ] Rolar e Sincro ficam desabilitados (não mudos) enquanto o karaokê está ligado.
- [ ] Toque duplo numa linha durante o karaokê comanda o vídeo, não o relógio interno do Sincro.
- [ ] Enter com um botão focado dispara a ação uma vez só (não duas).
- [ ] Nenhum elemento com o atributo `hidden` continua ocupando espaço — varredura automatizada em `v312-test.js`. Vale para Tom/Capo, a barra de seções, a barra de repertórios e o ✕ do karaokê.
- [ ] **✕** e o ajuste rápido de Sincro na barra ficam escondidos fora do karaokê e aparecem ao entrar, já com o valor certo (sem esperar o primeiro toque no − / +).
- [ ] O botão flutuante **▶/⏸** aparece fora do karaokê no modo toque (aí ele rola a letra) e some fora do karaokê no modo pedaleira.
- [ ] **✕** desliga o modo sem apagar o `videoId`/`videoOffset` salvos na música.
- [ ] O nudge de sincronia pela barra e pelo diálogo mostram sempre o mesmo valor, o toque em qualquer um dos dois atualiza o outro.
- [ ] A janela de rolagem manual (letra sem `.lrc`) se renova a cada evento de `scroll`, não só no toque inicial — um arraste longo não leva um puxão de volta no meio do gesto.
- [ ] No celular, com o karaokê ligado, Karaokê → ajuste rápido de Sincro → **⚙** ficam em sequência na pedaleira (sem Vel./Letra/Tom/Capo no meio).

**No aparelho, antes da festa (só dá para confirmar tocando de verdade):**

- [ ] Segurando o celular com uma mão só, dá para sair do karaokê, tocar/pausar e ajustar a sincronia sem soltar o aparelho nem usar a outra mão.
- [ ] Durante a espera do "toque no vídeo" (autoplay bloqueado), o play flutuante some e o aviso central aparece no lugar — tocar na tela do vídeo (não no botão, que sumiu) libera o som.
- [ ] Girar o celular para paisagem com o karaokê ligado: o cabeçalho da música some e a pedaleira encolhe, sobrando mais tela para o vídeo.

- [ ] Colar o link de um vídeo comum e de um vídeo com karaokê no título; os dois tocam.
- [ ] Um vídeo que **proíbe** embutir mostra erro claro, com jeito de abrir no YouTube.
- [ ] Primeira música do dia: o navegador toca sozinho, ou pede um toque no próprio vídeo — e depois desse toque, dá para trocar de música sem tocar de novo.
- [ ] Caixa de som Bluetooth ligada: calibrar o **atraso** até a letra bater com o que sai da caixa.
- [ ] Microfone Bluetooth pareado **na caixa**, não no celular: música e voz não caem para qualidade de telefone.
- [ ] Projetor espelhando a tela: letra legível de longe, cores batendo com o vídeo por trás.
- [ ] Deixar uma música até o fim: avança sozinha para a próxima (depois da primeira vez tocada manualmente) ou mostra "toque em › para a próxima".
- [ ] Modo avião: o pedal Karaokê avisa que precisa de internet, sem travar o resto do app.

## 6c. Busca de vídeo dentro do app

**No navegador (automatizado em `v312-test.js`):**

- [ ] `parseISODuration` lê `PT3M45S`, `PT1H2M3S` e `PT45S`; transmissão ao vivo (`P0D`) e texto inválido viram 0, não uma duração falsa.
- [ ] A URL da busca sai com `type=video`, `videoEmbeddable=true` e a chave na consulta.
- [ ] A segunda chamada preenche a duração de cada resultado, e o que bate com a duração da música vem marcado.
- [ ] Entidades HTML do YouTube (`&quot;`, `&#39;`) aparecem decodificadas no título, sem virar `&amp;quot;`.
- [ ] Cada erro do Google vira instrução: chave inválida aponta Ajustes; cota estourada aponta colar o link; restrição de referenciador aponta o Google Cloud.
- [ ] Sem chave, o diálogo mostra o aviso com o atalho para Ajustes e a busca recusa explicando — o campo de colar link e o **Procurar no YouTube ↗** continuam ali.
- [ ] Anexar pelo resultado da busca e anexar pelo link colado gravam os mesmos campos, e os dois zeram o `videoOffset` do vídeo anterior.
- [ ] Vídeo muito mais longo que a música avisa na hora de anexar (a rolagem sem `.lrc` usa a duração da música).
- [ ] Os chips **Karaokê**/**Original** abrem marcados e trocam entre si sem apagar o chip ativo dos outros grupos (fonte de busca, forma de controle).

**No aparelho, com chave cadastrada:**

- [ ] Buscar, escolher um resultado e sair do diálogo já com o vídeo salvo — sem abrir o YouTube em nenhum momento.
- [ ] Tocar o vídeo escolhido: ele embute mesmo (o filtro deveria ter descartado os que não embutem).
- [ ] Cota estourada de verdade (ou chave apagada): a mensagem aparece e o caminho de colar link continua funcionando.

## 6d. Forma de controle (pedaleira opcional)

**No navegador (automatizado em `v312-test.js`):**

- [ ] Padrão é o modo **toque**: a pedaleira não ocupa espaço, sobram o botão flutuante e o **⋯**.
- [ ] O **⋯** traz a barra como sobreposição (`position:absolute`) — não empurra o layout, logo não muda a velocidade automática — e um segundo toque fecha.
- [ ] Com a barra aberta os flutuantes somem, em vez de espiar por cima dela.
- [ ] No modo **pedaleira** a barra é a de sempre e o **⋯** não aparece.
- [ ] A escolha fica guardada em `estante:v2:prefs`.
- [ ] O flutuante é a ação do momento: fora do karaokê rola a letra, dentro toca o vídeo.
- [ ] Espaço rola a letra **igual** nos dois modos — o modo muda o que é desenhado, nunca o que a tecla faz.
- [ ] A primeira tecla de pedaleira oferece a barra uma vez; a segunda não insiste, e a oferta feita fica registrada.

**No aparelho:**

- [ ] Ligar um pedal Bluetooth pela primeira vez: aparece a oferta, um toque põe a pedaleira à vista.
- [ ] Trocar de modo em **Ajustes** e conferir que a velocidade **auto** continua terminando junto com a música (a altura útil da tela mudou).
- [ ] No modo toque, tocar na letra fecha a barra aberta; deixar parado alguns segundos também.

## 6e. Avisos

- [ ] Com a barra lateral fechada no celular, um aviso do karaokê (por exemplo, tocar Karaokê em modo avião) **aparece na tela**, flutuando acima da pedaleira.
- [ ] Aviso comum some sozinho depois de alguns segundos; aviso com botão (fonte fora do ar → "Tentar na Inteligente") fica até fechar no ×.
- [ ] O aviso não bloqueia o toque na letra em volta dele.

## 7. Arquivos e compartilhamento

- [ ] **Exportar** baixa um JSON com todos os repertórios.
- [ ] **Importar** mostra o diálogo antes de mexer em qualquer coisa, dizendo o que vem no arquivo e o que seria apagado.
- [ ] **Adicionar** mantém os repertórios do aparelho e acrescenta os do arquivo.
- [ ] **Substituir** troca tudo — e só depois de confirmar.
- [ ] Fechar o diálogo no × não importa nada.
- [ ] Importar um export antigo (lista única) também passa pelo diálogo.
- [ ] **Compartilhar** abre o diálogo com o tamanho dos dois links antes de mandar qualquer coisa.
- [ ] **Com as letras**: abrir o link em outra janela oferece "Adicionar" e "Criar novo", o aviso diz que as letras vieram junto, e as músicas recebidas abrem **em modo avião**.
- [ ] **Só a ordem**: o link fica curto, o aviso do outro lado diz que cada letra precisa ser buscada, e o tom/capo/vídeo de cada música chega mesmo assim.
- [ ] Com um repertório grande (~30 músicas com letra), o diálogo mostra o aviso de link longo.
- [ ] **Imprimir** mostra a ordem do show com tom, capo, duração e anotações; a opção "Com as letras" traz uma música por página.

## 8. Offline e instalação

- [ ] Depois da primeira abertura, recarregar em modo avião (DevTools → Network → Offline) mantém o app e o repertório funcionando.
- [ ] A busca offline avisa que não há internet, sem quebrar a tela.
- [ ] O navegador oferece instalar o app (ícone aparece corretamente).
- [ ] Ao publicar uma versão nova, aparece o aviso "Nova versão disponível" com o botão de atualizar.

## 8b. No celular e no tablet

Teste em 360–390 px de largura e num tablet, ou nas ferramentas de dispositivo do navegador.

- [ ] O nome da música aparece no cabeçalho (não pode ficar espremido a zero).
- [ ] O cabeçalho ocupa uma linha só; os botões que não cabem são alcançados arrastando a fileira de lado.
- [ ] **Rolar**, **‹** e **›** aparecem na pedaleira sem precisar arrastar.
- [ ] Os rótulos Vel., Letra, Tom e Capo estão visíveis, dá para saber qual controle é qual.
- [ ] A página não rola de lado em nenhuma tela.
- [ ] Os diálogos (editar letra, colar letra) cabem na tela e rolam por dentro.

## 9. Migração

- [ ] Com um `estante:v2:setlist` antigo no navegador, abrir o app cria o repertório "Repertório" com as mesmas músicas e mantém a chave antiga como backup.

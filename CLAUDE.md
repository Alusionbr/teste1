# CLAUDE.md — repositório de ferramentas

## Estrutura do repositório

Este repositório é um conjunto de ferramentas independentes que rodam no navegador. A raiz é a página de índice; cada ferramenta mora na própria pasta.

```txt
index.html            página de ferramentas (a primeira página)
hub/styles.css        visual da página de ferramentas
hub/tools.js          lista das ferramentas: array HUB_TOOLS
estante/              aplicativo de letras e cifras para palco (PWA)
controle360/          aplicativo de estoque, custos, vendas e consignado
tools/make-icons.js   gera os ícones PNG do Estante com a zlib do Node
.github/workflows/    publica a raiz no GitHub Pages a cada push na main
```

Regras gerais:

- Uma ferramenta = uma pasta autossuficiente na raiz. Não misture arquivos de ferramentas diferentes.
- Publicar ferramenta nova = criar a pasta e acrescentar um objeto em `HUB_TOOLS` (`hub/tools.js`).
- Nada de servidor, login, banco externo ou biblioteca de terceiros: JavaScript puro, offline.
- Cada ferramenta guarda os dados no armazenamento local do navegador e oferece exportação.

As duas seções abaixo detalham cada ferramenta: primeiro o **Controle360 Multi**, depois o **Estante**.

---

# Controle360 Multi (`controle360/`)

## Finalidade

Este projeto é um MVP local para controlar múltiplos negócios no mesmo sistema:

- estoque de matéria-prima, embalagens, produtos finais, kits, mercadorias e serviços;
- custo médio ponderado;
- ficha técnica / composição de produto;
- custo de produção;
- preço sugerido de venda por margem desejada e taxas;
- vendas com CMV e lucro bruto;
- pedidos pendentes, em preparo, prontos, despachados e concluídos;
- quadro Kanban de tarefas;
- consignado por cliente;
- clientes, fornecedores e relatórios.

O sistema deve continuar **sem dados de exemplo preenchidos**. Configurações padrão como unidades, tipos e status podem existir, mas não cadastrar produtos/clientes/fichas automaticamente.

---

## Contexto de uso

O usuário quer liberdade para trabalhar com vários negócios. Exemplos:

1. Essências aromáticas: matéria-prima, vidro, rótulo, caixa, tampa, lacre, embalagem, mão de obra e perda técnica.
2. Marmitas/alimentos: ingredientes, embalagem, produção, venda, canal e CMV.
3. Revenda/mercadorias: compra, custo médio, venda, estoque e consignado.
4. Serviços com materiais: pode usar produtos físicos e custo rateado.

Não crie lógica presa a um único nicho. Use nomes genéricos: produto, matéria-prima, embalagem, ficha técnica, pedido, venda, cliente, fornecedor, consignado.

---

## Princípios obrigatórios

### 1. Revisão humana fácil

- Código em arquivos pequenos e com nomes claros.
- Evitar abstração excessiva.
- Funções devem ter responsabilidade única.
- Não misturar regra de negócio com CSS.
- Não esconder cálculo importante em função sem nome claro.
- Não adicionar bibliotecas externas sem necessidade real.
- Preferir JavaScript puro no MVP.

### 2. Estoque nunca deve ser alterado sem movimentação

Toda alteração relevante no estoque físico deve gerar registro em `stockMovements`:

- compra: `entrada_compra`;
- produção: `saida_producao_insumo` e `entrada_producao_produto_final`;
- venda: `saida_venda`;
- envio consignado: `saida_envio_consignado`;
- devolução consignada: `entrada_devolucao_consignado`;
- ajustes futuros: `ajuste_manual` com motivo obrigatório.

### 3. Produto final deve ser calculável por ficha técnica

Um produto final ou kit pode consumir qualquer quantidade de:

- matéria-prima;
- embalagem;
- mercadoria comprada pronta;
- outro item físico, desde que não consuma ele mesmo.

A ficha técnica fica em `recipes`.

### 4. CMV deve usar custo no momento da venda

Venda direta usa `product.avgCost` no momento da venda.

Venda via consignado usa `costAtSend`, porque o estoque central já foi baixado no envio.

### 5. Consignado não é venda no envio

Envio consignado significa:

```txt
Estoque central -> estoque sob responsabilidade do cliente
```

A venda só acontece quando o cliente informa venda. O pagamento é outro evento.

---

## Estrutura de arquivos

```txt
controle360/
├── index.html
├── README.md
├── build-mobile.js
├── controle360-mobile.html
├── src/
│   ├── utils.js           # helpers puros: moeda, número, data, id, HTML escape
│   ├── state.js           # estado local, persistência e acesso aos dados
│   ├── calculations.js    # cálculos de custo, preço, CMV, consignado e métricas
│   ├── ui.js              # geradores de HTML reutilizáveis
│   └── app.js             # telas, eventos e fluxos de negócio
├── styles/
│   └── main.css
├── docs/
│   ├── regras-negocio.md
│   ├── modelo-dados.md
│   ├── fluxos-operacionais.md
│   └── roadmap.md
└── tests/
    └── checklist-manual.md
```

---

## Modelo de dados principal

O estado fica no LocalStorage em `controle360_multi_v2`.

Coleções principais:

- `businesses`
- `products`
- `clients`
- `suppliers`
- `purchases`
- `stockMovements`
- `recipes`
- `productions`
- `sales`
- `orders`
- `consignments`
- `consignmentEvents`
- `tasks`

Toda coleção operacional, exceto `businesses`, deve ter `businessId`.

---

## Campos importantes de produto

```js
{
  id,
  businessId,
  name,
  type,
  unit,
  currentStock,
  avgCost,
  salePrice,
  minStock,
  laborCostPerUnit,
  overheadCostPerUnit,
  lossPercent,
  targetMarginPercent,
  taxFeePercent,
  notes
}
```

Tipos aceitos no MVP:

- `materia_prima`
- `embalagem`
- `produto_final`
- `mercadoria`
- `kit`
- `servico`

---

## Fórmulas obrigatórias

### Custo médio ponderado

```txt
novo_custo_medio = (estoque_atual * custo_medio_atual + valor_nova_entrada) / (estoque_atual + quantidade_entrada)
```

### Custo de produto por ficha técnica

```txt
custo_materiais = soma(qtd_por_unidade * custo_medio_do_item)
base = custo_materiais + mao_de_obra_por_unidade + custo_fixo_rateado_por_unidade
perda = base * perda_percentual
custo_final_unidade = base + perda
```

### Preço sugerido

```txt
preco_sugerido = custo_final_unidade / (1 - margem_desejada - taxas_percentuais)
```

Exemplo: custo R$ 10, margem desejada 50%, taxa 5%:

```txt
preço = 10 / (1 - 0,50 - 0,05) = 22,22
```

### Venda

```txt
receita_bruta = quantidade * preco_unitario
receita_liquida = receita_bruta - desconto - taxa_fixa - taxa_percentual
cmv = quantidade * custo_unitario_no_momento
lucro_bruto = receita_liquida - cmv
margem = lucro_bruto / receita_liquida
```

---

## Regras para próximas alterações

Antes de alterar código:

1. Leia `controle360/docs/regras-negocio.md`.
2. Confira se a alteração afeta estoque, CMV, produção ou consignado.
3. Se afetar cálculo, altere primeiro `controle360/src/calculations.js`.
4. Se afetar estrutura de dados, atualize `controle360/docs/modelo-dados.md`.
5. Se criar novo fluxo, atualize `controle360/docs/fluxos-operacionais.md`.
6. Rode o checklist manual em `controle360/tests/checklist-manual.md`.

Não implemente recursos novos diretamente em `controle360/src/app.js` sem avaliar se a lógica pertence a `calculations.js` ou `state.js`.

---

## Não fazer

- Não preencher produtos, clientes ou fichas de exemplo.
- Não apagar histórico de movimentação ao corrigir estoque.
- Não misturar consignado com venda imediata.
- Não usar FIFO/LIFO nesta versão.
- Não adicionar login, servidor, Firebase ou banco externo antes de estabilizar o MVP local.
- Não transformar serviços em estoque físico.
- Não permitir estoque negativo sem uma regra explícita de ajuste futuro.

---

## Ideias aprovadas para evolução

Prioridade alta:

1. Edição de registros com trilha de auditoria.
2. Ajuste manual de estoque com motivo obrigatório.
3. Multi-item por venda e pedido.
4. Relatório de contas a receber e a pagar.
5. Impressão/geração de etiqueta ou lista de separação.
6. Conversão para IndexedDB para maior volume de dados.
7. Exportação CSV por módulo.

Prioridade média:

1. Múltiplas tabelas de preço por canal.
2. Lotes e validade.
3. Comissão de vendedor ou consignado.
4. Anexar comprovante/foto/nota fiscal.
5. Controle de entregas e rastreio.

Prioridade futura:

1. SQLite local com app desktop.
2. Firebase/Supabase para multi-dispositivo.
3. App iOS/Android.
4. Painel web com login.

---

## Estado atual do MVP

Funciona localmente abrindo `controle360/index.html` no navegador.

Persistência atual: LocalStorage.

Inclui:

- cadastro de negócios;
- cadastro de produtos e custos;
- clientes;
- fornecedores;
- compras com custo médio;
- ficha técnica;
- cálculo de custo e preço sugerido;
- produção com baixa de insumos;
- vendas com CMV;
- pedidos em Kanban;
- tarefas em Kanban;
- consignado com venda, devolução e pagamento;
- relatórios básicos;
- backup JSON.

---

## Atualização: exportação/importação e interface

### Novos arquivos

```txt
controle360/src/xlsx-lite.js     # motor .xlsx em JS puro (escreve ZIP "stored", lê com a API nativa de descompressão)
controle360/src/exportImport.js  # camada de domínio: Excel completo, CSV por módulo e JSON (exportar/importar)
```

### Regras

- `controle360/src/xlsx-lite.js` é genérico e sem regra de negócio: só converte `[{name, rows}]` em `.xlsx` e de volta. Não colocar lógica de negócio aqui.
- `controle360/src/exportImport.js` define o mapa `COLLECTIONS` (coleção → aba → ordem de colunas) e os rótulos em português. Ao adicionar um campo novo a uma coleção, inclua a chave em `fields` e, se for número, em `NUMERIC_KEYS`; se for data, em `DATE_KEYS`.
- Excel é backup **completo e reversível**: a aba `Backup_NAO_EDITAR` carrega `settings`, `meta` e `activeBusinessId`. As abas de dados são a fonte de verdade dos registros.
- Importação (Excel ou JSON) passa por `state.replaceState`, que normaliza o estado. Sempre pedir confirmação antes de substituir.
- Não adicionar biblioteca externa para Excel: o motor próprio mantém o projeto offline e revisável.

### Interface

- Cabeçalho e barra de abas fixos; abas roláveis no celular; toasts para sucesso/erro (`window.C360.app.toast`).
- `window.C360.app = { refresh, toast }` é o ponto de reentrada usado por `exportImport.js` após importar.

---

## Atualização: Sistema de ajuda contextual (tooltips)

### Objetivo

Fornecer explicações simples e em linguagem acessível ("para leigos") sobre termos técnicos e campos do sistema, sem sobrecarregar a interface.

### Implementação

**CSS** (`controle360/styles/main.css`):

- `.help[data-tip]`: ícone circular verde com letra "i", 16×16px, cursor `help`.
- `.help-tip`: balão fixo (position: fixed) com fundo escuro, max-width 280px, texto branco pequeno, transição de opacidade/visibilidade.
- Viewport clamping: tooltip responde automaticamente se não couber acima (aparece abaixo), com margem de 10px da borda.
- Responsivo em mobile: max-width ajustado para `min(280px, calc(100vw - 24px))`.

**JavaScript** (`controle360/src/app.js`):

- `ensureTip()`: cria ou retorna singleton `<div class="help-tip">`.
- `showTip(target)`: lê `data-tip` do elemento, posiciona tooltip acima (ou abaixo se sem espaço), torna visível.
- `hideTip()`: remove classe `.show` (animação de saída).
- `bindHelpTips()`: escuta `mouseover`, `mouseout`, `focusin`, `focusout`, `click`, `scroll`, `resize`.

**Texto de ajuda** (`controle360/src/ui.js`):

- Dicionário `HELP` com ~22 chaves em português.
- Chaves: `valorEstoque`, `alertasEstoque`, `receitaLiquida`, `lucroBruto`, `consignadoAberto`, `pedidosPendentes`, `margemDesejada`, `taxasPadrao`, `tipoProduto`, `estoqueInicial`, `custoMedioInicial`, `precoVendaManual`, `estoqueMinimo`, `maoDeObra`, `custoFixo`, `perdaTecnica`, `margemDesejadaProduto`, `taxasProduto`, `valorTotalCompra`, `fichaTecnica`, `qtdPorUnidade`, `precoSugerido`, `qtdProduzida`, `canal`, `descontoTotal`, `taxaFixaTotal`, `taxaPercentual`, `cmv`, `precoCombinado`, `statusInicial`, `consignado`, `qtdEnviada`, `precoCombinadoConsig`.
- Função `help(keyOrText)`: gera `<span class="help" data-tip="...">i</span>`.
- Função `fieldLabel(text, helpKey)`: rótulo + ícone na mesma linha.
- Função `metric(label, value, helpKey)`: métrica do dashboard com ícone opcional.
- Função `section(title, description, content, titleHelp, right)`: seção com ícone no título (opcional).

### Como usar

**Adicionar ajuda a um campo:**

```js
// Em renderXyz():
UI.fieldLabel('Margem desejada (%)', 'margemDesejada')
```

**Adicionar ajuda a uma métrica:**

```js
UI.metric('Receita líquida', U.money(value), 'receitaLiquida')
```

**Adicionar ajuda ao título de uma seção:**

```js
UI.section('Vendas', 'Registre vendas e calcule CMV', content, 'cmv')
```

**Adicionar uma nova chave de ajuda:**

1. Edite `HELP` em `controle360/src/ui.js`.
2. Use a chave em qualquer `help(keyOrText)`, `fieldLabel`, `metric`, ou `section`.
3. Pronto: não precisa recompilar ou regenerar o arquivo mobile (veja abaixo).

### Acessibilidade

- Ícones têm `tabindex="0"` → acessíveis por teclado.
- `role="button"` + `aria-label` com texto completo.
- Funciona em desktop (hover), mobile (tap), e teclado (Tab + Enter/Space).

---

## Build mobile: sincronizar versões

### Arquivo de build

```txt
controle360/build-mobile.js    # Node.js script que inline CSS e todos os .js em um único HTML
```

### Como usar

```bash
node controle360/build-mobile.js [caminho/de/saida/controle360-mobile.html]
# Padrão: controle360/controle360-mobile.html
```

### O que faz

1. Lê `controle360/index.html`, `controle360/styles/main.css` e todos os `controle360/src/*.js`.
2. Substitui `<link href="styles/main.css">` por `<style>...</style>` com conteúdo inline.
3. Substitui cada `<script src="src/X.js">` por `<script>...</script>` com conteúdo inline.
4. Verifica se nenhuma referência externa restou (error se encontrar).
5. Salva em um arquivo HTML único (auto-contido, ~124 KB).

### Quando atualizar

**Sempre que alterar:**

- `controle360/styles/main.css`
- Qualquer arquivo em `controle360/src/` (utils, state, calculations, ui, app, exportImport, etc.)

**Depois rode:**

```bash
node controle360/build-mobile.js
```

Isso regenera `controle360/controle360-mobile.html` com as mudanças. Ambas as versões (desktop = index.html + arquivos, mobile = arquivo único) ficam sincronizadas.

### Verificação

- ✅ Desktop: abrir `controle360/index.html` (carrega CSS e JS de arquivo).
- ✅ Mobile: abrir `controle360/controle360-mobile.html` (carrega tudo inline, funciona offline 100%).
- ✅ Console: nenhuma referência externa, nenhum erro 404.

---

# Estante (`estante/`)

## Finalidade

Leitor de letras e cifras para uso **no palco**. As decisões de projeto seguem essa prioridade: abrir rápido, funcionar sem internet, ser legível a um metro de distância e não exigir digitação durante o show.

Documentação de uso: `estante/README.md`. Roteiro de teste: `estante/checklist-manual.md`.

## Arquivos

```txt
estante/
├── index.html         # estrutura da tela e diálogos
├── styles.css         # visual, modo palco e folha de impressão
├── core.js            # estado, armazenamento, APP_VERSION e fontes de letra
├── search-engine.js   # busca inteligente: várias fontes, variações, ranking e busca local
├── acervo.js          # acervo do site: letras que moram no repositório
├── acervo.json        # conteúdo do acervo (vem vazio; ver estante/acervo.md)
├── library.js         # lista, ordem do repertório, LRC, cifras, transposição, seções
├── setlists.js        # vários repertórios: criar, trocar, migrar e persistir
├── song-prefs.js      # tom, capotraste, velocidade e anotações por música
├── autoscroll.js      # velocidade de rolagem calculada pela duração
├── player.js          # abrir música, desenhar letra, rolagem, sincronia, arquivos
├── youtube-search.js  # busca de vídeo pela API do YouTube, com a chave do aparelho
├── song-edit.js       # editar a letra de uma música já aberta
├── print.js           # impressão da ordem do show
├── ui.js              # eventos da interface, atalhos e compartilhamento
├── search-ui.js       # formulário de busca e modos de fonte
├── offline.js         # registra o service worker e avisa de versão nova
├── sw.js              # cache do casco do app
├── manifest.webmanifest
└── icon.svg / icon-192.png / icon-512.png
```

Os scripts são carregados em ordem no `index.html`, sem módulos: cada arquivo declara funções globais. Ao criar um arquivo novo, inclua-o no `index.html` **e** na lista `SHELL` de `sw.js`.

## Princípios obrigatórios

### 1. Versão única

`APP_VERSION` em `core.js`, `VERSION` em `sw.js` e o `?v=` das tags do `index.html` precisam andar juntos. **Alterou qualquer arquivo do Estante, bumpe a versão nos três lugares** — senão o service worker continua servindo a versão antiga e a correção não chega ao aparelho.

### 2. Offline é requisito, não enfeite

O casco do app fica em cache; as fontes de letra e catálogo (LRCLIB, Vagalume, Deezer, Apple) nunca são cacheadas. Nenhum recurso externo (fonte, CDN, biblioteca) pode entrar na página: quebraria o uso sem internet.

### 3. O repertório é o dado sagrado

- Migração nunca apaga a chave antiga: grava a nova e deixa a velha como backup.
- `save()` avisa na tela quando o armazenamento enche; não engula o erro.
- Toda mudança de formato precisa continuar lendo os arquivos exportados anteriores.

### 4. Ajuste que pertence à música fica na música

Tom, capotraste, velocidade e anotações são por música. Preferências do aparelho (tamanho da letra, modo palco, fonte de busca, chave do Vagalume) são globais, em `KEYS.prefs`.

### 5. Gravar é caro: ajuste fino não grava a cada clique

`saveSetlists()` serializa **todos** os repertórios, com letra e tudo. Chamar isso a cada toque na pedaleira travava a rolagem no meio da música. Por isso:

- ajuste que se repete (tom, capotraste, velocidade) usa `saveSetlistsSoon()` / `updatePrefsSoon()`, que adiam a escrita por `saveSoon()` em `core.js`;
- `flushSaves()` fecha a conta em `pagehide` e ao esconder a aba;
- o que não pode se perder (adicionar, remover, mover, trocar de repertório, editar letra) continua gravando na hora;
- `persistCurrent(["campo"])` só atualiza os campos citados; sem argumento regrava a música inteira.

### 6. Importar nunca substitui sem perguntar

`importSetlist()` lê o arquivo, resume na tela (o que vem e o que seria apagado) e espera o usuário escolher **Adicionar** ou **Substituir**. Não voltar a escrever direto: uma importação por engano apaga o show inteiro.

### 7. `state.setlist` é o repertório ativo

`state.setlist` aponta para o array `songs` do repertório ativo — é a mesma referência, não uma cópia. Mexa nele com `push`/`splice`; para **substituir** a lista inteira use `setActiveSongs()`, senão a ligação com o repertório se perde e nada mais é salvo.

### 8. Uma fonte cair não pode travar a busca

O Vagalume fica fora do ar de vez em quando (erro 502/503/504 do próprio serviço, não do Estante). Por isso:

- toda chamada ao Vagalume passa por `fetchRetrying()` (`core.js`), que repete uma vez em erro passageiro do servidor — nunca em 429, que significa "espere", não "tente de novo";
- `markSource()`/`sourceDown()` registram a saúde de cada fonte nesta sessão; os chips **Brasil** e **Trecho** (que dependem só do Vagalume) mostram um sinal quando ele caiu;
- a busca **Inteligente** é a mais resistente: combina LRCLIB, Vagalume, Deezer, Apple e MusicBrainz, então uma fonte fora do ar não a derruba;
- quando um modo específico falha por causa da fonte, a busca oferece um atalho de um toque para repetir na Inteligente (`search-ui.js`).

Fontes de catálogo sem CORS para o navegador (Apple, Deezer) usam JSONP (`jsonp()` em `search-engine.js`) em vez de `fetch()` — a mesma técnica para as duas, sem biblioteca externa. LRCLIB, lyrics.ovh e MusicBrainz devolvem `access-control-allow-origin: *` e são chamadas por `fetch()` direto.

**Catálogo sem letra não é ganho automático.** Deezer, Apple e MusicBrainz não têm letra: acrescentá-los cria resultado que abre vazio. Eles valem porque devolvem álbum e duração exatos, o que faz o LRCLIB casar no `/api/get` e a lyrics.ovh acertar a grafia. Ao avaliar uma fonte nova, pergunte primeiro se ela traz letra ou se melhora a identificação — se não fizer nem uma coisa nem outra, não entra. O MusicBrainz aceita ~1 consulta por segundo: chamar só uma vez por busca, nunca dentro do laço de variações.

Antes de adicionar uma API, confira com `curl -D-` se ela devolve cabeçalho CORS. Já avaliadas e **descartadas**: ChartLyrics (fora do ar), Musixmatch e Genius (sem CORS e com chave obrigatória), TheAudioDB (campo de letra sempre vazio), lyrics.ovh/suggest (é o Deezer por baixo, redundante), Spotify (ver princípio 16).

### 9. O que está no aparelho é procurado antes da rede

`searchLocal()` (repertório salvo) e `searchAcervo()` (`acervo.js`) rodam em toda busca, antes de qualquer fonte externa. Os dois procuram **dentro do texto da letra**, não só em título e artista — é a única busca por trecho que não depende do Vagalume, e a única que funciona offline. `withLocalFirst()` põe esses resultados na frente e descarta o duplicado que vier da rede: a versão do aparelho tem a letra corrigida e o tom marcado pelo usuário.

Ao abrir uma música sem letra, a ordem de reserva é: LRCLIB → Vagalume (se houver chave) → acervo do site → `lyrics.ovh`. O acervo vem antes da rede por ser conteúdo próprio e não precisar de conexão.

### 10. O acervo do site é publicação, não cache

`acervo.json` é servido pelo GitHub Pages: o que entra ali fica publicado na internet. Letra de terceiros é obra protegida — exibir o que uma API devolve é diferente de redistribuir um acervo. Por isso o arquivo **vem vazio** e `estante/acervo.md` explica o que convém colocar (autoral, domínio público, tradicional, transcrições próprias). Não encher o acervo automaticamente com o que as APIs devolverem.

Como está no `SHELL` do `sw.js`, alterar `acervo.json` exige bump de versão — senão os aparelhos seguem com a cópia antiga.

### 11. Toque na letra sincronizada nunca reposiciona sozinho

Cada linha de uma letra `.lrc` é clicável. Um toque só **pausa** — igual à rolagem automática. Reposicionar o relógio exige **toque duplo** na mesma linha, dentro de `DOUBLE_TAP_MS` (`player.js`, `tapSyncLine`). Existe porque apoiar o dedo na tela para segurar o tablet é gesto comum no palco: sem essa trava, o toque sozinho saltava o tempo da música e ligava a sincronia por conta própria, no meio da apresentação.

### 12. Letra sincronizada tem cifra, transposição e seções como letra comum

`.lrc` passa pelo mesmo `classify()` da letra colada (`player.js`, `renderCurrentLyrics`): cifra, tom, capotraste e atalhos de seção funcionam igual, sincronizada ou não. `parseLRC` (`library.js`) remove só a marca de tempo e os cabeçalhos do formato (`[ar:]`, `[ti:]`, `[offset:]`, via `LRC_META`) — nunca apague tudo entre colchetes: isso levava junto o `[Refrão]` escrito na letra.

Pular para uma seção (`scrollToLine`, `library.js`) tem dois casos por causa da rolagem:

- com a sincronia ligada, mover o relógio (`seekSync`) em vez de só rolar a tela — senão a letra volta sozinha para onde a sincronia estava;
- com a rolagem automática ligada, saltar sem animação (`behavior:"auto"`) — o `"smooth"` briga com o `scrollTop` que o `tick()` escreve a cada quadro e o salto não acontece.

### 13. O link de compartilhamento pode levar a letra

`makeShareUrl()` (`ui.js`) é assíncrono e tem duas opções: **com as letras** (`comLetras:true`, campo `v:2`) leva `lyrics`, `synced`, `instrumental`, `source` e `notes` de cada música — o repertório recebido abre sem internet. **Só a ordem** manda título, artista, álbum, duração, tom e capotraste; quem recebe precisa buscar cada letra depois. Tom e capotraste vão nas duas formas — são dois números, e a banda precisa deles mesmo sem a letra.

O link usa `CompressionStream("deflate-raw")` quando o navegador tem (marca `#setlistz=`); sem isso, cai para JSON puro (`#setlist=`, igual ao formato antigo `v:1`, que continua sendo lido). É API nativa do navegador, não biblioteca externa — não adicionar uma para isso. Acima de `LINK_LONGO` (8000 caracteres) o diálogo avisa que aplicativos de mensagem costumam cortar o link ao colar, e sugere Exportar como alternativa.

### 14. Karaokê: o `<iframe>` é uma exceção com limites, não uma porta aberta

`karaoke.js` toca vídeo do YouTube com a letra por cima, para festa — modo à parte de Rolar/Sincro/Palco, nunca dois ligados juntos (`toggleScroll`/`toggleSync` recusam ligar com `state.karaoke` ativo; os três escreveriam no mesmo `scrollTop` ou no mesmo relógio).

Um `<iframe>` de outra origem **não** viola "nada de biblioteca externa nem CDN": é um documento à parte, com o JavaScript dele rodando no contexto dele, invisível para `sw.js` (que devolve toda origem estranha direto pra rede, sem cachear — princípio já existente). Mas a exceção tem uma borda exata:

- **O iframe só é criado por JS depois de um gesto do usuário** (`ensureFrame()`, chamado de `enterKaraoke()`), nunca como `<iframe src>` estático no `index.html` — isso acrescentaria rede ao primeiro carregamento e furaria o casco offline.
- **Nunca carregar `https://www.youtube.com/iframe_api`** nem qualquer script do Google na página. O protocolo `postMessage` é falado na mão — conferido lendo o `www-widgetapi.js` do próprio Google nesta sessão, não documentado oficialmente, mas estável na prática. Se um bug de sincronia parecer pedir a API oficial, a resposta certa é revisar `karaokeTime()`/`aplicarInfo()`, não adicionar o script.
- **A ausência do karaokê nunca pode degradar o resto do app.** Sem internet, sem vídeo escolhido, ou vídeo que recusa embutir: o app cai para Rolar/Sincro normal em um toque — nunca trava a música que já estava tocando.
- `postMessage` sempre com `targetOrigin` explícito (`https://www.youtube-nocookie.com`), nunca `"*"`; `ytOnMessage` confere origem **e** `e.source === iframe.contentWindow` antes de aceitar qualquer coisa.

**Um iframe só, para a sessão inteira**, reaproveitado por `loadVideoById` — não um por música. No iOS o gesto do usuário não atravessa iframe de outra origem: um elemento de mídia novo a cada troca exigiria toque a cada música, e encadear a fila ficaria impossível. `autoplayComprovado` registra, nesta sessão, se o navegador já deixou tocar por programa; só aí `aoTerminarMusica()` avança sozinho — sem essa prova, mostra "toque em › para a próxima" em vez de deixar a festa olhando uma tela muda.

**O relógio não é o `performance.now()` do app.** `infoDelivery` chega a cada ~250ms, não a cada quadro; `karaokeTime()` extrapola entre entregas com o mesmo teto de 1s que o próprio `getCurrentTime` do Google usa (conferido no código-fonte) — sem o teto, um iframe travado faria a letra disparar sozinha. `avaliarAnuncio()` compara a duração relatada com a duração real da música: durante um anúncio a duração bate diferente, e a letra congela em vez de correr durante o comercial.

```txt
tempoDaLetra = tempoDoVídeoExtrapolado − videoOffset − audioDelay
```

`videoOffset` (por música, salvo com `rememberSongPref`) corrige a introdução do upload do YouTube; `audioDelay` (do aparelho, em `estante:v2:prefs`) corrige o atraso da caixa Bluetooth. Os dois **subtraem** — os botões usam sinal, mas a mensagem sempre descreve o efeito ("letra atrasada/adiantada"): não dá pra exigir que alguém raciocine sobre convenção de sinal no meio da festa.

Sem `.lrc` (a maioria das músicas), `karaokeScrollPosition()` não destaca linha: rola pelo `scrollTop = progresso × scrollDistance()`, onde `progresso` vem da fração já tocada, não de velocidade — por ser posição, não acumula erro, e um salto no vídeo reposiciona a letra na hora. Um toque na tela abre uma janela de rolagem manual (`manualAte`) para o dedo não ser puxado de volta no quadro seguinte.

`stopAll()` (chamado por `openSong`, Escape, edição de letra) **pausa** o vídeo sem sair do modo karaokê — sair a cada troca de música apagaria o karaokê a cada música da fila. `openSong()` troca o vídeo **antes** do `await` da busca de letra (que pode esperar até 12s de rede): se ficasse atrás, o áudio da música anterior continuaria saindo da caixa com a tela já mostrando o título da próxima.

`state.karaoke` (modo) e `state.videoPlaying` (relógio andando) são campos separados de propósito: `videoPlaying` é espelho do que o player informa — nunca chute nosso — porque anúncio, buffer ou um toque dentro do próprio vídeo mudam o estado sem passar pelo app. Nenhum dos dois é persistido: modo de festa não deve voltar sozinho no dia seguinte.

### 15. A pedaleira é opcional, e o modo muda só o que é DESENHADO

`pedalMode` (`estante:v2:prefs`, preferência do aparelho) tem dois valores.
`"toque"` é o padrão: a `.transport` sai da tela e sobram `#mainFab` — a ação
do momento, decidida por `fabAction()` em `core.js` — e o `#tweakBtn`, que traz
a barra de volta como **sobreposição**. Ela é `position:absolute` de propósito:
abrir e fechar não muda a altura do `.paperViewport`, e a velocidade automática
é calculada em cima dessa altura. `"pedaleira"` é a barra de sempre, sem
diferença nenhuma — palco não pode regredir.

O que **nunca** muda com o modo é o teclado: o `keydown` de `ui.js` responde
igual nos dois. Pedal Bluetooth continua funcionando para quem nunca abriu
Ajustes. Trocar de modo chama `applyAutoSpeed()` porque a altura útil mudou.

O app não pergunta nada no primeiro uso: `offerPedalMode()` oferece a barra
**uma vez**, quando chega a primeira tecla de pedaleira, e registra
`pedalOffered`. Acerta sozinho no palco sem atrapalhar quem só quer ler a letra,
e não exige que ninguém saiba o que "pedaleira" significa antes de usar o app.

`.chip` é usada por três grupos hoje (fonte de busca, tipo de vídeo, forma de
controle). Quem varre chips precisa filtrar pelo `data-` do próprio grupo —
`document.querySelectorAll(".chip")` apagava o `active` dos outros dois.

### 16. Busca de vídeo: a chave é do aparelho e a reserva é obrigatória

`youtube-search.js` fala com a API de dados do YouTube por `fetch()` direto
(`googleapis.com` devolve cabeçalho CORS, diferente da Apple e da Deezer, que
exigem JSONP). A chave fica em `keyYT`, só no aparelho, como a do Vagalume:
nunca no link compartilhado, nunca no arquivo exportado.

A cota gratuita é 10.000 unidades por dia e uma busca custa 100 — daí o cache
em memória de sessão (nunca `localStorage`, nunca service worker: continua
valendo não cachear resposta de API) e daí as mensagens de erro precisarem
dizer o que fazer, não o número do erro.

**Sem chave, o karaokê tem de continuar inteiro.** Colar o link e o
`Procurar no YouTube ↗` não são resquício: são o caminho de quem não cadastrou
chave e de quem estourou a cota do dia. Não os remova ao mexer na busca.

`videoEmbeddable=true` é filtrado na origem — vídeo que recusa embutir abre
preto com a festa esperando. A segunda chamada (`videos.list`, 1 unidade) traz
a duração, que é o que denuncia o "1 hour loop" e o que permite avisar, ao
anexar, quando o vídeo é bem mais longo que a música: sem `.lrc` a rolagem usa
a duração da MÚSICA, então a letra terminaria fora de hora.

### 17. Aviso que ninguém vê é aviso que não existe

`#notice` morava dentro da `.sidebar`, que no celular fica fora da tela
(`translateX(-101%)`) enquanto uma música está aberta. Resultado: nenhuma
mensagem chegava a quem tinha o telefone na mão — justamente o público de todas
as mensagens do karaokê. Agora é filho de `<body>`, `position:fixed` acima da
pedaleira, e não pode voltar para dentro de `.sidebar` nem de `.stage`
(`overflow:hidden` cortaria o balão).

`notify()` agenda o sumiço, **menos** quando a mensagem traz `<button>`: aviso
que pede decisão (o atalho "Tentar na Inteligente") espera o usuário e ganha um
× no lugar do relógio.

### 18. Spotify: avaliada e descartada

Não reavaliar sem motivo novo. Tocar dentro do app pelo Web Playback SDK exige
Premium completo (planos mobile-only não servem) **e** carregar
`sdk.scdn.co/spotify-player.js` na página — script de terceiro, o que o
`<iframe>` do YouTube justamente não é. O embed grátis toca 30 segundos para
ouvinte sem Premium, e ler o relógio dele dependeria do `iframe-api` do próprio
Spotify, script externo de novo. Como catálogo, `api.spotify.com` devolve 401
sem token: exigiria login para entregar título, artista, álbum e duração, que
Deezer, Apple e MusicBrainz já dão sem login — e `preview_url` volta nulo para
apps novos, `audio-features`/`audio-analysis` estão descontinuados para
cadastros novos, e letra a Spotify não expõe.

## Modelo de dados

```js
// localStorage["estante:v3:setlists"]
{ version:3, activeId, setlists:[ {id, name, date, songs:[música]} ] }

// cada música
{ title, artist, album, duration, lyrics, synced, instrumental, source, vagUrl,
  key,    // transposição em semitons
  capo,   // casa do capotraste (só afeta a exibição)
  speed,  // velocidade de rolagem desta música
  auto,   // true = velocidade calculada pela duração, ignorando speed
  notes,  // anotação de palco
  videoId,      // id do vídeo do YouTube usado no karaokê desta música
  videoOffset } // segundos: posição no VÍDEO onde a letra começa (introdução)
```

Outras chaves: `estante:v2:prefs` (preferências do aparelho — inclui `audioDelay`, o atraso da caixa Bluetooth; `keyYT`, guardada só no aparelho como a do Vagalume; e `pedalMode`, a forma de controle) e `estante:v2:setlist` (formato antigo, mantido como backup após a migração).

Cifras exibidas = `transposeLine(linha, key - capo)`, via `chordShift()`.

Velocidade automática = `(fim da última linha − altura da tela) / (duration − LEAD_IN)`, em `autoscroll.js`. Medir pelo `scrollHeight` inclui os 55vh de preenchimento do papel e os créditos — deixava a velocidade 21% rápida demais. `atScrollEnd()` (`player.js`) usa a mesma medida, para a rolagem parar na última linha em vez de continuar para dentro do vazio.

O quadro da rolagem tem teto (`MAX_DT`, em `player.js`): `requestAnimationFrame` congela com a aba escondida e, sem limite, o primeiro quadro na volta cobrava todo o tempo ausente — 40 s viravam um salto de 720 px que costumava desligar a rolagem.

Rolagem, sincronia e karaokê dividem **um `requestAnimationFrame` só** (`raf`, em `core.js`) através de `startTick()`/`stopTickIfIdle()` (`player.js`): ninguém desliga o laço sem conferir se sobrou algum dos três precisando dele, e ninguém liga um segundo laço por cima de um que já roda. Antes do karaokê, rolagem e sincronia eram dois modos que nunca coexistiam e cada um podia cancelar o laço na saída sem checar nada; um terceiro interessado quebraria isso.

Wake lock precisa de `releaseAwake()`: pedir sem liberar deixa a tela acesa até a aba fechar. A guarda de quando liberar (`player.js`) e quando pedir de volta ao voltar à aba (`ui.js`, `visibilitychange`) é a mesma em três lugares: `state.stage||state.scrolling||state.syncing||state.karaoke`. Esquecer o karaokê em um dos três apaga a tela no meio da música ou deixa acesa a noite toda.

## Regras para próximas alterações

1. Cálculo de cifra, LRC, seções e ordenação do repertório ficam em `library.js`; ajuste por música em `song-prefs.js`; velocidade automática em `autoscroll.js`; edição de letra em `song-edit.js`; persistência de repertório em `setlists.js`; iframe, protocolo e relógio do karaokê em `karaoke.js`; busca de vídeo e o fluxo do diálogo dela em `youtube-search.js`. Não empilhe lógica nova em `ui.js` — lá ficam só os eventos.
2. Alterou formato de dado? Atualize a migração, o export/import e o `estante/README.md`.
3. Bumpe a versão (princípio 1) e inclua arquivos novos no `SHELL` do `sw.js`.
4. Teste servindo por HTTP; service worker não roda em `file://`.
5. Rode `estante/checklist-manual.md` antes de publicar.

## Não fazer

- Não adicionar biblioteca externa, CDN ou fonte remota.
- Não cachear resposta das APIs de letra.
- Não guardar a chave do Vagalume nem a do YouTube fora do aparelho, nem enviá-las a outro serviço.
- Não apagar repertório do usuário em migração ou importação sem confirmação.
- Não deixar a busca de vídeo sem reserva: sem chave e sem cota, colar link e o atalho do YouTube são o caminho (princípio 16).
- Não fazer o modo de controle mexer no que as teclas fazem — ele decide só o que aparece na tela (princípio 15).
- Não devolver `#notice` para dentro da barra lateral (princípio 17).
- Não transformar preferência do aparelho em ajuste por música (nem o contrário) — `audioDelay` é do aparelho, `videoOffset` é da música, e não é o mesmo engano ao contrário: um não deve nunca escrever no outro.
- Não carregar `iframe_api` do YouTube nem qualquer script de terceiro na página — o karaokê fala o protocolo `postMessage` na mão (princípio 14). Um bug de sincronia não é motivo para adicionar o script.

## Ideias para evolução

Prioridade alta:

1. Metrônomo com tap tempo e BPM por música (`AudioContext` com oscilador, sem arquivo de áudio, para não quebrar o offline).
2. Reordenar o repertório arrastando.
3. Mostrar o tom pelo nome da nota (`Sol → Lá`) em vez de `+2`, deduzindo o tom original das cifras.

Prioridade média:

1. Data e local no repertório, com agenda de shows.
2. Mapeamento configurável de pedaleira Bluetooth (modo "aprender a tecla").
3. Duas colunas para letras longas em tablet, ou encaixar a música inteira na tela.
4. Conversão para IndexedDB quando o repertório crescer.
5. Lembrete de backup: hoje o repertório vive só no `localStorage`.
6. Reordenar a fila da festa arrastando, com a marca **vídeo** já visível na lista.

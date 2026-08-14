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
├── search-engine.js   # busca inteligente: várias fontes, variações e ranking
├── library.js         # lista, ordem do repertório, LRC, cifras, transposição, seções
├── setlists.js        # vários repertórios: criar, trocar, migrar e persistir
├── song-prefs.js      # tom, capotraste, velocidade e anotações por música
├── autoscroll.js      # velocidade de rolagem calculada pela duração
├── player.js          # abrir música, desenhar letra, rolagem, sincronia, arquivos
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
- a busca **Inteligente** é a mais resistente: combina LRCLIB, Vagalume, Deezer e Apple, então uma fonte fora do ar não a derruba;
- quando um modo específico falha por causa da fonte, a busca oferece um atalho de um toque para repetir na Inteligente (`search-ui.js`).

Fontes de catálogo sem CORS para o navegador (Apple, Deezer) usam JSONP (`jsonp()` em `search-engine.js`) em vez de `fetch()` — a mesma técnica para as duas, sem biblioteca externa.

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
  notes } // anotação de palco
```

Outras chaves: `estante:v2:prefs` (preferências do aparelho) e `estante:v2:setlist` (formato antigo, mantido como backup após a migração).

Cifras exibidas = `transposeLine(linha, key - capo)`, via `chordShift()`.

Velocidade automática = `(altura da letra − altura da tela) / (duration − LEAD_IN)`, em `autoscroll.js`.

## Regras para próximas alterações

1. Cálculo de cifra, LRC, seções e ordenação do repertório ficam em `library.js`; ajuste por música em `song-prefs.js`; velocidade automática em `autoscroll.js`; edição de letra em `song-edit.js`; persistência de repertório em `setlists.js`. Não empilhe lógica nova em `ui.js` — lá ficam só os eventos.
2. Alterou formato de dado? Atualize a migração, o export/import e o `estante/README.md`.
3. Bumpe a versão (princípio 1) e inclua arquivos novos no `SHELL` do `sw.js`.
4. Teste servindo por HTTP; service worker não roda em `file://`.
5. Rode `estante/checklist-manual.md` antes de publicar.

## Não fazer

- Não adicionar biblioteca externa, CDN ou fonte remota.
- Não cachear resposta das APIs de letra.
- Não guardar a chave do Vagalume fora do aparelho nem enviá-la a outro serviço.
- Não apagar repertório do usuário em migração ou importação sem confirmação.
- Não transformar preferência do aparelho em ajuste por música (nem o contrário).

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

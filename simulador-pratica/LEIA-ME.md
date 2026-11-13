# Painel de prática (simulação 100% fictícia)

Painel somente leitura para acompanhar **preços ao vivo**, as **operações fictícias** do experimento e as **operações públicas observadas** de carteiras de terceiros. Independente dos arquivos, estado, banco e rotinas do agente TRADER CRIPTO: aqui só se **lê** um retrato dos registros. Sem botões de negociar, sem conta real, sem ordens, sem dinheiro real.

## Como abrir
Dê dois cliques em `index.html` (navegador; precisa de internet para os preços). Não precisa instalar nada nem iniciar servidor.

## O que é ao vivo e o que não é
| Parte | Fonte | Atualização |
| --- | --- | --- |
| Cotações BTC/ETH/SOL em reais e variação 24 h | Binance (dados públicos, Binance Vision) | conexão contínua (WebSocket `wss://data-stream.binance.vision`, miniTicker) quando conectada; se cair ou ficar 20 s sem mensagem, consulta a cada 15 s e reconecta (espera de 1 a 30 s) |
| Avaliação das carteiras fictícias | cotações acima | junto com os preços; preço desatualizado marca a avaliação como aproximada (≈); sem preço, o total vira "—" (nunca R$ 0,00) |
| EUR/BRL | Frankfurter | **taxa diária de referência**, consultada a cada 30 min; não é preço intradiário nem cotação executável de Forex; mostra a data da taxa |
| Execuções públicas das carteiras acompanhadas | Hyperliquid (`userFills`, `wss://api.hyperliquid.xyz/ws`) | conexão contínua; ao conectar chegam as últimas execuções (**histórico recente**) e depois as novas (**ao vivo**). Só na memória da aba, nada é gravado |
| Decisões, compras/vendas fictícias, patrimônio registrado, carteiras acompanhadas | rotina do agente → banco OpenBot → `dados.js` | **só quando a rotina horária grava e o `dados.js` é atualizado** |

A página **não decide nem executa**. A faixa "Estado dos dados por mercado" mostra, para cada dado, fonte, forma de atualização, idade e um selo em texto (Ao vivo, Consulta periódica, DESATUALIZADO, SEM COTAÇÃO, ATRASADOS, Conectada, Caiu/reconectando, Pausada).

Separação visual: **SIMULAÇÃO** (verde: minhas carteiras e operações fictícias) × **TERCEIROS · OBSERVAÇÃO** (azul: carteiras públicas). Operações públicas nunca alteram caixa, posição nem desempenho. Cada linha pública traz autor (endereço público), fonte, hora da execução e hora em que foi recebida na aba. Não há link de publicação porque o dado vem de API, não de postagem. As duas carteiras não são somadas num "total" único.

## Arquivos
- `index.html`: a página.
- `nucleo.js`: cálculo da carteira (mesma contabilidade do motor: R$ 1.000 por mercado, taxa 0,1%), formatação, leitura de mensagens ao vivo e validação. Sem rede.
- `dados.js` / `dados.json`: retrato de exibição **gerado** (não editar à mão).
- `atualizar_dados.py`: empacotador (lê consultas por `stdin` ou arquivos; grava `dados.*`). Não acessa banco, SQLite nem rede.
- `teste_nucleo.js` (`node --test teste_nucleo.js`) e `teste_atualizar.py` (`python -I teste_atualizar.py`): testes.
- `entrada/`: resultados de consulta que geraram o primeiro retrato (exemplo de formato; os dados atuais vêm de `stdin`).

## Instruções para a rotina OpenBot (atualizar após cada rodada horária)
A rotina é quem tem acesso ao banco, **só pelas ferramentas OpenBot** (`openbot.query_data`). Nunca ler o arquivo SQLite por fora. O empacotador só recebe texto.

**Passo 1. Saber o que já está no painel** (na pasta do painel):
`python -I atualizar_dados.py --ultimo-id` imprime, por exemplo, `{"registros": 15, "ordens": 0, "traders": 5, "metricas": 5, "operacoes": 0, "altas": 0}` (maior `id` de cada tabela já presente; 0 se vazio).

**Passo 2. Contagens do banco** (uma consulta):
```sql
SELECT 'registros' AS t, COUNT(*) AS n FROM simulacao_trade_registros
UNION ALL SELECT 'ordens', COUNT(*) FROM simulacao_trade_registros WHERE tipo IN ('compra','venda')
UNION ALL SELECT 'traders', COUNT(*) FROM acompanhamento_traders
UNION ALL SELECT 'metricas', COUNT(*) FROM acompanhamento_traders_metricas
UNION ALL SELECT 'operacoes', COUNT(*) FROM acompanhamento_traders_operacoes
UNION ALL SELECT 'altas', COUNT(*) FROM acompanhamento_altas
```
Vira uma linha `{"contagem": {"registros": N, "ordens": N, "traders": N, "metricas": N, "operacoes": N, "altas": N}}`.

**Passo 3. Só o que é novo, paginado por `id`** (placeholder `?` com o valor do passo 1; repetir cada consulta com o maior `id` recebido até vir menos de 500 linhas e `"truncated": false`):
```sql
SELECT id, chave, experimento, mercado, instante_utc, ativo, tipo, preco, quantidade, valor_brl, taxa_brl, saldo_brl, patrimonio_brl, motivo, fonte
  FROM simulacao_trade_registros WHERE id > ? ORDER BY id LIMIT 500
SELECT id, chave, endereco, instante_utc, roi_semana, roi_mes, pnl_mes_usd, conta_usd, fonte
  FROM acompanhamento_traders_metricas WHERE id > ? ORDER BY id LIMIT 500
SELECT id, chave, endereco, instante_utc, ativo, direcao, preco, quantidade, resultado_fechado, taxa, unidade_taxa, fonte
  FROM acompanhamento_traders_operacoes WHERE id > ? ORDER BY id LIMIT 500
SELECT id, chave, instante_utc, par, variacao_24h_pct, volume_24h_brl, preco_brl, fonte
  FROM acompanhamento_altas WHERE id > ? ORDER BY id LIMIT 500
```
`traders` (poucas linhas, cadastro): `SELECT id, endereco, plataforma, selecionado_utc, roi_semana_inicial, roi_mes_inicial, pnl_mes_usd_inicial, volume_mes_usd_inicial, criterio FROM acompanhamento_traders ORDER BY id LIMIT 500` (sempre inteiro).

**Passo 4. Enviar tudo por `stdin`, sem arquivo intermediário.** Uma linha JSON por resultado: copie o retorno de `query_data` **sem alterar** (`columns`, `rows`, `truncated`) e acrescente `"tabela"` (`registros`, `traders`, `metricas`, `operacoes` ou `altas`). Páginas da mesma tabela = várias linhas. Exemplo (Bash, heredoc com aspas para o texto não ser reinterpretado):
```bash
python -I atualizar_dados.py --stdin --mesclar <<'EOF'
{"contagem":{"registros":16,"ordens":1,"traders":5,"metricas":5,"operacoes":0,"altas":0}}
{"tabela":"registros","columns":["id","chave",...],"rows":[[16,"...",...]],"truncated":false}
{"tabela":"traders","columns":[...],"rows":[...],"truncated":false}
EOF
```
`--mesclar` junta com o `dados.json` atual e **nunca descarta compras/vendas antigas**; tabelas não enviadas são mantidas. Sem `--mesclar`, as tabelas enviadas substituem as atuais (use para refazer do zero, e então envie tudo, paginado).

**Passo 5. Conferir o resultado.** Código de saída 0 = gravado (a saída resume as tabelas e "conferidas com o banco"). **Código 1 = recusado, nada foi gravado** e a mensagem diz o motivo; corrija e repita, sem insistir às cegas. Código 2 = uso errado.

### O que o empacotador recusa (e por quê)
- `"truncated": true`, ou 500 linhas sem `"truncated": false` (pode haver mais: paginar).
- Contagem do banco diferente do pacote final: falta uma página/linha. `contagem.ordens` é **obrigatória** quando `registros` é enviado (use `--sem-contagem` só conscientemente).
- Saldo impossível: venda sem posição ou caixa negativo = falta compra/venda (mesma regra do motor).
- Chave repetida com conteúdo diferente, campo obrigatório ausente, número inválido/NaN, linha com número de colunas diferente do cabeçalho, tabela desconhecida, JSON quebrado, entrada que não é UTF-8.
- Escrita: tudo é validado antes; `dados.json` e `dados.js` vão primeiro para arquivos temporários e só depois substituem os atuais. Se qualquer verificação falhar, os arquivos atuais ficam intactos.

### Limites práticos (honestos)
- A rotina é um agente que precisa **colar o texto** das consultas no comando. Por isso o modo incremental (só `id` novo) é o recomendado: a cada rodada são ~15 linhas. Uma recarga completa de milhares de linhas é possível, mas cara.
- A contagem prova que nada ficou de fora, mas não detecta linha **alterada** no banco depois de enviada (as tabelas são de acréscimo). Para refazer do zero, use sem `--mesclar` e envie tudo.
- O Windows lê `stdin` pelo console; o script força UTF-8 (acentos conferidos em teste).

## No GitHub (repositório `teste1`, pasta separada)
- **Código:** pasta `simulador-pratica/` na `main` (uma ferramenta = uma pasta, como pede o `CLAUDE.md` do repositório). Nenhum outro projeto é alterado. Site: `https://alusionbr.github.io/teste1/simulador-pratica/`. O deploy existente já copia pastas novas da raiz; não foi preciso mudar o workflow.
- **Operações salvas no site:** a página lê o retrato mais novo do ramo `dados-simulador` (`simulador-pratica/dados.json`, via raw.githubusercontent.com) e usa o `dados.js` da `main` só como ponto de partida. Assim cada rodada nova aparece no site **sem commit na `main` e sem novo deploy** dos outros projetos (que são pesados: File360 e Financeiro360).
- **Como publicar uma rodada** (depois de `atualizar_dados.py`): `python -I publicar_github.py` (usa o `gh` já logado; só grava no ramo `dados-simulador`, criado vazio na primeira vez; `--dry-run` valida sem enviar). O CDN do GitHub pode levar até ~5 minutos para refletir; a página confere o GitHub a cada 5 minutos e mostra a origem do arquivo e se o GitHub está indisponível.
- **Privacidade:** o repositório e o site são **públicos**. O retrato publicado contém a simulação fictícia (registros, decisões, patrimônio) e a lista das 5 carteiras públicas da Hyperliquid acompanhadas, com suas métricas. Não contém chaves, senhas nem dados de contas reais. As execuções públicas "ao vivo" não são gravadas em lugar nenhum.
- **Atenção:** o `CLAUDE.md` do repositório descreve ferramentas offline, sem biblioteca de terceiros; esta usa só JavaScript puro, mas precisa de internet para preços (Binance, Frankfurter, Hyperliquid) e para ler o ramo de dados.

## Limitações do painel
- Sem a atualização acima, os registros ficam parados; a faixa de estado avisa ATRASADOS após 2 h.
- Se a Binance/Frankfurter/Hyperliquid falhar, o painel mostra o último valor **com a idade** e o selo DESATUALIZADO; nunca apresenta ausência como zero.
- Não antecipa saídas por limite de perda/ganho (decisão da rotina, em horários discretos, sem ordens de proteção garantidas). Sem deslizamento.
- Hyperliquid é derivativo em dólar, diferente das simulações em reais; os nomes de ativo vêm como a plataforma informa (ex.: `@151`). Limite de 10 carteiras por assinatura.
- Testado no Chrome via servidor local temporário. A abertura direta por `file://` não foi testada em navegador (as APIs têm CORS aberto).

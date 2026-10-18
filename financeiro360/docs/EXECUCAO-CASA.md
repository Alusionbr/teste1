# Execução do plano da casa

Autorização recebida em 05/10/2026. Implementação com Sol, revisão e publicação por lotes conforme [plano aprovado](PLANO-EVOLUCAO-CASA.md).

## Primeiro lote — S01–S03

Base: `4e8800d5a81e3cd3b55dc75b96b5af7bc8d888c7`.

- S01: código atual reproduzido, instruções conferidas e documentação operacional atualizada. Testes de domínio, 26 verificações locais de acesso/contabilidade e typecheck da base passaram.
- S02: implementado neste lote. Formulários por tarefa, campos condicionais, escolha do valor conhecido antes do valor e preservação do preenchimento em falhas.
- S03: detalhe mensal e prévia implementados neste lote. Linhas exatas da fatura mensal, número da parcela, centavos e prévia segura com datas incompletas.

Esta entrega mantém o valor armazenado como total único da compra. Não importa relatório, recalcula valores reais, altera configurações globais de Auth ou modifica objetos de outros aplicativos.

## Próximas dependências

A navegação por mês de vencimento e o ajuste manual da primeira cobrança previstos em S03 dependem de S04 e ficam adiados; não estão implementados por esta correção do detalhe mensal.

S04 exige congelar o cronograma no servidor e definir edição de datas/cartões antes de mudar a navegação para mês de vencimento ou permitir ajuste da primeira cobrança. Neste lote, a competência ainda segue o ciclo de fechamento existente e o vencimento é mostrado separadamente.

S05–S09 introduzem navegação, personalização e explicação dos totais, preparados localmente. S10–S15 ampliam planejamento, mercado e despensa. S16–S22 tratam rotinas, manutenção, refeições, alertas e integrações opcionais. Esses itens continuam pendentes; o plano completo não está concluído com o primeiro lote.

## Verificação de entrega

Testes de domínio, typecheck e build passaram. O navegador automatizado passou em desktop e celular: total e valor por parcela, centavos e mudança de ano, edição de cartão pendente, conta a pagar, erro com preservação de campos, receita com conta, pagamento de fatura e privacidade da demonstração. Revisão financeira independente não encontrou bloqueadores no diff final. A publicação será conferida após o merge. Dados sintéticos são usados nas verificações. Testes locais não comprovam usabilidade com pessoas reais nem substituem a conferência das configurações remotas de Auth e Storage.

## Navegação, aparência e leitura do mês — S05–S09 (implementação local)

A barra inferior e os destinos principais apresentam Início, Dinheiro, Compras, Casa e Perfil. As áreas financeiras específicas ficam em “Mais seções” e também no seletor de seções. O painel agora explica separadamente gastos lançados, valores a pagar no mês do vencimento e saídas registradas das contas; um pagamento parcial reduz a fatura sem criar outro gasto.

## Aparência pessoal — S07–S08 (implementação local)

O modo simples inicia com gasto, conta a pagar e receita; o modo completo revela transferências e pagamentos avançados. Cada pessoa pode escolher tema, paleta, texto maior, espaçamento e ocultação visual dos valores. No painel, pode marcar, retirar e mudar a ordem de três blocos usando botões acessíveis, além de escolher atalhos. Há uma ação para restaurar o padrão. A demonstração guarda escolhas separadas por participante durante a sessão; contas reais usam `fin_preferences` por usuário com RLS, vínculo ativo e revisão para rejeitar gravação desatualizada.

Migração aditiva `20261005055306_family_preferences.sql`, interface e teste local preparados. O teste com PostgreSQL local confirma que administrador e membro só acessam suas próprias preferências, que suspensão bloqueia o acesso e que uma revisão antiga não substitui outra. Antes de publicar esta etapa, aplicar a migração, conferir grants/RLS no servidor ativo e publicar o frontend correspondente. O projeto ativo é compartilhado; a migração cria somente objetos `fin_*` e função exclusiva em `fin_private`. Para retorno, publicar a interface anterior; a tabela aditiva pode permanecer sem alterar lançamentos.

## Casa: mercado, despensa e rotina — S12, S14 e S16 (implementação local)

Revisão voltada ao uso doméstico. Problemas encontrados e tratados:

- No mercado, todos os itens começavam marcados e a compra partia do total estimado: era fácil registrar como comprado o que ficou na prateleira. Agora nada começa marcado, cada item tem quantidade e preço editáveis e a soma é conferida com o total do cupom.
- A atualização automática a cada 60 s redesenhava a tela e apagaria o carrinho no meio da compra. O carrinho fica em memória (`cart` em `app.ts`) e a atualização automática espera enquanto há um campo em foco.
- A sugestão de compra arredondava ruído de ponto flutuante para cima (0,9 kg virava 0,91 kg). Corrigido com `roundUpHundredths` e teste.
- A despensa só tinha "Ajustar estoque". Agora há locais, atalhos de uso/perda/acabou/conferir, alerta de validade, duração em linguagem simples e total de desperdício.
- Não existia rotina doméstica. Agora há tarefas compartilhadas com responsável, prazo e repetição.

Arquivos: regras puras em `src/family/home.ts` (testes em `home.test.ts`); telas e eventos em `app.ts`; operações em `api.ts`; migração aditiva `supabase/migrations/20261018100000_household_routine.sql` (teste em `tests/household-db.test.mjs`).

### Banco

A migração adiciona `fin_pantry.location` (padrão `kitchen`), `fin_pantry_events` (histórico, só leitura e inserção), `fin_tasks` e as funções `fin_pantry_move` e `fin_complete_task`. Não altera lançamentos, faturas, preferências nem objetos de outros aplicativos.

Enquanto a migração não for aplicada, o aplicativo publicado continua funcionando: `api.householdReady` fica falso, a rotina mostra "aguardando ativação", o campo de local não é enviado e "Usei/Acabou/Perdi" atualizam a quantidade sem histórico. Depois de aplicar, recarregar a página ativa tudo.

Regras: tarefas são visíveis a todos os membros ativos da casa; apagar exige ser quem criou ou o administrador; concluir registra quem fez; a próxima data conta a partir do dia em que foi feita (mensal ajusta para o último dia de meses curtos); `previous_id` único impede duplicar a próxima ocorrência; responsável suspenso não é levado para a próxima. Perda vale quantidade × último preço conhecido.

### Verificação

`npm test` (36), `npm run test:db` (3 suítes, incluindo a nova), `npm run typecheck`, build e `tests/browser-smoke.mjs` em desktop e celular 390 px: compra parcial, carrinho preservado após re-renderização, diferença com o cupom, último preço, uso, perda, filtro por local, conclusão de tarefa semanal e criação por modelo. Dados fictícios da demonstração. Não foi testado com o banco real nem com duas pessoas usando ao mesmo tempo.

### Pendências e próximos passos

1. Aplicar a migração no banco de produção (decisão do proprietário) e conferir RLS/advisors.
2. Concluir compra no cartão: `fin_complete_purchase` só registra pagamento à vista; exige nova versão da função com parcelas.
3. Consumo medido: usar `fin_pantry_events` para sugerir a duração real de cada produto.
4. Lotes com validades diferentes (S14 completo) e comparação de preço por kg/litro (S15).
5. Refeições e receitas ligadas à despensa (S18) e lembretes/notificações de tarefas (S20).

### Como continuar em outra sessão ou ferramenta

Leia este arquivo, `PLANO-EVOLUCAO-CASA.md` e `src/family/home.ts`. Regras de negócio novas vão em `home.ts` com teste; regra que precisa valer para todos os aparelhos vai também no banco, em migração nova e aditiva, com teste em `tests/`. Rode `npm test`, `npm run test:db`, `npm run typecheck` e o teste de navegador (`npx vite` + `node tests/browser-smoke.mjs`) antes de publicar. Nunca aplique migração em produção sem autorização explícita do proprietário.

## Catálogo de mercado, produtos de bases abertas e encartes — S12 (complemento)

Pedido: montar a lista de compras sem digitar marcas e tamanhos (a família compra no Atacadão e no Sam's Club), aproveitar encartes e poder criar itens. Depois: **só cadastrar itens se houver API pública e gratuita por trás**, e usar a mesma API para atualizar.

### Pesquisa de fontes (conferida em 05/10/2026, com `curl -D-`)

| Fonte | Resultado |
| --- | --- |
| Open Food Facts (`br.openfoodfacts.org`) | Gratuita, pública, produtos do Brasil com nome, marca, tamanho e código de barras, `access-control-allow-origin: *`. **Usada.** |
| Open Beauty Facts / Open Products Facts (`br.openbeautyfacts.org`, `br.openproductsfacts.org`) | Mesma API e licença; cobrem higiene e limpeza, com cobertura menor. **Usadas.** |
| Open Prices (`prices.openfoodfacts.org`) | Existe, mas tinha 73 preços em reais no mundo todo e nenhum do Atacadão ou Sam's Club no Brasil. **Descartada.** |
| Encartes do Atacadão / Sam's Club | Sem API pública. O preço vem do que a pessoa digita ou cola. |
| Search-a-licious (`search.openfoodfacts.org`) | Mistura produtos de vários países; o endpoint `cgi/search.pl` dos subdomínios `br.` já filtra o Brasil. **Descartada.** |

Regras do serviço (documentação oficial): 10 buscas por minuto e 15 consultas por código por minuto (por aparelho quando chamada do celular); proibido usar a busca para autocompletar; licença ODbL com crédito; User-Agent próprio (navegadores não permitem definir). O serviço fica instável às vezes e devolve uma página HTML com status 503 (visto durante o desenvolvimento).

### O que foi feito

- `src/family/off.ts`: busca por texto e consulta por código, com limitador local (9 buscas e 14 consultas por minuto), cache de uma semana no aparelho, tempo limite de 12 s, uma nova tentativa em erro 5xx, mensagens amigáveis (limite, instabilidade, sem internet, resposta inesperada), normalização (marca em maiúsculas, "5kg" → "5 kg", código de barras válido) e ordenação (nomes que começam pelo que foi buscado vêm antes). A busca só parte de um toque; nunca autocompleta. Só o texto buscado sai do aparelho.
- `src/family/catalog.ts`: os atalhos genéricos não têm mais marca, tamanho nem preço (antes havia listas escritas de memória, removidas a pedido). Item "embalado" abre a busca; hortifrúti e carnes a granel entram direto.
- Categoria do produto: etiquetas do banco → categoria do catálogo, ignorando etiquetas genéricas. Um erro real foi achado na API ao vivo (`plant-based-foods-and-beverages` classificava biscoitos como bebidas) e ficou coberto por teste.
- Banco: migração aditiva `20261018100100_market_catalog.sql` (`fin_catalog`, com `barcode` e `source`, e um mesmo código de barras só uma vez por casa). Sem ela aplicada o app funciona e guarda itens e ofertas só no aparelho.
- Atualização: "Atualizar dados dos produtos salvos" consulta até 20 produtos por vez (uma a cada 4,5 s) e corrige nome, marca e tamanho que mudaram. Não altera preços, quantidades nem listas.
- Encartes: colar o texto, conferir a prévia, ofertas por mercado com validade (ver `catalog.ts`, `parseFlyerText`). O app não lê foto nem PDF.

### Verificação

`npm test`, `npm run test:db`, typecheck, build e `tests/browser-smoke.mjs` (com as respostas da API simuladas por `page.route`, para não gastar o limite do serviço público): busca, escolha do produto, cache sem nova chamada, guardar no catálogo, soma na lista, banco irmão de limpeza, atualização com um produto mudado, instabilidade do serviço com saída para criar à mão, encarte colado. Também foi rodado o módulo contra a API real (três bancos e consulta por código).

### Pendências

1. Aplicar as migrações no banco de produção (com autorização do proprietário).
2. Enviar itens guardados só no aparelho para a casa; ligar catálogo e despensa; histórico de preço por mercado; leitura de foto de encarte.
3. Cobertura de higiene e limpeza no Brasil é pequena: quando não achar, o app oferece criar o item.
4. Ao crescer o uso, considerar um projeto próprio no Supabase e baixar o arquivo de exportação do Open Food Facts em vez de consultar a API.

## Parcelamentos, agenda da família, foco (TDAH), agilidade e mercado no cartão — análise de 17/10/2026

Pedido: análise completa do app com melhorias em gestão financeira, agenda pessoal e compartilhada com a família, ferramentas para TDAH, compras de mercado, parcelamentos e agilidade. Decisões do proprietário: compromisso pessoal é visto **só pela própria pessoa** (nem o administrador); a agenda vai para o calendário do celular por **arquivo .ics** (sem servidor novo); as quatro frentes entram no mesmo lote.

### Diagnóstico que motivou as mudanças

| Área | Achado |
| --- | --- |
| Parcelas | Não havia visão de parcelamentos ativos, do que já está comprometido nos próximos meses nem de limite usado. Carnê e boleto parcelado fora do cartão não tinham cronograma. |
| Parcelas | A fatura é recalculada pelo fechamento **atual** do cartão (S04 pendente): mudar o fechamento desloca o histórico. |
| Mercado | `fin_complete_purchase` só registrava pagamento à vista. |
| Agilidade | Todo lançamento exigia o formulário completo; sem "repetir", favoritos, texto rápido ou atalhos. |
| Agenda | `fin_tasks` só tem data, sem hora, e é sempre da casa inteira. Contas, faturas e tarefas não apareciam juntas por dia. |
| TDAH | O Início mostra muitos blocos ao mesmo tempo; sem captura rápida, passos, temporizador ou lembrete. |
| Código | `financialOverview` (`model.ts`) usa a regex `/investimento\|renan/i`, com um nome pessoal num repositório público. **Não alterado**: muda totais; confirmar com o proprietário. |

### O que foi feito

Regras puras, com testes:
- `src/family/plans.ts`: parcelamentos ativos (cartão e carnê), compromissos dos próximos 12 meses (cartões + contas a pagar + despesas fixas ainda não geradas, sem contar duas vezes), "alívio chegando" (parcelas que terminam), limite estimado do cartão, simulador "Cabe no mês?" contra a média das receitas registradas e cronograma de carnê (dia limitado ao fim do mês, centavos exatos).
- `src/family/quick.ts`: lançamento em uma linha ("mercado 52,30 nubank 3x", "uber 18 ontem", "luz 120 vence 10", "recebi salário 3.500,00"). Vira **rascunho** no formulário normal; o que ficou ambíguo (cartão, valor, categoria) é avisado. Categoria pelo histórico da pessoa, depois por palavra-chave. Gastos frequentes viram atalhos "↻".
- `src/family/agenda.ts`: repetição (dia 31 vira o último dia dos meses curtos; 29/02 vira 28/02), visão do dia/semana/mês juntando compromissos, "ocupado" de outras pessoas, tarefas, contas a pagar e faturas; atrasados aparecem só em "hoje"; avisos com o app aberto; exportação `.ics` (RFC 5545: escape, quebra de linha em 75 bytes, `RRULE` equivalente à regra do app, alarme).
- `src/family/focus.ts`: fila "Agora" (conta vencida → compromisso nas próximas 2 h → minha tarefa → anotação sem destino → desejo cuja espera acabou), contador de feitas hoje (sem sequência que pune), desejos com espera, temporizador e passos.

Telas (`src/family/views/*.ts`, componentes em `src/family/ui.ts`):
- Navegação: **Início · Agenda · Dinheiro · Compras · Casa**; Perfil foi para "Mais seções"/menu. Nova seção "Agora (foco)".
- Início: cartão "Agora" com uma ação, "Lançar rápido", "Já comprometido" (3 meses). **Modo foco** (Perfil → Aparência) deixa só Agora, o dia de hoje e o lançamento rápido.
- Cartões: abas Faturas (com limite estimado livre) | Parcelamentos (simulador, novo carnê, "Paguei a parcela") | Próximos meses (barras por mês com a renda média).
- Agenda: Dia/Semana/Mês, filtro Tudo/Só meus/Da casa, "Quem pode ver: Só eu / Ocupado / Toda a casa", participantes só em compromisso da casa, aviso, repetição, "Pôr no calendário" e "Baixar a semana (.ics)".
- Botão flutuante **Anotar** em todas as telas (tecla `a`); "Organizar" transforma a anotação em gasto, compromisso, tarefa, item da lista ou desejo, e ela só sai da caixa de entrada quando o destino é salvo.
- Tarefas com **passos** marcáveis (modelos "Rotina da manhã" e "Rotina da noite") e botão "15 min"; temporizador visual com anel, vibração e bipe, visível em qualquer tela.
- Metas → "Desejos em espera" (2 dias, 1 semana, 1 mês) e "Você deixou de gastar R$ X".
- Modo mercado: "Como pagou? Pix/débito/dinheiro | Cartão de crédito" com parcelas.
- Teclado no computador: `n` lança, `a` anota, `/` vai para a busca. Atalhos no ícone do app (Android): `?acao=lancar|anotar|lista|agenda`.

Banco: migração aditiva **`20261018100200_agenda_foco.sql`** (aplicada em produção em 18/10/2026; ver "Estado do banco de produção"):
- `fin_events` (leitura: dono, ou todos quando `visibility='home'`; administrador não tem exceção; sem trigger de auditoria para não revelar compromissos pessoais), `fin_busy_slots(h)` (só dono e horário dos "ocupado"), `fin_inbox` (só o dono), `fin_wishes` (dono, ou casa quando compartilhado), `fin_tasks.steps` (validado, zerado ao repetir em `fin_complete_task`), `fin_preferences.focus_mode`, `fin_complete_purchase_card` (mesmas garantias da compra à vista; cartão conferido pela trigger de lançamentos).
- Sem a migração aplicada, compromissos, anotações, desejos, passos e modo foco ficam **só no aparelho** (`localStorage`, chave por casa **e** pessoa); a tela avisa. Compra no cartão pelo modo mercado pede a migração.

### Verificação

- `npm test`: 81 testes (novos: `plans`, `quick`, `agenda` — também com `TZ=UTC` —, `focus`).
- `npm run test:db`: 5 testes; `tests/agenda-db.test.mjs` cobre privacidade da agenda (administrador não lê compromisso pessoal; "ocupado" sem título; outra casa não vê nada), caixa de entrada, desejos, passos, modo foco e compra no cartão (parcelas, estoque, cartão de outra pessoa recusado, toque repetido não compra duas vezes, permissão).
- `npm run typecheck`, `npm run build`.
- `npm run test:browser` (com `npx vite` ativo): o teste antigo e o novo `tests/browser-casa-foco.mjs` (demonstração: Agora, lançamento rápido, parcelamentos, carnê, simulador, agenda com privacidade entre administrador e membro e conteúdo do `.ics` baixado, anotar/organizar, temporizador, desejos, passos, mercado no cartão em 2x, tecla `a`, modo foco e celular de 360 px sem rolagem lateral).

### Pendências e próximos lotes

1. ~~Aplicar as migrações da casa em produção~~ — feito em 18/10/2026 (ver "Estado do banco de produção").
2. ~~S04: congelar o cronograma das compras no cartão~~ — a `main` já fez (`first_invoice_month`); os parcelamentos desta entrega usam esse campo.
3. Finanças: orçamento por categoria, receitas recorrentes, provisão de despesas anuais (IPVA, IPTU, material escolar), divisão de despesas entre membros, metas com aportes ligados a lançamentos.
4. Avisos com o app fechado (push) exigem servidor e chaves: hoje só avisa com o app aberto.
5. Link de assinatura de calendário (atualiza sozinho) exigiria função nova no servidor e link secreto por pessoa.
6. Enviar para o banco o que ficou guardado só no aparelho antes de as migrações serem aplicadas (compromissos, anotações, desejos, passos, itens do catálogo). **Não é enviado sozinho.**
7. Revisar a regex com nome pessoal em `financialOverview`.

### Como continuar em outra sessão ou ferramenta

Leia este arquivo e, conforme o assunto, `src/family/plans.ts`, `quick.ts`, `agenda.ts` ou `focus.ts` (regras) e `src/family/views/` (telas). Regra nova vai no módulo puro com teste; tela nova vai em `views/` recebendo `ViewCtx`; ação de botão e envio de formulário ficam em `app.ts` (`data-action` e `id` do formulário). Dado pessoal novo no banco: tabela `fin_*` com política só do dono e sem auditoria que revele conteúdo, mais teste em `tests/`. Rode `npm test`, `npm run test:db`, `npm run typecheck`, `npm run build` e `npm run test:browser` antes de publicar.

## Parcelas fixas e saldos por conta — segunda entrega

`20261005140612_family_installment_schedule.sql` guarda o mês da primeira fatura para compras novas e quando uma compra antiga é editada. Lançamentos anteriores permanecem sem valor nessa coluna; nenhum gasto real é migrado ou multiplicado. Alterar a data ou o cartão da compra recalcula o início, a menos que o usuário informe o mês desejado. Alterar posteriormente o dia de fechamento do cartão não move uma compra que já tem início salvo. O app mostra a prévia antes de salvar.

`20261005143000_family_private_account_balances.sql` adiciona um consentimento independente para mostrar o saldo. Uma conta compartilhada começa com saldo privado. O servidor soma todos os movimentos pagos após o saldo-base, inclusive registros privados, e entrega apenas o total a outro membro quando o administrador compartilha expressamente esse saldo. Compra no cartão entra na fatura; o pagamento da fatura debita a conta escolhida. Despesa, pagamento de dívida e transferência também atualizam os saldos das contas vinculadas. Saldos desconhecidos continuam desconhecidos.

Depois de publicar e conferir a nova interface, `20261005210932_family_account_balance_read_guard.sql` retira a leitura direta do saldo-base e da data-base pela API de tabela. A interface nova usa `fin_account_overview`; publicar a interface antiga de volta exige restaurar a permissão de leitura anterior ou manter a interface nova. O teste PostgreSQL sintético verifica privacidade, autorização, transferências, pagamentos e centavos. A função pública de saldo é `SECURITY DEFINER` por necessidade de somar movimentos privados; cada linha devolvida passa por `fin_private.visible` e o agregado só sai se `share_balance` estiver ativo ou se quem consulta for titular/administrador.

O GitHub Pages deste repositório também faz uma implantação automática dos arquivos fonte de `main`, que pode chegar antes ou depois do workflow compilado. `fallback/app.js` e `fallback/app.css` são uma cópia da versão pública compilada e validada do Financeiro360. O `index.html` fonte carrega essa cópia somente quando está no Pages sem o bundle do Vite. O workflow próprio copia a pasta fallback junto com `dist`. Atualizar a cópia ao publicar mudanças futuras no app, ou configurar a origem do Pages exclusivamente para GitHub Actions quando houver acesso administrativo à configuração do repositório.

## Edição segura de cartão

Os cartões podem ser editados depois do cadastro: nome, limite, dia de fechamento e vencimento. Ao mudar o fechamento, uma migração fixa o mês da primeira fatura das compras antigas que ainda não tinham cronograma salvo, preservando o ciclo que o painel mostrava antes. Cronogramas já escolhidos ou salvos não mudam. A tela também lembra que basta cadastrar o nome; número completo e código de segurança não são necessários para prever faturas.

## Estado do banco de produção (18/10/2026)

Projeto Supabase `iowuejrpzoibyidiuvpt` (compartilhado com o Quant e o Mapa do Parque; as tabelas da casa são só `fin_*`).

### O que foi aplicado

A produção já tinha as migrações da `main` (parcelas congeladas, saldos privados, lembretes, subcategorias, alinhamento de faturas, empréstimos, categorias salvas). Antes de aplicar, as 10 funções de que as novas dependem foram comparadas com as que o repositório produz (mesmo `md5`), e o branch foi unido à `main`. Aplicadas por `apply_migration`, uma por vez, com o conteúdo exato dos arquivos:

| Ordem | Nome no Supabase | Arquivo | Cria |
| --- | --- | --- | --- |
| 1 | `family_household_routine` | `20261018100000_household_routine.sql` | `fin_pantry.location`, `fin_pantry_events`, `fin_tasks`, `fin_pantry_move`, `fin_complete_task` |
| 2 | `family_market_catalog` | `20261018100100_market_catalog.sql` | `fin_catalog` |
| 3 | `family_agenda_focus` | `20261018100200_agenda_foco.sql` | `fin_events`, `fin_inbox`, `fin_wishes`, `fin_busy_slots`, `fin_tasks.steps`, `fin_preferences.focus_mode`, `fin_complete_purchase_card`, novo `fin_complete_task` |

Nenhuma linha foi inserida, alterada ou apagada: só estrutura nova e colunas com valor padrão.

### Conferências feitas depois (só leitura)

- Dados reais iguais ao de antes: `fin_entries` 472, `fin_cards` 8, `fin_debts` 6, `fin_accounts` 8, `fin_pantry` 0, `fin_shopping` 1, `fin_preferences` 1, `fin_reminders` 0.
- As 6 tabelas novas têm RLS ligado e nenhum acesso para `anon`/`public`.
- As funções novas só são executáveis por `authenticated`.
- Privacidade da agenda: `fin_events` é lido só pelo dono ou quando `visibility='home'` (sem exceção para o administrador); `fin_inbox` só pelo dono; `fin_wishes` pelo dono ou quando compartilhado. `fin_events` não tem gatilho de auditoria e não há linha em `fin_audit` para `fin_events`, `fin_inbox` ou `fin_wishes`, para o histórico do administrador não revelar compromissos pessoais.
- Alertas de segurança do Supabase: os mesmos de antes, todos de outros objetos (`parque_*`, `caixinha.config`, proteção de senhas vazadas desativada, `fin_account_overview`). **Único item novo:** `fin_busy_slots` aparece como "função `security definer` executável por usuário logado". É intencional: devolve só o dono e o horário dos compromissos marcados como "ocupado", e só para membros da casa.

### Como desfazer (tudo é aditivo)

Só se algo der errado, e depois de exportar o que a família criou:

```sql
-- 3 (agenda e foco)
drop function if exists public.fin_complete_purchase_card(uuid[], bigint, date, uuid, int);
drop function if exists public.fin_busy_slots(uuid);
drop table if exists public.fin_wishes, public.fin_inbox, public.fin_events;
alter table public.fin_preferences drop column if exists focus_mode;
alter table public.fin_tasks drop column if exists steps;
-- Se desfizer só a 3: recriar fin_complete_task como na migração 1 (sem o campo steps). Se desfizer tudo, o passo 1 abaixo já remove a função.
drop function if exists fin_private.valid_steps(jsonb), fin_private.guard_event(), fin_private.guard_owner_identity();
-- 2 (catálogo)
drop table if exists public.fin_catalog; drop function if exists fin_private.guard_catalog();
-- 1 (rotina e despensa)
drop function if exists public.fin_complete_task(uuid, date), public.fin_pantry_move(uuid, text, numeric);
drop table if exists public.fin_tasks, public.fin_pantry_events;
drop function if exists fin_private.guard_task(), fin_private.next_due(text, date);
alter table public.fin_pantry drop column if exists location;
```

Ordem importa (3, 2, 1). Este roteiro foi testado em PGlite sobre a cadeia completa: o banco volta ao mesmo número de tabelas, colunas e funções de antes das três migrações. Nenhum lançamento, fatura ou preferência anterior depende desses objetos.

### O que muda para a família

O app detecta as tabelas e passa a gravar no banco em vez do aparelho (`agendaReady`, `householdReady` e `catalogReady` ficam verdadeiros): agenda, anotações, desejos, rotina, despensa por local, catálogo e compra do mercado no cartão passam a valer em todos os celulares. O que foi criado só no aparelho antes disso **não é enviado sozinho** e continua só naquele navegador.

### Pendências novas (vindas da união com a `main`)

- Unificar a "Agenda" com o "Calendário familiar" da `main`: hoje convivem, e a Agenda mostra também os lembretes e vencimentos da casa.
- `sortSubcategoriesByUse` (da `main`) põe subcategorias criadas pela família depois das sugestões prontas, e elas podem ficar fora dos 7 atalhos do gasto rápido.
- `public.fin_account_overview` (da `main`) é `security definer` e executável por usuários logados: conferir se ela checa que a pessoa é membro da casa.
- `tests/browser-smoke.mjs` (da `main`) estava desatualizado em relação ao gasto rápido; foi ajustado nesta união. O teste antigo da casa agora é `tests/browser-casa.mjs`.

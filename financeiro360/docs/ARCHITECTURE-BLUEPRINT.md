# Financeiro360 — blueprint

## Produto entregue

MVP em português para planejamento doméstico de um casal, inspirado em funções gerais de controle financeiro, sem reutilizar marca ou layout de outro produto. Pessoas do casal são perfis de atribuição no mesmo dispositivo, **não contas autenticadas**. O cadastro manual registra quem fez uma compra, se é do lar ou pessoal, e qual cartão foi usado. Orçamento e custos são calculados das despesas familiares; faturas projetadas são calculadas das compras no cartão. Lista de mercado liga o custo real a um lançamento. Despesas fixas mensais geram previsões até o usuário confirmar cada lançamento, sem duplicar o custo real. Contas com saldo-base conhecido ou desconhecido, transferências internas, dívidas com pagamentos parciais e registros pendentes completam o modelo local.

O aplicativo usa `localStorage` e exportação/importação JSON manual. Há um cofre Supabase opcional e privado por usuário, com autenticação por e-mail/senha e ações explícitas de salvar e carregar; isso não cria compartilhamento entre aparelhos em tempo real nem entre pessoas do casal. Não há integração com bancos/cartões, leitura automática de fatura ou dados pré-preenchidos. A migração aplicada cria apenas `fin_user_vault`, com RLS por proprietário; não altera as tabelas da Bíblia em Contexto. Compartilhamento futuro exige desenho de acesso, políticas, modelo, migração e rollback próprios.

## Fronteiras e arquivos

| Arquivo ou grupo | Motivo | Risco | Projetos afetados | Alternativa |
| --- | --- | --- | --- | --- |
| `financeiro360/package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` | Build e dependências contidos na pasta. | Atualizações de dependências exigem validação do app. | Apenas Financeiro360. | HTML/JS sem build, com menos suporte de tipos. |
| `financeiro360/src/`, `index.html` | Interface e cálculos do MVP local. | Dados locais dependem do navegador; erro de cálculo pode afetar planejamento. | Apenas Financeiro360. | Definir backend e sincronização em fase própria. |
| `financeiro360/.env.example`, `.gitignore`, `README.md`, `docs/` | Documentar execução, dados e limites; impedir versionar dados de ambiente e saída. | Variáveis `VITE_` são públicas no bundle. | Apenas Financeiro360. | Não configurar variáveis até haver demanda. |
| `.github/workflows/pages.yml` | Manter `--exclude='financeiro360'` no `rsync` genérico; instalar e compilar o app isoladamente e copiar somente `dist/` para `_site/financeiro360/`. A base Vite é definida apenas no build Pages. | Falha no npm/build omite o Financeiro360 dessa publicação e gera aviso, sem impedir o deploy dos demais; uma base errada quebraria os recursos no subcaminho. A cópia do `dist/` não inclui fontes, SQL ou dados locais. | Artefato Pages; Estante, Controle360, File360, Xadrez3D e hub mantêm suas etapas e caminhos. | Deploy independente com Root Directory `financeiro360/` e saída `dist/`, após configuração própria. |

## Build e hospedagem

Executar `npm ci`, `npm test`, `npm run typecheck` e `npm run build` a partir de `financeiro360/`. A saída é `dist/`. O `pnpm-workspace.yaml` existente em `file360/` declara somente `.`; não expandir seu alcance. Não criar package/workspace na raiz. O GitHub Pages publica o build em `/teste1/financeiro360/`: o workflow usa `npm run build -- --base /teste1/financeiro360/` e copia `dist/` após o staging existente, apenas quando instalação e build passam e `index.html` existe. Caso contrário, o Actions mostra um aviso e mantém a publicação dos demais projetos. No desenvolvimento local, a base segue `/`. A exclusão do `rsync` impede que fontes, documentos, migrations e exemplos de ambiente sejam copiados. As variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` vêm das GitHub Actions vars específicas `FINANCEIRO360_SUPABASE_URL` e `FINANCEIRO360_SUPABASE_PUBLISHABLE_KEY`; sua ausência preserva o modo local. A publicação depende do workflow de `main` após revisão e merge; esta branch não publica por si só.

## Regras de cálculo e limites

Compra parcelada é uma única despesa no mês da compra, com parcelas distribuídas nas faturas previstas. Pagamento da fatura não é lançamento separado. O calendário de faturas usa fechamento e vencimento informados pelo usuário; não modela feriados, alterações retroativas de regras do cartão ou juros. Alterar ou excluir cartão com compras vinculadas não é oferecido; exclusão é bloqueada. O orçamento mensal é uma meta global, não histórico de metas por mês. Alertas são locais na interface e não enviam notificações.

Contas com saldo inicial desconhecido permanecem sem saldo calculado; transferências não entram em receitas/despesas; pagamentos de principal reduzem a dívida e a conta vinculada sem duplicar gasto. Pendências com data ou valor incertos ficam fora dos totais até confirmação.

Backup JSON é validado, resumido para revisão (contagens, período, amostra e origem informada) e substitui os dados locais somente após confirmação explícita. A origem não é autenticada. O usuário deve conferir registros incertos antes de importar. Nenhum dado pessoal de histórico foi versionado. Ainda não há execução automática de recorrências, CSV, conciliação, comprovantes, permissões por pessoa nem histórico compartilhado. O cofre opcional salva e carrega manualmente o estado inteiro apenas para o proprietário autenticado; não oferece sincronização automática ou compartilhamento do casal. Essas capacidades exigem definição posterior de requisitos e privacidade.

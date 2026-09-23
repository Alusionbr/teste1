# Financeiro360 — blueprint

## Produto entregue

MVP em português para planejamento doméstico de um casal, inspirado em funções gerais de controle financeiro, sem reutilizar marca ou layout de outro produto. Pessoas do casal são perfis de atribuição no mesmo dispositivo, **não contas autenticadas**. O cadastro manual registra quem fez uma compra, se é do lar ou pessoal, e qual cartão foi usado. Orçamento e custos são calculados das despesas familiares; faturas projetadas são calculadas das compras no cartão. Lista de mercado liga o custo real a um lançamento. Despesas fixas mensais geram previsões até o usuário confirmar cada lançamento, sem duplicar o custo real. Contas com saldo-base conhecido ou desconhecido, transferências internas, dívidas com pagamentos parciais e registros pendentes completam o modelo local.

O aplicativo usa `localStorage` e exportação/importação JSON manual. Não há sincronização entre aparelhos, banco, autenticação, integração com bancos/cartões, leitura automática de fatura ou dados pré-preenchidos. Qualquer proposta futura de serviço de dados exige desenho de acesso, políticas, modelo, migração e rollback antes de implementação. Nenhum cliente ou migração Supabase foi criado.

## Fronteiras e arquivos

| Arquivo ou grupo | Motivo | Risco | Projetos afetados | Alternativa |
| --- | --- | --- | --- | --- |
| `financeiro360/package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` | Build e dependências contidos na pasta. | Atualizações de dependências exigem validação do app. | Apenas Financeiro360. | HTML/JS sem build, com menos suporte de tipos. |
| `financeiro360/src/`, `index.html` | Interface e cálculos do MVP local. | Dados locais dependem do navegador; erro de cálculo pode afetar planejamento. | Apenas Financeiro360. | Definir backend e sincronização em fase própria. |
| `financeiro360/.env.example`, `.gitignore`, `README.md`, `docs/` | Documentar execução, dados e limites; impedir versionar dados de ambiente e saída. | Variáveis `VITE_` são públicas no bundle. | Apenas Financeiro360. | Não configurar variáveis até haver demanda. |
| `.github/workflows/pages.yml` | Acrescentar `--exclude='financeiro360'` ao `rsync` genérico para impedir cópia pública da pasta ao Pages. | Uma edição incorreta poderia mudar o artefato; o diff preserva todas as etapas e exclusões anteriores. | Composição do artefato Pages; Estante, Controle360, File360, Xadrez3D e hub mantêm seus caminhos. | Manter o trabalho fora de `main` até o deploy separado. Sem exclusão, a pasta inteira iria ao Pages. |

## Build e hospedagem

Executar `npm ci`, `npm test`, `npm run typecheck` e `npm run build` a partir de `financeiro360/`. A saída é `dist/`. O `pnpm-workspace.yaml` existente em `file360/` declara somente `.`; não expandir seu alcance. Não criar package/workspace na raiz. Um projeto Vercel separado pode, após decisão de publicação, usar Root Directory `financeiro360/` e Output Directory `dist`. Esta entrega não cria o projeto de hospedagem nem publica o app. A exclusão do Pages também impede que fontes, documentos, futuras migrations ou exemplos de ambiente de Financeiro360 sejam copiados pelo `rsync`.

## Regras de cálculo e limites

Compra parcelada é uma única despesa no mês da compra, com parcelas distribuídas nas faturas previstas. Pagamento da fatura não é lançamento separado. O calendário de faturas usa fechamento e vencimento informados pelo usuário; não modela feriados, alterações retroativas de regras do cartão ou juros. Alterar ou excluir cartão com compras vinculadas não é oferecido; exclusão é bloqueada. O orçamento mensal é uma meta global, não histórico de metas por mês. Alertas são locais na interface e não enviam notificações.

Contas com saldo inicial desconhecido permanecem sem saldo calculado; transferências não entram em receitas/despesas; pagamentos de principal reduzem a dívida e a conta vinculada sem duplicar gasto. Pendências com data ou valor incertos ficam fora dos totais até confirmação.

Backup JSON é validado, resumido para revisão (contagens, período, amostra e origem informada) e substitui os dados locais somente após confirmação explícita. A origem não é autenticada. O usuário deve conferir registros incertos antes de importar. Nenhum dado pessoal de histórico foi versionado. Ainda não há execução automática de recorrências, CSV, conciliação, comprovantes, permissões por pessoa, histórico compartilhado nem sincronização. Essas capacidades exigem definição posterior de requisitos e privacidade.

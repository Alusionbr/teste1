# Financeiro360

MVP local para um casal planejar custos do lar. A esposa pode ser titular de um cartão e o marido pode registrar compras feitas nele; titular e responsável pela compra são mostrados separadamente. Há lançamentos manuais de receitas e despesas, orçamento mensal do lar, custos por categoria, faturas previstas com parcelas, lista de mercado com valor estimado e custo real, despesas fixas previstas mensalmente, contas pessoais/da empresa/da família, transferências internas, dívidas com pagamentos parciais, pendências de revisão e backup JSON.

**Os dados locais ficam no navegador e dispositivo usados.** Dois celulares não compartilham atualizações automaticamente. Quando o cofre Supabase privado estiver configurado, cada pessoa poderá entrar em sua própria conta e salvar ou carregar uma cópia por ação explícita; isso ainda não compartilha dados entre o casal. O cadastro financeiro e os cálculos são locais; não há acesso à conta bancária ou captura de fatura. Para transferir dados sem o cofre, exporte um backup JSON em um aparelho e importe no outro. Toda importação mostra uma prévia e exige confirmação. Sair da conta não remove os dados locais deste navegador.

## Executar

Requer Node.js compatível com Vite 7 e npm. Dentro de `financeiro360/`:

```bash
npm ci
npm run dev
```

Para validar:

```bash
npm run typecheck
npm test
npm run build
```

O build sai em `dist/`. As variáveis de `.env.example` são públicas no bundle, portanto nunca use `VITE_` para segredos.

No Windows PowerShell, a partir da raiz do repositório:

```powershell
cd .\financeiro360
npm ci
npm run dev
```

Abra o endereço `http://localhost:5173/` mostrado pelo Vite. Para testar uma migração privada, use a aba **Seus dados** e selecione manualmente o JSON em `local-data/`; confira a prévia de pendências antes de substituir os dados deste navegador. Mantenha esse arquivo fora de qualquer repositório ou compartilhamento público.

## Como os números são calculados

- **Custo do lar e orçamento:** somam o valor total das despesas familiares no mês da compra. Despesas pessoais aparecem separadas.
- **Fatura:** uma compra no cartão entra na fatura do mês do fechamento se for feita até o dia de fechamento; depois disso, entra na fatura seguinte. Parcelas seguintes vão às faturas dos meses seguintes. Centavos restantes são distribuídos nas primeiras parcelas.
- **Vencimento:** usa o dia cadastrado; se ele for anterior ou igual ao fechamento, considera o mês posterior. Em meses curtos, limita ao último dia.
- **Sem duplicidade:** a fatura é uma visão das compras. O app não cria uma segunda despesa ao exibi-la ou pagá-la.
- **Despesas fixas:** são previsões mensais separadas do gasto real. Confirmar manualmente cria um lançamento à vista uma vez naquele mês; excluir o lançamento faz a previsão voltar a ficar pendente. A previsão respeita virada de ano e limita o dia ao último dia dos meses curtos.
- **Mercado:** a lista guarda estimativa unitária; registrar o total real de um item gera uma despesa familiar em Mercado. Excluir essa despesa devolve o item à lista pendente.
- **Saldo previsto do mês:** receitas menos despesas registradas por data. Não equivale ao saldo de conta bancária.
- **Contas:** saldo inicial em branco significa desconhecido e permanece desconhecido. Se um saldo inicial for informado, a data-base representa o fim daquele dia; apenas lançamentos, transferências e pagamentos de dívidas posteriores alteram o saldo exibido. Compras no cartão não debitam a conta até existir conciliação de fatura, ainda não implementada.
- **Transferências:** movem valor entre contas próprias; não viram receita ou despesa.
- **Dívidas:** o saldo devido conhecido diminui com pagamentos parciais de principal. Saldo inicial desconhecido continua desconhecido; o pagamento pode reduzir uma conta vinculada sem gerar uma segunda despesa. Juros e taxas exigem lançamento de despesa separado.
- **Pendências:** histórico incompleto pode guardar data, valor, conta e categoria sugeridas, data da fonte, grau de confiança e referência. Fica fora de todos os totais até revisão e confirmação. Pendências de transferência ou dívida devem ser conciliadas nos módulos próprios antes de removê-las.

Alertas de orçamento aparecem na interface ao abrir o app. Ainda não há lançamento recorrente automático sem confirmação, lembretes do sistema, conciliação de pagamentos da fatura, importação CSV nem integração financeira externa. Cadastros e lançamentos são manuais. Os tipos de conta são rótulos locais, não permissões: qualquer pessoa com acesso ao mesmo navegador pode ver tudo. Ainda não há conciliação de pagamentos de fatura, nem saldo bancário confiável quando a base é desconhecida.

## Isolamento e publicação

Manifesto, lockfile, TypeScript e build são próprios desta pasta. O projeto não usa o workspace de `file360/`. O workflow do GitHub Pages instala e compila o Financeiro360 separadamente, com base `/teste1/financeiro360/`, e publica somente o conteúdo de `dist/` em [Financeiro360](https://alusionbr.github.io/teste1/financeiro360/) quando a branch `main` for implantada. O `rsync` genérico continua excluindo a pasta de fontes, documentos, SQL e exemplos de ambiente; os demais projetos preservam seus caminhos. Se a instalação ou build do Financeiro360 falhar, o workflow emite um aviso e publica os outros projetos; o Financeiro360 pode ficar ausente dessa publicação. O desenvolvimento local continua em `/`.

Para habilitar o cofre privado no site, configure as variáveis do repositório no GitHub Actions `FINANCEIRO360_SUPABASE_URL` e `FINANCEIRO360_SUPABASE_PUBLISHABLE_KEY`, mapeadas no build para `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. São valores públicos incorporados ao JavaScript do navegador; nunca use chave secret ou service role. Sem essas variáveis, o site continua no modo local. O build não envia dados financeiros; salvar no cofre exige login e ação explícita no app.

Veja [docs/ARCHITECTURE-BLUEPRINT.md](docs/ARCHITECTURE-BLUEPRINT.md) para a decisão de arquitetura e os limites do MVP.

O [plano de migração privada](docs/PRIVATE-MIGRATION-PLAN.md) descreve as decisões de acesso e conferência exigidas antes de importar registros históricos reais.

Arquivos privados para migração local devem ficar em `financeiro360/local-data/` ou `financeiro360/private/`, ambos ignorados pelo Git. Nunca inclua dados pessoais no PR.

## Supabase: cofre privado opcional

A [migração `fin_user_vault`](supabase/migrations/20261002212035_financeiro360_user_vault.sql) prepara um cofre **privado por usuário**. Para usar, o projeto correto precisa ter essa migração aplicada e um `.env.local` ignorado pelo Git com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Sem esses dois valores, o app segue em modo local. Nunca coloque chave secret/service role em `VITE_`.

Na aba **Dados**, entre ou crie uma conta por e-mail/senha. Se o Supabase exigir confirmação por e-mail, abra o link recebido e volte manualmente ao endereço do Financeiro360 para entrar; o redirecionamento do projeto compartilhado pode levar ao app Bíblia em Contexto. Não altere a configuração global de Auth por causa deste app. Entrar não envia os lançamentos. **Revisar e salvar cópia** pede confirmação e rejeita se outra gravação alterou a revisão remota. **Revisar cópia para carregar** valida e mostra a prévia; antes de substituir dados locais, o app solicita download de backup e exige que você confirme ter salvo o arquivo. O backup remoto é um JSON completo privado da conta autenticada, sem compartilhamento entre cônjuges. Evite usar a mesma conta ou o mesmo navegador para dados que cada pessoa não deve ver.

O [plano de integração](docs/SUPABASE-INTEGRATION-PLAN.md) registra limites, testes RLS e retorno. A migração do cofre foi aplicada ao projeto Supabase confirmado e a tabela permanece sem dados reais. A integração continua opcional e manual.

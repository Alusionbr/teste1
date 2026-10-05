# Financeiro360 · Nossa casa

Aplicativo doméstico com interface responsiva para computador e celular. O administrador vê todos os registros da família, incluindo áreas pessoais e empresa. Cada membro vê apenas seus registros e aqueles que o administrador compartilhou. A autorização é feita por linha no Supabase, inclusive para os documentos; não depende de esconder controles na interface.

## Recursos implementados

- Painel mensal com gastos, receitas, orçamento do lar, categorias, faturas, contas vencidas e alertas da despensa. Totais de um membro usam somente registros acessíveis. Valores são em centavos inteiros.
- Receitas, despesas, compras parceladas, transferências, pagamentos de faturas e principal de dívidas; criação, edição, exclusão, filtros e revisão de registros incertos.
- Cartões com fechamento, vencimento e limite; pagamentos parciais separados das despesas. Contas com saldo inicial opcional e data-base. Saldo desconhecido permanece desconhecido.
- Despesas fixas mensais: geração explícita de compromissos a pagar, sem duplicar o mesmo mês e sem pagamentos automáticos.
- Administração de membros, suspensão de acesso e permissões para lançamentos, cartões/contas, pagamentos, documentos, despensa e compras. Senha alterável em Configurações.
- Comprovantes e faturas PDF/JPG/PNG/WebP até 10 MB em bucket privado, abertura por URL de 60 segundos. Um anexo de registro privado permanece inacessível mesmo que o documento tenha compartilhamento marcado.
- Despensa com estoque contado, unidade, consumo diário informado, duração estimada, estoque mínimo, preço e validade. Lista sugerida para 14 dias, sem duplicar itens pendentes.
- Conclusão da compra em uma transação: uma despesa com o total real, reposição de estoque e baixa dos itens selecionados. Repetir o mesmo pedido não duplica compras.
- Metas com progresso informado, histórico administrativo, exportação dos dados visíveis e importação CSV/JSON de receitas/despesas em revisão, com prévia. O lote é inserido de forma atômica.
- Aparência por usuário: tema, cores, leitura, modo simples, blocos e atalhos do painel, com armazenamento próprio e revisão de alterações.
- Manifesto de app instalável e cache somente do shell público. Respostas financeiras, Auth e documentos não entram no cache offline.

## Estado da entrega

O banco de produção está ativado no projeto `iowuejrpzoibyidiuvpt`, por autorização do proprietário em 04/10/2026. A migração familiar e a função `fin-family-admin` foram publicadas. Os objetos financeiros usam prefixo `fin_`, schema privado e bucket próprio, sem alterar tabelas ou configurações globais dos demais aplicativos.

O administrador e o segundo membro familiar já existem no banco. Em 04/10/2026 foi feita a primeira carga de dados reais diretamente no Supabase, sem versionar extratos, números de conta, documentos bancários ou outros dados sensíveis no GitHub. A carga inclui histórico bancário classificado, contas, dívidas/cartões modelados como passivos, despesas recorrentes e regras de privacidade. O saldo conhecido da conta PJ foi reconciliado com o extrato de origem; contas sem extrato recente permanecem com saldo desconhecido para não apresentar um valor falso.

A demonstração em `src/family/demo.ts` continua fictícia e serve apenas para desenvolvimento local. Consulte [status da importação](docs/DATA-IMPORT-STATUS.md) para entender o que foi carregado e o que ainda depende de confirmação.

## Executar e verificar

Requer Node 22.12+ ou 24, npm e as dependências do lockfile.

```sh
npm ci
npm run dev
npm test
npm run test:db
npm run typecheck
npm run build -- --base /teste1/financeiro360/
```

`test:db` executa a migração em PostgreSQL WASM (PGlite), com papéis e schemas Auth/Storage de teste. Cobre acesso cruzado, anonimato, anexos, permissões, suspensão, compras atômicas e recorrência. Não substitui a verificação da configuração real de Auth, Data API, Storage e Edge Functions após ativação.

Ver [operações e ativação](docs/FAMILY-OPERATIONS.md) para provisionar o banco, a conta inicial e o retorno. O fluxo anterior local permanece em `src/main.ts`, `logic.ts` e `storage.ts`; os dados do navegador anterior não são enviados automaticamente ao novo aplicativo.

## Limites explícitos

Relatórios CSV usam `descrição;valor;data;categoria;área` e datas AAAA-MM-DD. Importação aceita receitas e despesas; transferências, pagamentos e vínculos bancários devem ser conciliados nos módulos próprios. PDFs e imagens são anexos, sem OCR automático. Não há integração bancária, cobrança ou pagamentos reais. Previsão de estoque depende do consumo informado; sem consumo, o prazo é desconhecido. Uma fatura de cartão compartilhado pode mostrar apenas as compras acessíveis, portanto não equivale necessariamente à fatura do banco. A troca de senha não altera senhas de outros aplicativos, mas reutilizar um usuário Auth no mesmo projeto tem efeitos compartilhados e exige decisão prévia.

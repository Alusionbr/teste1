# Ativação do aplicativo familiar

O proprietário autorizou escolher o servidor em 04/10/2026. A restauração do projeto anterior foi recusada pelo limite gratuito. Foi escolhido o projeto ativo `iowuejrpzoibyidiuvpt`, após conferir que os objetos `fin_*`, o schema privado e as policies de Storage não existiam. Migração e função administrativa estão publicadas, com RLS e bucket privado. Não foram alterados objetos do Quant Futebol nem configurações globais de Auth. A conta administrativa do Financeiro360 não tem vínculo no Quant Futebol. A confirmação de e-mail foi concluída; casa e vínculo administrativo estão ativos. O aplicativo já está em uso. Dados fictícios ficam apenas na demonstração e nos testes.

## Instalação em outro destino e conferência operacional

1. Conferir identidade, disponibilidade, tabelas existentes e grants do projeto escolhido. Não alterar configurações globais de Auth nem objetos de outros apps.
2. Aplicar, em ordem, `20261004024051_family_app.sql`, `20261005055306_family_preferences.sql` e `20261005180000_household_routine.sql` (rotina da casa e histórico da despensa) e `20261005190000_market_catalog.sql` (itens e ofertas de encarte da casa); as duas últimas são aditivas. A primeira adiciona objetos `fin_*`, helpers em `fin_private` e o bucket privado `fin-family-private`; preserva o cofre antigo e os demais objetos. Em projeto dedicado o cofre antigo não é necessário.
3. Conferir RLS, grants, policies e advisors. `fin_private` deve ficar fora dos schemas da Data API. Clientes anônimos não recebem acesso financeiro; funções de trigger não são executáveis por clientes.
4. Publicar `supabase/functions/fin-family-admin/index.ts` como `fin-family-admin`. O corpo verifica JWT via `getUser` e vínculo ativo no banco. A chave service role fica somente no ambiente da função. Se necessário para compatibilidade com novos tokens, usar `verify_jwt=false` com a validação obrigatória do corpo preservada.
5. Executar `scripts/provision-admin.mjs` em ambiente privado com `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIN_ADMIN_EMAIL` e `FIN_ADMIN_PASSWORD`. Nunca colocar valores em commits ou logs. O script não troca a senha de uma conta Auth existente. Reutilizar usuário de outro app exige decisão explícita; para usar a senha inicial solicitada sem afetar outros aplicativos, preferir projeto dedicado.
6. A publicação Pages usa URL e publishable key públicas em `.github/workflows/pages.yml`. Para outro destino, atualizar somente a configuração Financeiro360. Em desenvolvimento, usar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca usar service role no frontend.
7. Entrar com o administrador, trocar a senha em Configurações e criar o usuário da esposa com o e-mail a definir. O usuário começa com permissões de lançamentos, cartões, pagamentos, documentos, despensa e compras. O administrador ajusta permissões e compartilha registros individualmente.
8. Verificar com duas contas reais: gasto privado inacessível à esposa, anexo segue documento e vínculo, papel e compartilhamento não podem ser elevados, suspensão bloqueia leitura, clique repetido não duplica compra. Verificar upload e URLs assinadas. Testes PGlite não substituem testes reais dos serviços remotos.

## Contabilidade e privacidade

Compras são contadas pelo total na data da compra. Parcelas distribuem os centavos nas faturas mensais. Pagamentos de fatura, transferências e principal não viram uma segunda despesa. Juros exigem despesa separada. Compromissos a pagar entram nas previsões pela data; registros em revisão ficam fora dos totais. Saldo inicial desconhecido continua desconhecido.

Contas, cartões, dívidas, lançamentos, recorrências, metas e documentos têm dono e visibilidade. Despensa, lista, histórico da despensa e rotina doméstica são compartilhados da casa. O administrador vê tudo; um membro só vê próprios registros e compartilhados. As regras estão no banco. Anexos exigem autorização para o documento e o pai. URLs assinadas duram 60 segundos; bytes já baixados não podem ser revogados.

Concluir compra cria uma despesa privada do comprador, repõe produtos vinculados e conclui a seleção de itens em uma transação. O administrador vê essa despesa e decide compartilhá-la. Previsão da despensa depende do consumo informado; não é medição automática. Despesas fixas exigem geração explícita do mês e não fazem pagamentos automáticos.

## Dados anteriores e retorno

O relatório mencionado pelo usuário está em outra conversa e não foi disponibilizado para esta execução. Esta atualização não importa relatórios nem modifica valores reais existentes. `DATA-IMPORT-STATUS.md` descreve uma carga histórica anterior; esse documento não comprova que a carga esteja no banco familiar atual. Antes de migrar, exportar o backup antigo e revisar vínculos, contas, cartões e atrasos. O importador adiciona receitas/despesas privadas em revisão e não substitui histórico. Pagamentos e transferências devem ser conciliados nos módulos próprios.

Para retornar à interface anterior, restaurar `src/main.ts` como entrada em `index.html` e publicar novamente. Os dados do navegador anterior ficam na chave original e não são enviados automaticamente. Para interromper o backend novo, retirar sua configuração e revogar grants somente dos objetos desta migração depois de exportar dados. Não apagar tabelas, usuários Auth, arquivos ou objetos de outros aplicativos. Um usuário Auth compartilhado não deve ser excluído no retorno.

## Evolução da interface

O roteiro aprovado está em [PLANO-EVOLUCAO-CASA.md](PLANO-EVOLUCAO-CASA.md). A execução começa por S01–S03: formulários por tarefa, prévia segura e parcelas no detalhe mensal. Cada lote deve registrar suas verificações e pendências em `EXECUCAO-CASA.md`. Esta fase mantém as chaves internas de competência da fatura; fechamento e vencimento são apresentados separadamente. Congelar cronogramas e permitir ajuste da primeira cobrança exige a etapa S04 antes de alterar a regra em produção.

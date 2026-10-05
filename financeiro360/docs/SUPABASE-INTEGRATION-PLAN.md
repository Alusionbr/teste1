# Supabase no Financeiro360

> Documento histórico da fase de cofre privado. A aplicação familiar atual usa outro servidor e tabelas por registro; consulte [FAMILY-OPERATIONS.md](FAMILY-OPERATIONS.md) para o destino ativo. Não use este roteiro para configurar ou substituir o backend familiar em produção.

O usuário escolheu o mesmo projeto Supabase do Bíblia em Contexto. Na verificação de leitura, ele estava ativo; as 24 tabelas existentes tinham RLS e nenhuma tabela `fin_*` existia. **A migração vault-only foi aplicada ao projeto confirmado; a tabela está vazia e nenhum dado financeiro real foi enviado.** Nenhuma tabela, função ou política do app Bíblia é alterada pelo código proposto.

## Primeira fase: cofre privado

A [migração aplicada](../supabase/migrations/20261002212035_financeiro360_user_vault.sql) cria **somente** `public.fin_user_vault`. Sua chave primária é o usuário autenticado, com `payload` JSON do backup e `revision` para controle de conflito. `anon` não recebe grants. `authenticated` só acessa sua própria linha por RLS, tanto para leitura quanto criação ou atualização. O grant de atualização permite apenas `payload` e `revision`, não a troca de proprietário.

A interface usa URL e chave **publishable** via `.env.local`, nunca chave secret/service role. Sem configuração, o modo local permanece disponível. Login e cadastro por e-mail/senha são manuais. O cadastro pede redirecionamento de confirmação para a origem do Financeiro360; essa URL precisa estar na allowlist de Auth do projeto antes de testar cadastro, sem alterar o redirecionamento usado pelo Bíblia. O logout usa escopo local para não encerrar sessões do Bíblia ou de outros dispositivos. Entrar não envia nem baixa lançamentos. **Salvar cópia** mostra os totais local/remoto e pede confirmação; a atualização filtra a revisão esperada e rejeita conflito. **Carregar cópia** valida o backup remoto com `parseBackup`, mostra a prévia, exige solicitar download do backup local e pede confirmação antes de substituir o estado local. Uma falha na gravação local restaura o estado anterior. O mesmo navegador ainda contém os dados locais após sair da conta, então ele não oferece isolamento entre pessoas nesse dispositivo.

O cofre guarda um backup privado completo de **um único usuário**. Ele não compartilha dados com o cônjuge e não resolve a separação de registros do casal. O usuário deve revisar o que salvar, sobretudo se o estado local tiver registros de outras pessoas. Não há sincronização automática, merge entre dispositivos ou importação automática do histórico privado.

## Compartilhamento futuro, bloqueado

A arquitetura futura poderá usar `fin_households`, `fin_memberships` e registros por linha para separar despesas privadas e compartilhadas. **Nenhuma dessas tabelas integra a migração atual.** O estado local mistura rótulos de pessoas e não pode ser enviado como um único JSON compartilhado. Um `payload` livre poderia conter descrições pessoais mesmo numa linha marcada como compartilhada; RLS protegeria a linha, não cada campo. Por isso, nenhum envio compartilhado será habilitado antes de schema tipado, allowlist, revisão pelo usuário e testes que tentem vazar conteúdo privado. Total de fatura sem detalhes privados precisa de desenho e testes específicos; não há função privilegiada ou agregado implementado para isso.

## Verificação e próximos testes

1. Rodar a migração **somente em stack local descartável** e executar o [teste pgTAP](../supabase/tests/fin_user_vault.test.sql) com `supabase test db`. Ele cobre dono, outro usuário, `anon`, tentativa de reassinar o cofre e revisão obsoleta. A CLI está disponível por `npx supabase@2.119.0`, mas esta máquina não tinha runtime Docker/Postgres local; por isso o teste pgTAP ainda **não** foi executado. Em teste remoto transacional revertido, o dono leu seu registro, outro usuário não o alterou nem criou em nome alheio, e `anon` não leu; as linhas de teste foram removidas pelo rollback.
2. O diff aplicado contém apenas `fin_user_vault`, grants e três políticas owner-only. Conferir novamente `pg_policies`, grants reais, exposição Data API e advisors antes de usar dados reais. Avisos já existentes em objetos Bíblia devem ser avaliados separadamente, sem alterá-los como parte desta fase.
3. Testar em ambiente controlado com duas contas distintas: cada uma lê apenas sua linha; `anon` não lê; conflito de revisão não sobrescreve dados. Testar falhas de rede e recuperação por backup antes de usar dados reais.
4. Só então configurar `.env.local` com URL e chave publishable corretas. A configuração do navegador é pública; segredos ficam fora do bundle. Antes de cada carga remota, preservar backup local.

## Retorno

Antes de qualquer carga real, registrar o estado e exportar backup do projeto. Se o cofre causar problema, remover a configuração de nuvem do app e revogar grants de `fin_user_vault` para `authenticated` e `anon`. Isso corta acesso via Data API sem apagar dados. Exportar e conciliar os registros antes de eventual correção. Apagar tabela ou executar `db reset --linked` não integra este retorno e exigiria decisão separada após backup verificado.

## Fontes oficiais

- [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api): grants e RLS são camadas distintas.
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): políticas por usuário e `auth.uid()`.
- [Supabase — Password-based Auth](https://supabase.com/docs/guides/auth/passwords): login e cadastro por e-mail.
- [Supabase — Testing and linting](https://supabase.com/docs/guides/local-development/cli/testing-and-linting): testes pgTAP locais.

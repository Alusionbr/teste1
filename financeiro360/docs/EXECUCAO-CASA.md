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

Arquivos: regras puras em `src/family/home.ts` (testes em `home.test.ts`); telas e eventos em `app.ts`; operações em `api.ts`; migração aditiva `supabase/migrations/20261005180000_household_routine.sql` (teste em `tests/household-db.test.mjs`).

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

## Catálogo de mercado e encartes — S12 (complemento)

Pedido: montar a lista de compras sem digitar marcas e tamanhos, usando os mercados em que a família compra (Atacadão e Sam's Club), aproveitar encartes e poder criar itens.

O que foi feito:

- `src/family/catalog.ts`: catálogo pronto (itens, categoria, unidade, tamanhos e marcas comuns), busca sem acento, filtro por mercado e categoria, nome composto sem repetir marca/tamanho, validação, adivinhação de categoria e leitor de texto de encarte. Testes em `catalog.test.ts`.
- A compra **não traz preço nenhum**: preços de encarte mudam por loja, região e data e não foram buscados na internet. O valor é o que a pessoa digita ou o preço da oferta que ela mesma cadastrou.
- Leitor de encarte: uma oferta por linha; em "de R$ 29,90 por R$ 24,90" vale o último preço; linhas sem preço são só contadas; no máximo 100 ofertas por vez; sempre há prévia com opção de desmarcar. Foto e PDF não são lidos (OCR continua como etapa futura do plano, S21).
- Banco: migração aditiva `supabase/migrations/20261005190000_market_catalog.sql` (`fin_catalog`), lida por toda a casa e alterada por quem tem a permissão de compras. Teste em `tests/catalog-db.test.mjs` (validação no servidor, lote atômico, permissão, outra casa, suspensão, anônimo).
- Sem a migração aplicada o aplicativo funciona: o catálogo pronto não usa o banco e itens/ofertas criados ficam **só neste aparelho** (`localStorage`, chave por casa), com aviso na tela. Depois de aplicada, os novos passam a ser compartilhados; os guardados no aparelho continuam visíveis só nele (ainda não há "enviar para a casa").
- Itens do catálogo entram na lista como avulsos (não atualizam a despensa na compra). Ligar um item do catálogo a um produto da despensa é um próximo passo.

Verificação: `npm test`, `npm run test:db`, typecheck, build e `tests/browser-smoke.mjs` (adicionar sem digitar, somar em vez de repetir, oferta com preço do encarte, criar item, colar encarte com prévia, filtro por mercado, categorias recolhidas e celular 390 px). Dados fictícios (a oferta de arroz da demonstração é inventada).

Pendências: aplicar a migração (com autorização), enviar itens do aparelho para a casa, ligar catálogo e despensa, histórico de preço por mercado e leitura de foto de encarte.

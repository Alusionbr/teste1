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
- Banco: migração aditiva `20261005190000_market_catalog.sql` (`fin_catalog`, com `barcode` e `source`, e um mesmo código de barras só uma vez por casa). Sem ela aplicada o app funciona e guarda itens e ofertas só no aparelho.
- Atualização: "Atualizar dados dos produtos salvos" consulta até 20 produtos por vez (uma a cada 4,5 s) e corrige nome, marca e tamanho que mudaram. Não altera preços, quantidades nem listas.
- Encartes: colar o texto, conferir a prévia, ofertas por mercado com validade (ver `catalog.ts`, `parseFlyerText`). O app não lê foto nem PDF.

### Verificação

`npm test`, `npm run test:db`, typecheck, build e `tests/browser-smoke.mjs` (com as respostas da API simuladas por `page.route`, para não gastar o limite do serviço público): busca, escolha do produto, cache sem nova chamada, guardar no catálogo, soma na lista, banco irmão de limpeza, atualização com um produto mudado, instabilidade do serviço com saída para criar à mão, encarte colado. Também foi rodado o módulo contra a API real (três bancos e consulta por código).

### Pendências

1. Aplicar as migrações no banco de produção (com autorização do proprietário).
2. Enviar itens guardados só no aparelho para a casa; ligar catálogo e despensa; histórico de preço por mercado; leitura de foto de encarte.
3. Cobertura de higiene e limpeza no Brasil é pequena: quando não achar, o app oferece criar o item.
4. Ao crescer o uso, considerar um projeto próprio no Supabase e baixar o arquivo de exportação do Open Food Facts em vez de consultar a API.

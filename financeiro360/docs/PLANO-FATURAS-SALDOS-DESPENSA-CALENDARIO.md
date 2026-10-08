# Financeiro360 — próximo ciclo da gestão do lar

Data: 08/10/2026. Estado: plano para execução; nenhuma das entregas abaixo é considerada pronta por este documento.

Este ciclo aprofunda o [plano geral](PLANO-EVOLUCAO-CASA.md) nas quatro necessidades trazidas pela família: faturas reais sem cadastrar cada compra, saldos bancários conferíveis, catálogo de supermercado ligado à despensa e calendário útil para os compromissos da casa. O celular orienta o desenho; o desktop facilita revisão e planejamento.

## O que o app já oferece e onde falta avançar

| Área | Existe no código atual | Falta para o uso pedido |
| --- | --- | --- |
| Cartões | Cartão com fechamento e vencimento, parcelas por mês e pagamentos | Informar o total real da fatura, reconciliar diferenças e distinguir valor previsto de valor confirmado |
| Contas | Saldo base com data, movimentos posteriores e escolha de compartilhar o saldo | Conferir novos saldos sem apagar o histórico anterior e explicar divergências |
| Mercado | Lista, 12 atalhos de produtos, conclusão da compra e atualização do estoque | Catálogo pesquisável de itens comuns, novos itens da família, variantes e compra parcial fácil |
| Despensa | Estoque, mínimo, consumo estimado e validade | Entrada e saída simples, histórico de correções, ligação consistente com o catálogo e alertas úteis |
| Calendário | Visão mensal, lembretes, vencimentos manuais, repetição e post-its | Mostrar vencimentos financeiros automaticamente, agenda por dia/semana e conclusão individual de recorrências |

As conclusões vêm da leitura de `src/family/app.ts`, `model.ts`, `api.ts` e das migrações existentes. A interface publicada ainda precisa ser conferida visualmente durante a execução.

## Experiência proposta

No celular, a barra inferior mostra **Início, Dinheiro, Compras, Calendário e Casa**. Perfil, aparência e administração ficam no avatar. Um botão **Adicionar** oferece as ações relevantes ao contexto: gasto, pagamento, produto, saldo ou compromisso. No desktop, as mesmas áreas aparecem na lateral.

O início responde a quatro perguntas: **o que vence**, **quanto há nas contas que posso ver**, **quanto há nas faturas** e **o que comprar**. Cada valor abre sua composição. Alertas mostram uma ação clara e desaparecem quando a situação é resolvida. O modo simples usa palavras comuns e uma ação principal por tela; campos de revisão permanecem acessíveis em “Mais opções”.

Direção visual: superfícies claras com verde e azul petróleo, contraste forte para valores e estados, cartões compactos, números legíveis, ícones acompanhados de texto e animações discretas. Tema escuro e tamanho de texto continuam preferências individuais. O formulário preserva o que foi digitado quando ocorre erro.

## 1. Faturas alinhadas ao banco

Na tela de cada cartão, a pessoa escolhe o mês e toca em **Informar valor da fatura**. Ela informa o total mostrado pelo banco, a data de vencimento se estiver diferente, a data de conferência e, opcionalmente, anexa a fatura. Pode marcar o valor como **provisório** enquanto a fatura está aberta e como **confirmado** após o fechamento. Não precisa criar compras fictícias.

A tela apresenta quatro linhas distintas: **compras cadastradas**, **diferença ainda sem detalhamento**, **total informado** e **já pago / falta pagar**. O valor informado é a referência para o compromisso; se não houver valor informado, permanece a previsão calculada com as parcelas. A diferença é calculada, pode ser positiva ou negativa e nunca vira um segundo gasto automaticamente. Uma diferença negativa pede revisão de crédito, estorno, desconto ou compra lançada no mês errado.

Exemplo ilustrativo: compras registradas somam R$ 300 e a fatura informada é R$ 700. A tela mostra R$ 400 sem detalhamento. Depois de um pagamento de R$ 250, faltam R$ 450. Se uma compra de R$ 100 for cadastrada nessa mesma fatura, a diferença cai para R$ 300 e o total informado permanece R$ 700. O pagamento debita somente a conta bancária selecionada.

Pagamentos parciais e múltiplos continuam ligados à competência do cartão. Se o pagamento exceder o devido, o app mostra um crédito ou divergência para revisar; não apresenta saldo negativo como dívida. A fatura compartilhada só revela o valor integral a quem pode vê-lo segundo as permissões do cartão e do lar. Uma pessoa com visão parcial recebe um rótulo de visão parcial.

**Dados propostos:** registro por `cartão + competência`, com total informado em centavos, estado provisório/confirmado, vencimento, data de conferência, autoria e versão; documento ligado ao registro. A leitura da fatura passa por uma única função de cálculo usada no painel, no calendário e no pagamento. Histórico de alterações evita perder um valor anterior.

**Concluído quando:** é possível informar uma fatura sem compras; cadastrar compras depois reduz apenas a diferença; pagamentos parciais reduzem o devido e a conta vinculada uma vez; compras e pagamento não duplicam os gastos do mês.

## 2. Saldos bancários que podem ser conferidos

Cada conta mostra **saldo informado em [data]**, **movimentos lançados depois** e **saldo calculado agora**. O botão **Conferir saldo** grava uma nova fotografia do saldo observado, sem substituir a conferência anterior. Uma fotografia é um ponto de partida do cálculo, não uma receita ou despesa.

Se o saldo observado difere do calculado, a tela mostra a diferença e oferece **Procurar lançamento faltante** ou **Manter como ajuste de saldo a revisar**. O ajuste não entra como gasto de categoria até que a pessoa identifique sua causa. A conferência representa o saldo ao fim da data informada: movimentos dessa data já estão incluídos. Se um lançamento for incluído depois com a mesma data ou uma data anterior, o app pede nova conferência em vez de recalcular silenciosamente. Transferências movimentam duas contas; compra no cartão não debita banco até o pagamento da fatura.

O saldo e as conferências são privados por padrão, com controle explícito de compartilhamento por conta já existente. Gastos pessoais de um membro também permanecem privados até que ele os compartilhe. Resumos, buscas, exportações e notificações seguem essas escolhas; um total agregado não pode revelar o valor oculto. Nenhuma senha bancária é pedida; a primeira versão usa saldos informados manualmente.

**Dados propostos:** conferências de saldo imutáveis por conta com valor, data base, instante do registro, autor, observação e versão de revisão. Preservar o saldo base atual na migração. O cálculo usa a conferência mais recente e os movimentos com data posterior.

**Concluído quando:** uma nova conferência não apaga a antiga; um pagamento de fatura desconta uma única vez; editar um lançamento antigo sinaliza que o saldo precisa ser reconferido; a privacidade é a mesma no celular, desktop e API.

## 3. Catálogo, despensa e modo mercado

O seletor de produto busca em um catálogo inicial de itens comuns, organizado por **alimentos, bebidas, limpeza, higiene, bebê, pets e casa**. Busca tolera acentos e apelidos. Favoritos e itens usados recentemente aparecem primeiro. Se não encontrar, a pessoa toca em **Criar item**, informa nome e unidade, e o produto passa a integrar o catálogo da família. O catálogo sugere produtos; ele não presume estoque ou preço de supermercado.

Cada produto pode ter variantes como pacote de 1 kg, garrafa de 2 L ou unidade. A despensa registra quantidade, local, mínimo, consumo estimado e validade quando conhecidos. Atalhos **Comprei**, **Usei**, **Acabou** e **Conferir** gravam movimentos simples; a tela distingue quantidade contada de estimativa. Produtos próximos da validade aparecem antes de sugestões de reposição.

No **modo mercado**, a lista é agrupada por seção e permite marcar apenas o que entrou no carrinho, corrigir quantidade/preço com uma mão e adicionar item novo sem sair da compra. Ao concluir, a pessoa confirma o total real, forma de pagamento, conta ou cartão e itens adquiridos. Só esses itens aumentam o estoque; os restantes ficam na lista. A compra financeira é criada uma vez. Valores por item podem permanecer desconhecidos quando só se conhece o total da nota.

Preços por loja e comparação por kg/L/unidade entram depois do fluxo básico. O nome de uma loja e preços serão informados pela família; o catálogo inicial não promete disponibilidade nem preços atuais de redes comerciais. OCR, voz e código de barras ficam como sugestões futuras e sempre geram rascunho para conferência.

**Dados propostos:** catálogo de referência com nomes genéricos e aliases; itens personalizados por lar; vínculos estáveis entre catálogo, despensa e lista; movimentos de estoque e histórico de compra. Migrar nomes existentes por correspondência inequívoca e deixar casos duvidosos para revisão, preservando quantidade e lançamentos.

**Concluído quando:** um item comum é encontrado rapidamente; um item novo pode ser criado na própria busca; compra parcial mantém o restante na lista; concluir duas vezes não duplica gasto nem estoque; itens avulsos continuam possíveis.

## 4. Calendário e rotina da casa

O calendário combina **compromissos familiares, vencimentos financeiros, lembretes e tarefas**. Contas a pagar, faturas e parcelas aparecem a partir dos registros financeiros, sem criar lembretes duplicados. Ao informar pagamento, a data mostra o compromisso como pago. A pessoa pode alternar mês, semana e agenda do dia; tocar num evento abre o registro e sua ação principal.

Lembretes e tarefas podem ter responsável, hora, antecedência e repetição. Concluir uma ocorrência semanal ou mensal não elimina as próximas. Post-its continuam como recados sem data. Os avisos dentro do app vêm primeiro; notificações do aparelho dependem de permissão e infraestrutura de entrega, com horário silencioso e escolha de tipos por pessoa.

Rotinas opcionais incluem troca de filtro, limpeza, remédio, consulta, escola e manutenção da casa. Os modelos são pontos de partida editáveis. Eventos privados respeitam o mesmo acesso do registro que os originou.

**Dados propostos:** ampliar os lembretes atuais em vez de criar um segundo calendário isolado; guardar conclusão por ocorrência; gerar eventos financeiros por consulta à fonte; manter identificador estável para evitar duplicação.

**Concluído quando:** uma fatura aparece na data certa e muda de estado após pagamento; um lembrete recorrente pode ser concluído apenas neste ciclo; dois membros veem a mesma agenda compartilhada sem acessar dados privados.

## Ordem de execução

| Etapa | Entrega | Dependência | Verificação principal |
| --- | --- | --- | --- |
| 0 | Confirmar estado publicado, mapear dados existentes e desenhar telas móveis dos quatro fluxos | — | Protótipos mostram entrada, revisão e erro sem perder dados |
| 1 | Fatura informada, diferença calculada e pagamento por conta | 0 | Exemplo de R$ 700 acima fecha em todas as telas |
| 2 | Histórico de conferências de saldo e divergências | 1 | Conta e fatura concordam após pagamento e transferência |
| 3 | Catálogo da família, busca, novo produto e vínculo com despensa/lista | 0 | Produtos antigos continuam acessíveis; novos não duplicam facilmente |
| 4 | Modo mercado e movimentos de estoque | 3 | Compra parcial, reenvio e dois celulares mantêm um único resultado |
| 5 | Calendário financeiro, agenda e ocorrências recorrentes | 1, 2 | Vencimentos e quitações atualizam sem lembretes duplicados |
| 6 | Painel, alertas explicáveis e acabamento visual/acessível | 1–5 | A pessoa encontra a próxima ação e entende de onde veio cada valor |

Cada etapa inclui migração aditiva, controle de acesso por lar/usuário, verificação de cálculos e retorno para a versão anterior da interface. Como o Supabase é compartilhado com outros projetos, usar somente objetos do Financeiro360 e conferir o impacto antes de publicar. Conferir em celular pequeno e desktop, com texto ampliado, teclado, foco visível e áreas de toque adequadas. Dados reais só serão reclassificados por quem tem acesso autenticado e após revisão dos casos ambíguos.

## Ideias para depois da base

- **Fechamento do mês:** uma lista curta para conferir faturas, saldos, contas pagas e compras ainda sem categoria.
- **Planejamento do caixa:** mostrar se os saldos conhecidos cobrem os vencimentos até a próxima receita prevista, com fontes e incertezas visíveis.
- **Manutenção da casa:** prazos de garantia, filtros, revisões e documentos anexados ao item da casa.
- **Refeições da semana:** sugerir o uso do que está perto de vencer e acrescentar ingredientes ausentes à lista.
- **Histórico de preços:** comparar mercados por preço unitário apenas quando houver dados suficientes informados.
- **Atalhos pessoais:** cada pessoa escolhe os cartões, contas, produtos e ações que quer ver primeiro.

Integração automática com bancos e leitura automática de notas exigem uma decisão separada sobre custo, privacidade, consentimento e confiabilidade. O fluxo manual acima já entrega valor sem depender dessas integrações.

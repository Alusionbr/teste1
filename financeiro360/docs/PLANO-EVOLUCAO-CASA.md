# Financeiro360 — plano de evolução para organização da casa

Data: 05/10/2026. Estado: execução por etapas autorizada; primeiro lote S01–S03 em andamento com Sol. Acompanhe [EXECUCAO-CASA.md](EXECUCAO-CASA.md).
Base conferida: `main`, commit `4e8800d5a81e3cd3b55dc75b96b5af7bc8d888c7`.
Produto: https://alusionbr.github.io/teste1/financeiro360/

Próximo ciclo proposto em 08/10/2026: [faturas, saldos, despensa e calendário](PLANO-FATURAS-SALDOS-DESPENSA-CALENDARIO.md).

## 1. Resultado que queremos

Uma pessoa sem experiência com aplicativos financeiros consegue registrar um gasto, entender suas parcelas, organizar as compras e saber o que precisa fazer em casa. O celular é o dispositivo principal; o desktop facilita planejamento, revisão e administração.

O administrador acompanha todas as áreas e os registros da família. Os membros acessam seus próprios registros e os compartilhados explicitamente. Cada usuário personaliza sua experiência. A casa compartilha estoque, listas e rotinas conforme as permissões.

Princípio de produto: cada tela deve responder uma pergunta e oferecer uma ação principal. Recursos adicionais aparecem quando necessários. O primeiro uso começa com poucas informações e pode ser retomado depois.

## 2. Base e limites desta análise

O roteiro considera o relato real de dificuldade com parcelas, os requisitos da família e leitura do código publicado. Foram examinados `src/family/app.ts`, `model.ts`, `api.ts`, `style.css`, README e operação do projeto. O SHA do GitHub foi conferido.

Não foi realizada uma nova auditoria visual: o navegador de captura exigido pela skill de Product Design não estava disponível nesta sessão. Observações sobre telas abaixo se referem à estrutura do código; comportamento visual e acessibilidade precisam ser conferidos na execução. Metas de usabilidade são critérios propostos, não resultados medidos.

| Evidência atual | Efeito a tratar | Prioridade |
| --- | --- | --- |
| `entryForm()` reúne despesa, receita, transferência, pagamento de fatura e dívida; exibe campos de várias operações | O usuário precisa interpretar campos que não pertencem à tarefa atual | P0 |
| `metrics()` conta a compra inteira na data; `invoice()` distribui parcelas | O total comprado pode ser confundido com o compromisso do mês | P0 |
| `cards()` lista compras de todos os meses no detalhamento, usando o valor da primeira parcela | O detalhe não representa necessariamente a fatura escolhida; parcelas com centavos diferentes podem parecer iguais | P0 |
| `syncInstallmentPreview()` calcula datas enquanto o campo de data pode estar vazio | Conferir e tratar data incompleta antes de chamar a função de calendário | P0 |
| Data inicial de fatura é calculada com o fechamento atual do cartão | Alterar o fechamento pode deslocar previsões de compras antigas | P0 |
| Compra de mercado inicia todos os itens marcados e parte do total estimado | É fácil concluir produtos que ainda não foram comprados | P1 |
| Despensa usa consumo diário e quantidade estimada; produto tem uma única validade | Exige conhecimento numérico e não representa lotes com vencimentos diferentes | P1 |
| Configurações não possuem tema, fontes, atalhos nem organização do painel | Falta a personalização solicitada | P1 |
| Grande parte da interface e dos eventos está em um único `app.ts` | Cada nova função amplia a chance de interferir em outros formulários | P0, incremental |
| Fluxo de confirmação já redirecionou para localhost | Conferir retorno ao app e recuperação de acesso na configuração real | P0 |
| README ainda descreve situações anteriores à ativação e ao uso real | Documentação operacional deve refletir o estado atual, sem publicar dados da família | P0 |

## 3. Navegação e linguagem

Barra inferior com cinco destinos fixos:

| Área | Conteúdo principal |
| --- | --- |
| Início | O que vence, o que comprar, tarefas de hoje, resumo financeiro e atalhos escolhidos |
| Dinheiro | Gastos, receitas, cartões, contas, orçamento, metas e documentos financeiros |
| Compras | Lista compartilhada, modo mercado, comparação de preços e histórico |
| Casa | Despensa, validade, refeições, tarefas, manutenção e documentos domésticos |
| Perfil | Aparência, preferências, ajuda, notificações e acesso; administração para quem tem permissão |

Botão visível “Adicionar”, com ações por contexto: gasto, conta a pagar, item da lista e tarefa. Em Dinheiro, destaque “Registrar gasto”; no mercado, “Adicionar produto”. No desktop, a navegação lateral segue a mesma organização.

Começar no modo simples. “Mais opções” revela transferência, dívida e controles avançados. O usuário pode fixar funções favoritas sem mudar a navegação básica.

Texto direto: “Quem pode ver?”, “Vence em”, “Já paguei”, “Valor de cada parcela”, “Conferir antes de salvar”. Traduzir mensagens técnicas em instruções úteis. Estado vazio explica o primeiro passo. Erro preserva o que a pessoa digitou e aparece junto ao campo.

## 4. Fluxos essenciais

### Primeiro acesso

Boas-vindas → nome da casa e data/hora local → primeiro gasto ou cartão → painel. Orçamento, membros e despensa são passos opcionais retomáveis. Sugerir instalação na tela inicial quando suportada, com instrução específica para iPhone e Android.

A recuperação de senha deve retornar ao endereço publicado. Em servidor compartilhado, adicionar somente o destino necessário à lista de redirecionamentos; conferir efeitos antes de tocar no Site URL global. Retirar textos que ainda dizem que o banco está aguardando ativação.

### Gasto rápido

1. Valor e descrição; data começa em hoje.
2. Como pagou: Pix, dinheiro, débito ou cartão. Só mostrar campos pertinentes.
3. Categoria sugerida, pessoa e visibilidade indicadas claramente. Sugestões permanecem editáveis.
4. Salvar uma vez; confirmação curta e acesso ao registro para corrigir.

Conta bancária é opcional quando não houver conciliação. Exigir apenas informações necessárias à operação. Data, comprovante e observações ficam em “Mais detalhes”. Favoritos permitem repetir um gasto com nova data, sempre revisando o valor.

### Compra parcelada

Escolher cartão → escolher “Tenho o total” ou “Tenho o valor da parcela” → preencher o valor correspondente → número de parcelas → mês da primeira cobrança.

Exemplo exclusivamente ilustrativo: total de R$ 800,00 em 4 vezes mostra quatro linhas de R$ 200,00, identificadas como 1/4, 2/4, 3/4 e 4/4, com os respectivos meses. A pessoa vê essa previsão antes de salvar. A opção “Tenho o valor da parcela” converte o valor para o total armazenado uma única vez.

O detalhe da fatura selecionada mostra somente suas parcelas. A compra completa tem uma tela própria com total, cronograma, comprovantes e alterações. Ao editar, exibir que a mudança afeta toda a compra; pagamentos já informados exigem conciliação explícita.

Fechamento, vencimento e mês da cobrança devem ter significados separados. A interface usa o mês do vencimento para a navegação da fatura; adaptar as chaves internas com compatibilidade e migração explícita. Permitir ajustar a primeira cobrança conforme a fatura real, sem inventá-la.

### Mercado

Abrir lista → marcar somente o que foi colocado no carrinho → informar quantidade e preço real, se conhecidos → conferir total, forma de pagamento e produtos adquiridos → concluir.

Conclusão registra uma compra e os movimentos de estoque em uma operação única. Deve funcionar também com cartão, reutilizando o fluxo de parcelas. Itens não adquiridos permanecem na lista. Produtos por peso aceitam quantidades fracionadas. Diferenças entre soma dos itens e recibo aparecem para conferência, sem inventar preço por item.

### Despensa e rotina

Atalhos “Comprei”, “Usei”, “Acabou”, “Perdi/venceu” e “Conferir quantidade”. O modo simples aceita “um pacote dura mais ou menos duas semanas” e converte isso em estimativa. Quantidade contada e quantidade estimada têm rótulos diferentes.

Tarefas começam com título, responsável e prazo. Repetição, checklist e lembrete são opcionais. Modelos: limpeza, lavanderia, troca de filtro e manutenção. Cada conclusão registra quem fez e quando; a tarefa seguinte é gerada sem duplicação.

## 5. Personalização por pessoa

| Preferência | Proposta | Regra de uso |
| --- | --- | --- |
| Tema | Claro, escuro ou acompanhar o aparelho | Aplicar desde o início do carregamento |
| Cor | Paletas previamente verificadas | Conservar contraste em botões, textos e alertas |
| Leitura | Fonte padrão ou maior; espaçamento confortável | Respeitar zoom e fontes do sistema |
| Página inicial | Escolher e ordenar blocos | Oferecer botões “Subir/Descer” além de arrastar |
| Atalhos | Fixar cartão, lista, ação ou área favorita | Respeitar permissões atuais |
| Complexidade | Modo simples e recursos avançados opcionais | Ajuda disponível em ambos |
| Exibição de valores | Mostrar/ocultar valores na tela | É uma preferência visual, sem conceder acesso |
| Listas | Lista ou cartões, ordenação e filtros favoritos | Manter preferência por usuário |
| Alertas | Tipos, antecedência e horário silencioso | Solicitar permissão do dispositivo no momento adequado |
| Identidade | Nome de exibição, avatar e nome da casa | Preferências pessoais e dados da casa têm responsáveis distintos |

Salvar preferências pessoais por conta para manter consistência entre celular e desktop. Um cache local pode guardar tema e tamanho de fonte; limpar dados específicos da conta ao sair e impedir que outro usuário herde suas preferências privadas. Oferecer “Restaurar aparência padrão”.

O administrador define padrões iniciais da casa. Cada pessoa escolhe sua aparência. Configurações de leitura e tema nunca alteram cálculos financeiros, compartilhamento ou permissões.

## 6. Planejamento financeiro compreensível

O painel precisa distinguir três perguntas:

| Pergunta | Cálculo e explicação |
| --- | --- |
| O que compramos? | Total das compras por data, útil para consumo e categorias |
| Quanto precisamos pagar neste mês? | Contas e parcelas da competência selecionada, sem incluir a compra inteira novamente |
| Quanto entrou ou saiu das contas? | Movimentos efetivamente informados, com pagamentos de fatura e transferências tratados corretamente |

O modo simples destaca “A pagar no mês”, “Já pago”, “Receitas informadas” e “Orçamento disponível”. Cada número tem “Ver composição”. Os indicadores especificam se incluem valores previstos, realizados ou em revisão. Não subtrair a fatura duas vezes quando ela já foi paga.

Orçamentos por mês e categoria; metas com aportes; reserva para despesas anuais como impostos, material escolar e seguros; calendário de contas; previsão dos próximos 3, 6 e 12 meses; assinaturas recorrentes; divisão opcional de despesas entre membros.

“Quanto posso gastar?” só deve ser calculado com base identificada: saldos conhecidos, entradas previstas explicitamente cadastradas e compromissos conhecidos. Se faltarem dados, mostrar o que falta. Estimativas não representam saldo bancário disponível.

Regras financeiras a fechar antes da implementação:

- Armazenar dinheiro em centavos e distribuir sobras de centavos mantendo a soma exata.
- Congelar o cronograma da compra; mudança de fechamento vale para novas compras ou revisão explícita.
- Registrar pagamentos parciais, adiantamentos, estornos, cancelamentos e juros com histórico.
- Limite do cartão é uma estimativa baseada no histórico registrado; limite informado pelo banco pode ser diferente.
- Recorrência gera compromissos, nunca pagamentos. Alteração oferece “este mês” ou “próximos meses”.
- Transferências e pagamentos não criam uma segunda despesa de consumo.
- Uma fatura compartilhada parcialmente deve ser identificada como visão parcial; não mostrar saldo total que revele compras privadas.

## 7. Organização e planejamento da casa

### Despensa e compras

Organizar por cozinha, geladeira, freezer, limpeza e higiene. Trabalhar com unidades compatíveis, tamanho da embalagem e lotes/validade. Comparar preços por kg, litro ou unidade. Lembrar o último preço e o mercado quando informados.

Gerar sugestões para um período escolhido, considerando estoque mínimo, consumo estimado, refeições planejadas e itens já na lista. Exibir por que cada produto foi sugerido. Em estoque incerto, sugerir conferência antes da compra.

Evoluir para leitura de código de barras, entrada por voz e recibos fotografados. Um código não garante cadastro do produto ou preço. Reconhecimento de voz/OCR gera rascunho revisável, identifica campos incertos e pede confirmação antes de salvar registros financeiros.

### Rotina doméstica

Calendário da casa com tarefas, contas e manutenções. Responsáveis, frequência, checklist e notificações escolhidas. Inventário de eletrodomésticos com garantia, manual, nota fiscal e manutenção prevista. Histórico de consumo de água, energia e gás mediante leituras informadas, com comparação explicável.

Planejamento semanal de refeições, receitas habituais, porções e ingredientes ligados à lista de compras. Considerar alimentos próximos da validade. Dietas e restrições são informações opcionais fornecidas pelo usuário, sem inferência automática.

### Colaboração

Mostrar quem atualizou uma lista e quando foi sincronizada. Atualizações simultâneas devem preservar os itens e avisar quando um registro foi alterado por outra pessoa. Pedidos de compra podem ser enviados dentro do app ao administrador, se a família ativar esse fluxo.

Uma rotina doméstica marcada como compartilhada é visível aos membros autorizados. Documentos e registros financeiros mantêm suas próprias regras; compartilhar uma tarefa não expõe o comprovante de uma compra privada.

## 8. Assistência inteligente, com explicações

Começar com regras determinísticas: conta perto do vencimento, parcela que termina, categoria perto do orçamento, aumento de preço por unidade e alimento próximo da validade. Cada aviso apresenta os registros usados, o período e uma ação útil.

Alertas devem ser priorizados e dispensáveis. Evitar mensagens repetidas sem mudança de situação. Comparações precisam de períodos equivalentes e dados suficientes. Um membro recebe explicações calculadas exclusivamente com os dados a que tem acesso.

Em uma fase posterior, oferecer perguntas como “O que vence esta semana?” e “O que falta comprar?”. Recursos com serviços externos exigem configuração de custo e privacidade. A resposta não paga contas, altera valores ou cadastra compras automaticamente; apresenta uma proposta editável quando houver ação.

## 9. Base técnica para crescer

Manter TypeScript/Vite e a integração atual enquanto atendem ao produto. Separar gradualmente `app.ts` em telas, formulários, navegação e componentes reutilizáveis. Extrair cálculos para funções de domínio e normalização do formulário para uma camada específica. Evitar reescrever todo o aplicativo junto com a primeira melhoria.

Domínios propostos: preferências, finanças, cronogramas de parcelas, orçamento, compras, estoque, tarefas, documentos e notificações. Definir contratos entre eles antes de criar tabelas. Novos objetos do servidor mantêm o prefixo do aplicativo e políticas de acesso próprias.

Planejar preferências por usuário; regras de orçamento por casa/dono; compras de mercado e seus itens; movimentos e lotes de estoque; modelos e ocorrências de tarefas; dispositivos inscritos em notificações. A modelagem definitiva e as migrações pertencem à respectiva etapa de implementação.

Para robustez:

- Validação no cliente e no servidor, com mensagens equivalentes e limites numéricos.
- Chave de idempotência para operações que podem ser reenviadas após falha; confirmação somente após persistência.
- Revisão/versão de registro para evitar sobrescrever alterações concorrentes.
- Operações conjuntas de compra, despesa e estoque em transação.
- Arquivamento/restauração com recálculo consistente, trilha de alterações e retenção definida.
- Auditoria útil ao administrador, sem copiar informações privadas para superfícies acessíveis a outros usuários.
- Exportação restaurável de dados e plano de cópia dos anexos; testar restauração em ambiente próprio.
- Monitorar erros, falhas de sincronização e capacidade, com logs que não contenham senhas, tokens ou valores pessoais desnecessários.
- Planejar ambiente de homologação. O servidor compartilhado possui limites comuns de capacidade; prefixos de tabelas não isolam consumo de recursos. Avaliar um projeto dedicado quando disponibilidade ou volume exigirem, com custos conhecidos.

Uso sem internet começa com aviso claro e leitura segura do que estiver disponível. Captura offline de gastos é uma etapa posterior: precisa de decisão explícita sobre armazenamento no aparelho, fila idempotente, estado “aguardando envio”, política de expiração e tratamento de conflitos. Nunca afirmar que foi salvo na nuvem quando está apenas no aparelho.

## 10. Sequência de execução com Sol

Tamanho relativo: P = mudança localizada; M = fluxo ou domínio; G = várias entregas que devem ser subdivididas. Não são estimativas de prazo.

| Ordem / ID | Entrega | Tamanho | Dependência | Critério principal |
| --- | --- | --- | --- | --- |
| 1 / S01 | Reconciliar código atual, documentação, acesso e casos das parcelas | M | — | Base reproduzível e problemas de cálculo separados dos de apresentação |
| 2 / S02 | Formulários por tarefa e campos condicionais, estado de rascunho | M | S01 | Gasto comum usa poucos campos; erro mantém preenchimento |
| 3 / S03 | Parcela por mês no detalhe, prévia segura, arredondamento e mês da cobrança | M | S01 | Quatro parcelas aparecem nas quatro faturas corretas e somam o total |
| 4 / S04 | Congelamento do cronograma e edição de compra/cartão | G | S03 | Alterar fechamento não muda histórico silenciosamente |
| 5 / S05 | Navegação em cinco áreas, estados vazios e ajuda contextual | M | S02 | Caminhos de gasto, lista e tarefa são encontrados sem orientação |
| 6 / S06 | Componentes e tokens visuais, fontes e acessibilidade básica | M | S05 | Fluxos funcionam com toque, teclado, zoom e texto maior |
| 7 / S07 | Tema, cores acessíveis, modo simples, preferências por pessoa | M | S06 | Preferências persistem e não interferem na conta de outra pessoa |
| 8 / S08 | Painel personalizável, atalhos, esconder valores e restaurar padrão | M | S07 | Organizar painel funciona com toque e botões acessíveis |
| 9 / S09 | Separar comprado, a pagar e movimentado; composição dos totais | M | S03 | Compra parcelada e pagamento não se somam duas vezes |
| 10 / S10 | Calendário, categorias, orçamentos e despesas anuais | G | S09 | Planejamento por mês é explicável e respeita acesso |
| 11 / S11 | Recorrências, edição futura, lembretes dentro do app | M | S10 | Repetir processamento não duplica compromissos |
| 12 / S12 | Modo mercado, seleção real e preço/quantidade por item | M | S02 | Compra parcial deixa itens faltantes na lista |
| 13 / S13 | Compra integrada com cartão e estoque, reenvio e conflitos | G | S03, S12 | Reenvio e dois celulares não duplicam compra nem estoque |
| 14 / S14 | Despensa por locais, movimentos, validade e consumo simples | G | S13 | Contagem real e estimativa são distinguíveis e conciliáveis |
| 15 / S15 | Histórico e comparação de preço por unidade | M | S12, S14 | Embalagens diferentes são comparadas na mesma unidade |
| 16 / S16 | Tarefas domésticas, responsáveis e calendário familiar | G | S05 | Conclusão e repetição funcionam sem duplicação |
| 17 / S17 | Manutenção, garantias e documentos domésticos | M | S16 | Cada bem reúne compromissos e documentos autorizados |
| 18 / S18 | Refeições, receitas e lista de ingredientes | G | S14, S16 | Sugestão considera despensa e itens já na lista |
| 19 / S19 | Sugestões e alertas explicáveis | M | S09, S14 | Todo alerta mostra motivo e fonte acessível |
| 20 / S20 | Notificações push com preferências e horários | G | S11, S16 | Desativar ou revogar acesso interrompe entregas futuras |
| 21 / S21 | OCR, voz e código de barras como rascunho | G | S02, S12 | Nenhum reconhecimento vira gasto definitivo sem revisão |
| 22 / S22 | Operação offline, recuperação e capacidade | G | S13 | Fila, conflitos, logout e restauração foram exercitados |

Confiabilidade, permissões e privacidade fazem parte de todas as entregas, desde S01. S22 amplia a operação; não adia requisitos básicos de integridade para o final.

Publicar em lotes pequenos: primeiro S01–S03; depois S04–S08; depois S09–S15. Rotinas domésticas e automações seguem quando esses fluxos estiverem compreensíveis. Recursos opcionais permanecem desativados até a pessoa escolhê-los.

## 11. Critérios para liberar cada etapa

1. Verificar no celular em larguras pequenas e no desktop, incluindo teclado aberto, orientação e retorno ao app.
2. Conferir toque de aproximadamente 44 × 44 px, foco visível, nomes acessíveis, contraste WCAG AA, texto ampliado e leitura com tecnologia assistiva. Capturas ajudam, mas não comprovam conformidade sozinhas.
3. Exercitar administração e membro em sessões separadas; dados privados não aparecem em totais, buscas, exportações, alertas, anexos ou sugestões de outros membros.
4. Para finanças: testar parcelas com resto de centavos, virada de ano, fechamento/vencimento em meses diferentes, data incompleta, primeira cobrança ajustada, pagamento parcial, estorno e edição.
5. Para compras/rotinas: verificar reenvio, compra parcial, concorrência, perda de conexão, produtos sem estoque vinculado e tarefa repetida.
6. Mudanças de banco precisam de migração versionada, cópia de segurança proporcional ao risco, verificação em ambiente de teste e retorno definido. Dados reais só mudam com intenção explícita do usuário.
7. Exigir typecheck, build e testes pertinentes; verificar a etapa Financeiro360 no workflow, pois o workflow geral usa `continue-on-error` em algumas etapas.
8. Conferir o endereço publicado e o comportamento final com dados sintéticos ou registros autorizados. Documentar limitações que ainda existam.

Metas de usabilidade para validação com pessoas: pelo menos 4 de 5 participantes sem treino conseguem lançar um gasto, encontrar uma parcela futura e concluir uma compra parcial sem ajuda. Gasto rotineiro em até 20 segundos após familiarização. Medir antes/depois; ajustar esses objetivos com evidência.

## 12. Entrega imediata recomendada

Executar S01–S03 em PRs pequenos. Primeiro resolver o que uma pessoa entende por “gasto do mês” e “parcela”; depois ampliar a personalização. Para iniciar, usar [INSTRUCOES-SOL.md](INSTRUCOES-SOL.md).

O primeiro lote está concluído quando uma pessoa consegue cadastrar uma compra usando total ou parcela, conferir o cronograma, encontrar cada parcela na fatura correspondente e corrigir o registro sem orientação externa.

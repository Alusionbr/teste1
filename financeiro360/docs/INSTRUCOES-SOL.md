# Instruções de execução para Sol

Leia `AGENTS.md` e `financeiro360/docs/PLANO-EVOLUCAO-CASA.md`. O usuário pediu planejar primeiro e executar depois com Sol. Este documento é a passagem de contexto; a criação dele não inicia implementação.

Ao receber a instrução para executar, comece pelo lote S01–S03. Continue as próximas fases conforme a autorização vigente. Use o código atual do GitHub, confira alterações locais e preserve os registros reais. A base deste plano é o commit `4e8800d5a81e3cd3b55dc75b96b5af7bc8d888c7`, conferido em 05/10/2026; ela pode ter avançado.

## Resultado do primeiro lote

Uma pessoa leiga registra um gasto com os campos necessários à tarefa. Compra parcelada aceita total ou valor de cada parcela, mostra uma previsão compreensível e aparece na fatura de cada mês como “parcela 1/4”, “2/4” etc. Os totais são explicados sem contar a mesma despesa duas vezes.

## Sequência prática

1. Examinar `src/family/app.ts`, `model.ts`, `api.ts`, `style.css` e os testes relevantes. Conferir a versão publicada. Capturar os fluxos em celular e desktop com o navegador autorizado disponível.
2. Registrar os casos atuais: compra parcelada, primeira fatura, centavos, data incompleta, edição, pagamento parcial e acesso por membro. Usar dados sintéticos.
3. Extrair os formulários e cálculos necessários em mudanças pequenas, preservando o comportamento que já está correto.
4. Separar “Registrar gasto”, “Conta a pagar”, “Receita”, “Transferência”, “Pagar fatura” e “Pagamento de dívida”. Dar destaque ao gasto comum; os demais fluxos aparecem no contexto apropriado.
5. Fazer a escolha total/parcela anteceder o campo de valor. Mostrar apenas campos aplicáveis; proteger rascunhos contra re-renderização e falha de envio. Datas incompletas não podem derrubar a prévia.
6. Corrigir o detalhamento da fatura para usar as parcelas do mês escolhido, com número da parcela, valor exato e vínculo com a compra original. A soma das linhas deve bater com o total calculado.
7. Definir explicitamente competência da fatura e vencimento. Se a mudança exigir migração de cronogramas ou dados, preparar a compatibilidade e incluir S04 como dependência antes de alterar a regra em produção.
8. Conferir permissões no servidor e tratamento de erros. Usar o fluxo normal autenticado para alterações autorizadas, sem desativar regras do banco nem atribuir artificialmente identidade de usuário em SQL.
9. Rodar verificações relevantes, abrir PRs com comportamento final e evidência, conferir o resultado publicado conforme autorização vigente. Atualizar a documentação operacional.

## Restrições do produto

- Português do Brasil, celular como principal dispositivo e desktop funcional.
- Administrador vê a família; membro vê próprios registros e compartilhamentos explícitos. Preferência visual não concede acesso.
- O site está publicado em `https://alusionbr.github.io/teste1/financeiro360/`.
- O servidor é compartilhado com outro aplicativo. Usar objetos exclusivos do Financeiro360; avaliar capacidade e configurações globais antes de qualquer mudança.
- Dinheiro em centavos, cronogramas determinísticos, total único por compra e idempotência nas operações conjuntas.
- O problema real de lançamento parcelado já recebeu uma correção pontual de valor autorizada pelo usuário. Não reaplicar multiplicações nem recalcular compras reais em lote por suposição.
- Migração automática de valores atuais para “valor de cada parcela” não é autorizada. O total já armazenado continua sendo o total da compra.
- Não colocar credenciais, despesas reais ou arquivos pessoais em commits, fixtures, screenshots públicas ou PRs.
- Personalização completa entra em S06–S08. Preferir evolução incremental da stack atual.

## Verificação mínima para este lote

Typecheck, build, testes de domínio pertinentes e exercício do fluxo em celular/desktop. Parcelas com centavos, mudança de mês/ano e pagamento não podem alterar a soma indevidamente. Verificar admin e membro em sessões distintas. No workflow de publicação, inspecionar as etapas de validação, build e inclusão do Financeiro360; o sucesso geral isolado não comprova que o app entrou no artefato.

Apresentar ao usuário o que ficou mais fácil, o que foi verificado e qualquer pendência material. Avançar dentro da autorização existente, pedindo esclarecimento somente quando a informação faltar para uma decisão relevante.

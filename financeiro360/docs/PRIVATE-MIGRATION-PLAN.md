# Plano de evolução e migração privada

## Situação atual

O MVP registra dados manualmente em um único navegador. “Esposa” e “Marido” são rótulos de atribuição, sem autenticação. Quem abre o mesmo navegador pode ver todos os lançamentos e backups. Exportar JSON exige cuidado porque o arquivo contém os valores e descrições completos.

A importação atual serve para backups no formato do próprio Financeiro360. Ela valida a estrutura, mostra contagens, período e uma amostra, pede a origem informada por quem importa e só então substitui os dados locais. Ela não extrai informação automaticamente de conversas, anexos ou extratos.

## Próximas etapas para contas, dívidas e privacidade

1. **Definir a fronteira de acesso.** Confirmar quais pessoas terão contas separadas, o que cada uma pode ver ou editar e como despesas pessoais e compartilhadas aparecem nas faturas. Sem essa definição, não há base segura para sincronização.
2. **Modelar contas e obrigações.** Distinguir conta bancária pessoal, conta de empresa e conta compartilhada; registrar titular e escopo. Para dívidas, separar valor original, saldo informado, vencimentos e pagamentos. Transferências e pagamentos de fatura precisam de regras para não duplicar gastos.
3. **Escolher armazenamento e autorização.** Caso haja sincronização, projetar autenticação, políticas por registro, auditoria, migração e rollback antes de conectar um serviço. Não presumir que um banco de outro produto pertence ao Financeiro360.
4. **Preparar migração privada.** Reconciliar cada registro histórico com uma fonte acessível. Para cada item, guardar descrição, valor, data ou mês, pessoa, conta/cartão, escopo, origem e estado de confiança. Valores, datas ou anexos ausentes ficam pendentes de revisão, sem adivinhação.
5. **Revisar e importar localmente.** Gerar o arquivo privado fora do repositório, conferir totais e duplicatas com o usuário, importar pelo fluxo de revisão e manter backup anterior para retorno. Nenhum dado real ou credencial deve ser commitado, anexado ao PR ou usado em exemplos públicos.

## Critério para liberar migração

O usuário deve confirmar a política de visibilidade, o destino dos dados incertos e a lista conciliada de registros. Até lá, este PR permanece sem nomes, saldos ou transações reais. A prévia de importação é uma proteção contra substituição acidental, não uma validação contábil ou verificação da fonte.

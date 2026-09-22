# Plano de evolução e migração privada

## Situação atual

O MVP registra dados manualmente em um único navegador. “Esposa” e “Marido” são rótulos de atribuição, sem autenticação. Quem abre o mesmo navegador pode ver todos os lançamentos e backups. Exportar JSON exige cuidado porque o arquivo contém os valores e descrições completos.

A importação atual serve para backups no formato do próprio Financeiro360. Ela valida a estrutura, mostra contagens, período e uma amostra, pede a origem informada por quem importa e só então substitui os dados locais. Ela não extrai informação automaticamente de conversas, anexos ou extratos.

## Próximas etapas de privacidade e migração

1. **Definir a fronteira de acesso.** Confirmar quais pessoas terão contas separadas, o que cada uma pode ver ou editar e como despesas pessoais e compartilhadas aparecem nas faturas. Sem essa definição, não há base segura para sincronização.
2. **Conferir contas e obrigações.** O modelo local já distingue conta pessoal, da empresa e da família, transferências e pagamentos parciais de principal. Validar nomenclatura, saldos de referência e regras de fatura antes de dados reais.
3. **Escolher armazenamento e autorização.** Caso haja sincronização, projetar autenticação, políticas por registro, auditoria, migração e rollback antes de conectar um serviço. Não presumir que um banco de outro produto pertence ao Financeiro360.
4. **Preparar migração privada.** Reconciliar cada registro histórico com uma fonte acessível. Para cada item, guardar descrição, valor, data ou mês, pessoa, conta/cartão, escopo, origem e estado de confiança. Valores, datas ou anexos ausentes ficam pendentes de revisão, sem adivinhação.
5. **Revisar e importar localmente.** Gerar o arquivo privado fora do histórico do Git, conferir totais e duplicatas com o usuário, importar pelo fluxo de revisão e manter backup anterior para retorno. Nenhum dado real ou credencial deve ser commitado, anexado ao PR ou usado em exemplos públicos.

## Critério para liberar migração

O usuário deve confirmar a política de visibilidade, o destino dos dados incertos e a lista conciliada de registros. Até lá, este PR permanece sem nomes, saldos ou transações reais. A prévia de importação é uma proteção contra substituição acidental, não uma validação contábil ou verificação da fonte.

## Modelo local e evolução proposta

O modelo local agora contém contas, transferências, dívidas com pagamentos de principal e registros pendentes. Ainda não protege dados por pessoa nem concilia faturas. Uma versão sincronizada deve consolidar estes conceitos antes da migração histórica:

| Entidade | Campos essenciais | Regra |
| --- | --- | --- |
| Conta | `id`, tipo (pessoal, empresa ou compartilhada), titular, moeda, saldo inicial `amountCents | null`, data do saldo `date | null` | `null` significa desconhecido; jamais converter para zero ou calcular saldo disponível sem base confirmada. |
| Cartão | `id`, titular, fechamento, vencimento, limite conhecido ou `null`, conta de pagamento opcional | Uma compra no cartão cria gasto e obrigação na fatura; pagamento da fatura reduz conta e obrigação, sem criar novo gasto. |
| Evento financeiro | `id`, tipo, valor `amountCents | null`, data `date | null`, conta/cartão de origem e destino quando aplicável, pessoa, escopo, categoria, origem e estado | Eventos pendentes por data ou valor incerto ficam fora dos totais até revisão. |
| Obrigação | `id`, tipo, credor, responsável, escopo, principal e saldo conhecidos ou `null`, calendário, fonte e estado | Pagamento do principal reduz conta e obrigação; apenas juros/taxas são despesa nova. Aluguel mensal é despesa prevista, não amortização de dívida. |
| Fonte | identificador local, tipo (anotação, extrato, fatura ou confirmação manual), referência, data da coleta e grau de confiança | Permite rastrear por que um valor entrou no sistema; não incluir anexos ou credenciais no repositório. |

Tipos de evento necessários: `income`, `expense`, `account_transfer`, `card_charge`, `card_settlement`, `debt_principal_payment` e `debt_fee`. Transferência entre contas próprias altera dois saldos e **não** vira receita nem despesa. Compra parcelada registra um gasto uma vez e parcelas na obrigação do cartão. Uma conta de empresa não entra nos totais do lar sem lançamento explícito de retirada ou transferência classificada.

Cada registro migrado deve ter `status: confirmed | pending_review`, `sourceRef` e a indicação do campo incerto. Data, valor e saldo desconhecidos permanecem `null`; não inferir valores a partir de conversas incompletas. A visualização de revisão deve mostrar pendências separadas, origem e possível duplicata antes de qualquer confirmação.

## Sequência técnica proposta

1. Aprovar visibilidade de cada escopo e decidir se haverá sincronização. Se houver contas separadas, impor autorização no servidor e no banco, com negação por padrão e testes de acesso cruzado. Rótulos na interface não são proteção.
2. Planejar schema sincronizado e adaptador dos backups locais, preservando lançamentos, contas, transferências, dívidas e pendências. Definir migração reversível e exportação antes da mudança.
3. Concluir conciliação de faturas e tratamento de juros/taxas. Testar parcelas, vencimentos, pagamentos parciais e ausência de dupla contagem.
4. Preparar um arquivo de migração **fora do Git**, em `financeiro360/local-data/` ou `financeiro360/private/` (ignorados pelo Git), revisar item por item com o usuário, importar apenas confirmados e manter pendentes sem afetar totais. Validar totais por conta/cartão e permitir desfazer a importação pelo backup anterior.

## Formato local de candidatos pendentes

O backup do aplicativo é um JSON com `version: 1` e arrays de `cards`, `entries`, `market`, `recurring`, `accounts`, `transfers`, `obligations` e `pending`. Para gerar um arquivo privado de migração, exporte um backup vazio pelo app e edite **uma cópia local ignorada pelo Git**. Cada item em `pending` usa:

```ts
{
  id: string;                   // identificador único, sem informação pessoal
  description: string;          // resumo legível
  date: string | null;          // data da transação; null se incerta
  amountCents: number | null;   // centavos; null se incerto
  kind: "income" | "expense" | "transfer" | "obligation" | null;
  category: string;             // categoria sugerida ou ""
  buyer: "wife" | "husband" | null;
  scope: "family" | "personal" | null;
  payment: "cash" | "card" | null;
  accountId: string | null;     // conta sugerida cadastrada ou null
  cardId: string | null;        // cartão sugerido cadastrado ou null
  sourceRef: string;            // referência privada da origem
  sourceDate: string | null;    // data da conversa/fonte, diferente de date
  confidence: "unknown" | "probable" | "verified";
  status: "pending_review";
  notes: string;                // dúvida específica a resolver
}
```

A importação valida referências a contas/cartões existentes. Pendências não afetam orçamento, saldos nem faturas. Confirmar uma pendência de receita/despesa cria um lançamento e preserva `sourceRef` e `sourceDate`; transferências e dívidas exigem conciliação nos módulos próprios. Esta estrutura não deve ser usada para inventar data, saldo ou valor ausentes.

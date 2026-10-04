# Status da importação de dados reais

Última atualização: 04/10/2026.

## Princípios

Os dados financeiros reais ficam no Supabase. O repositório público não deve conter extratos, números de conta, CPF/CNPJ, comprovantes, e-mails privados, senhas ou arquivos bancários.

A aplicação usa RLS para separar registros privados dos compartilhados. Lançamentos pessoais do administrador permanecem privados; despesas da casa e pagamentos compartilhados podem ser vistos pelo membro familiar conforme as políticas existentes.

## Carga inicial

A primeira carga foi feita diretamente no banco de produção e cobre o histórico principal de 24/07/2026 a 21/09/2026, além de alguns registros manuais já conciliados.

Estado após a carga:

- 8 contas/representações financeiras cadastradas;
- 6 registros de dívidas/cartões usados para conciliar pagamentos;
- 5 despesas recorrentes cadastradas para os próximos meses;
- 457 lançamentos históricos no banco;
- conta Nubank PJ reconciliada com o extrato do período;
- contas sem extrato recente mantidas com saldo desconhecido.

## Regras de classificação aplicadas

Entre as regras já aplicadas estão:

- transferências entre contas próprias não contam como despesa;
- pagamento de fatura não é contado como novo consumo;
- pagamentos de cartões de outro membro são registrados como liquidação de dívida/cartão;
- gastos de casa podem ser compartilhados;
- gastos pessoais do administrador ficam privados;
- despesas de empresa ficam separadas das despesas pessoais;
- lançamentos cuja finalidade não está suficientemente confirmada recebem categoria de revisão, sem inventar a natureza do gasto.

## Itens ainda sujeitos a confirmação

Alguns lançamentos continuam marcados para revisão por contraparte ou finalidade. Exemplos: determinados pagamentos relacionados a Douglas, parte dos recebimentos de origem ainda não confirmada, movimentações com Renan e compras empresariais sem descrição detalhada.

Esses registros já participam do fluxo de caixa bancário, porque ocorreram de fato, mas a categoria pode ser corrigida posteriormente sem alterar o valor ou a conciliação do extrato.

## Próximas cargas

Ao receber novos extratos:

1. importar o período novo;
2. detectar duplicatas pelo identificador de origem;
3. conciliar saldos conhecidos;
4. aplicar regras existentes;
5. deixar dúvidas em revisão;
6. nunca publicar o arquivo bruto no repositório;
7. revisar compartilhamento antes de tornar um gasto visível a outro membro.

# Fluxos operacionais

## Fluxo 1 — Configurar negócio

1. Acessar **Negócios**.
2. Criar nome do negócio.
3. Escolher segmento.
4. Definir margem padrão.
5. Definir taxa padrão, se existir.

Resultado: os próximos cadastros ficam vinculados ao negócio ativo.

---

## Fluxo 2 — Cadastrar essência aromática

1. Em **Produtos**, cadastrar a matéria-prima em ml, g, kg ou outra unidade.
2. Cadastrar vidro como embalagem.
3. Cadastrar rótulo como embalagem.
4. Cadastrar caixa como embalagem.
5. Cadastrar tampa/lacre/válvula como embalagem.
6. Cadastrar o produto final.
7. Informar no produto final:
   - mão de obra por unidade;
   - custo fixo rateado por unidade;
   - perda técnica;
   - margem desejada;
   - taxa de venda.
8. Em **Fichas e custos**, adicionar todos os itens usados por unidade.
9. Usar o simulador de custo.

---

## Fluxo 3 — Compra

1. Cadastrar fornecedor, se quiser.
2. Lançar compra em **Compras**.
3. O sistema aumenta estoque.
4. O sistema recalcula custo médio.
5. O sistema cria movimentação de entrada.

---

## Fluxo 4 — Produção

1. Ter produto final cadastrado.
2. Ter ficha técnica cadastrada.
3. Ter estoque dos insumos.
4. Lançar produção.
5. O sistema baixa insumos e embalagens.
6. O sistema calcula custo total.
7. O sistema entra com produto final em estoque.

---

## Fluxo 5 — Venda direta

1. Selecionar produto.
2. Informar quantidade e preço.
3. Informar desconto/taxas, se houver.
4. O sistema baixa estoque.
5. O sistema calcula CMV e lucro.

---

## Fluxo 6 — Pedido

1. Criar pedido em **Pedidos**.
2. Arrastar entre Pendente, Em preparo, Pronto, Despachado e Concluído.
3. Quando sair de fato, usar **Baixar venda**.
4. A baixa cria venda e reduz estoque.

---

## Fluxo 7 — Consignado

1. Cadastrar cliente.
2. Enviar consignado.
3. O sistema baixa estoque central.
4. Quando cliente vender, registrar venda.
5. Quando devolver, registrar devolução.
6. Quando pagar, registrar pagamento.

---

## Fluxo 8 — Tarefas

1. Criar tarefa.
2. Arrastar no Kanban.
3. Usar para controle de compras, produção, cobrança e despacho.

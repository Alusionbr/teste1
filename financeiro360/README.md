# Financeiro360

MVP local para um casal planejar custos do lar. A esposa pode ser titular de um cartão e o marido pode registrar compras feitas nele; titular e responsável pela compra são mostrados separadamente. Há lançamentos manuais de receitas e despesas, orçamento mensal do lar, custos por categoria, faturas previstas com parcelas, lista de mercado com valor estimado e custo real e backup JSON.

**Os dados ficam somente no navegador e dispositivo usados.** Dois celulares não compartilham atualizações automaticamente. O cadastro e os cálculos são locais; não há sincronização, acesso à conta bancária ou captura de fatura. Para transferir dados, exporte um backup JSON em um aparelho e importe no outro. A importação substitui os dados locais após confirmação.

## Executar

Requer Node.js compatível com Vite 7 e npm. Dentro de `financeiro360/`:

```bash
npm ci
npm run dev
```

Para validar:

```bash
npm run typecheck
npm test
npm run build
```

O build sai em `dist/`. As variáveis de `.env.example` são públicas no bundle, portanto nunca use `VITE_` para segredos.

## Como os números são calculados

- **Custo do lar e orçamento:** somam o valor total das despesas familiares no mês da compra. Despesas pessoais aparecem separadas.
- **Fatura:** uma compra no cartão entra na fatura do mês do fechamento se for feita até o dia de fechamento; depois disso, entra na fatura seguinte. Parcelas seguintes vão às faturas dos meses seguintes. Centavos restantes são distribuídos nas primeiras parcelas.
- **Vencimento:** usa o dia cadastrado; se ele for anterior ou igual ao fechamento, considera o mês posterior. Em meses curtos, limita ao último dia.
- **Sem duplicidade:** a fatura é uma visão das compras. O app não cria uma segunda despesa ao exibi-la ou pagá-la.
- **Mercado:** a lista guarda estimativa unitária; registrar o total real de um item gera uma despesa familiar em Mercado. Excluir essa despesa devolve o item à lista pendente.
- **Saldo previsto:** receitas menos despesas registradas por data. Não equivale ao saldo de conta bancária.

Alertas de orçamento aparecem na interface ao abrir o app. Ainda não há recorrências, lembretes do sistema, conciliação de pagamentos da fatura, importação CSV nem integração financeira externa. Cadastros e lançamentos são manuais.

## Isolamento e publicação

Manifesto, lockfile, TypeScript e build são próprios desta pasta. O projeto não usa o workspace de `file360/` e não entra no artefato do GitHub Pages. Futuro deploy independente poderá apontar Root Directory para `financeiro360/` e saída para `dist/`; nenhuma hospedagem foi configurada por esta entrega.

Veja [docs/ARCHITECTURE-BLUEPRINT.md](docs/ARCHITECTURE-BLUEPRINT.md) para a decisão de arquitetura e os limites do MVP.

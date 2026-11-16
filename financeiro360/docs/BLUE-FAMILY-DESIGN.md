# Kit visual Família Azul — Financeiro360

Implementação de camada visual baseada no painel familiar azul, preservando o aplicativo existente.

## Escopo implementado
- Navegação lateral azul com ícones, estados ativos, divisões e perfil.
- Barra superior com mês, atualização, privacidade e atalho de lançamento.
- Dashboard financeiro: gastos, entradas e saídas, contas a pagar, saldo conhecido, orçamento, categorias, previsões e gráfico.
- Transações, contas, cartões, faturas, calendário, metas, compras, despensa, relatórios, categorias e permissões: componentes existentes com acabamento visual unificado.
- Componentes: botões, chips, ícones, cartões, inputs, menus, formulários, diálogos e alertas.
- Layout responsivo: desktop, tablet, celular, barra inferior e áreas seguras.
- Tema claro e escuro, incluindo preferência de acompanhar o sistema.
- Ícone PWA da casa e família, cores do manifesto e navegador.

## Integração e segurança
- `src/family/design-family-blue.css` é uma camada visual importada após `style.css`.
- `preferences.ts` define **Azul** como padrão para perfis novos. Preferências já salvas no Supabase **não são alteradas**; para adotar o azul, escolha Perfil → Aparência → Cor → Azul.
- Tema **Verde** e **Ameixa** seguem disponíveis. A estrutura moderna é aplicada às três paletas.
- Não foram alterados modelos de dados, cálculos, Auth, RLS, queries, cobranças, buckets, tabelas, migrações nem pagamentos.
- Números, transações, permissões e visibilidade permanecem definidos pelo aplicativo existente.
- Não confundir gastos lançados com dinheiro efetivamente pago, nem saldo conhecido com saldo agregado completo.

## Validar antes de integrar
No diretório `financeiro360/`:
```sh
npm ci
npm test
npm run typecheck
npm run build -- --base /teste1/financeiro360/
```
`npm run test:db` requer ambiente PostgreSQL WASM conforme README.

Checklist manual de revisão:
1. Login, redefinição de senha, demonstração (nenhum dado real no ambiente de teste).
2. Desktop ≥1280px; tablet 768–1024px; celular 320px, 375px e 430px.
3. Dashboard, lançamentos, cartões/faturas, calendários, metas, orçamento, compras/despensa e família.
4. Ativar Cor **Azul**, **Verde**, **Ameixa**; tema **Claro**, **Escuro** e **Acompanhar aparelho**.
5. Alternar **Ocultar valores** e confirmar que não aparecem valores inadvertidamente.
6. Conta de membro: assegurar que não exiba registros privados de outro membro.
7. Abrir, salvar e cancelar modais, testar teclado e rolagem com lista extensa.
8. Confirmar que build de produção GitHub Pages não aponta para fontes TS diretamente e que o PWA atualiza o cache.

## Reversão
Reverter o commit da branch ou remover a importação `./design-family-blue.css` em `app.ts`; caso necessário restaurar `preferences.ts`, `icon.svg`, `index.html` e `manifest.webmanifest`. Nenhum rollback de banco é exigido.

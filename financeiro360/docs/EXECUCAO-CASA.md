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

## Parcelas fixas e saldos por conta — segunda entrega

`20261005140612_family_installment_schedule.sql` guarda o mês da primeira fatura para compras novas e quando uma compra antiga é editada. Lançamentos anteriores permanecem sem valor nessa coluna; nenhum gasto real é migrado ou multiplicado. Alterar a data ou o cartão da compra recalcula o início, a menos que o usuário informe o mês desejado. Alterar posteriormente o dia de fechamento do cartão não move uma compra que já tem início salvo. O app mostra a prévia antes de salvar.

`20261005143000_family_private_account_balances.sql` adiciona um consentimento independente para mostrar o saldo. Uma conta compartilhada começa com saldo privado. O servidor soma todos os movimentos pagos após o saldo-base, inclusive registros privados, e entrega apenas o total a outro membro quando o administrador compartilha expressamente esse saldo. Compra no cartão entra na fatura; o pagamento da fatura debita a conta escolhida. Despesa, pagamento de dívida e transferência também atualizam os saldos das contas vinculadas. Saldos desconhecidos continuam desconhecidos.

Depois de publicar e conferir a nova interface, `20261005210932_family_account_balance_read_guard.sql` retira a leitura direta do saldo-base e da data-base pela API de tabela. A interface nova usa `fin_account_overview`; publicar a interface antiga de volta exige restaurar a permissão de leitura anterior ou manter a interface nova. O teste PostgreSQL sintético verifica privacidade, autorização, transferências, pagamentos e centavos. A função pública de saldo é `SECURITY DEFINER` por necessidade de somar movimentos privados; cada linha devolvida passa por `fin_private.visible` e o agregado só sai se `share_balance` estiver ativo ou se quem consulta for titular/administrador.

O GitHub Pages deste repositório também faz uma implantação automática dos arquivos fonte de `main`, que pode chegar antes ou depois do workflow compilado. `fallback/app.js` e `fallback/app.css` são uma cópia da versão pública compilada e validada do Financeiro360. O `index.html` fonte carrega essa cópia somente quando está no Pages sem o bundle do Vite. O workflow próprio copia a pasta fallback junto com `dist`. Atualizar a cópia ao publicar mudanças futuras no app, ou configurar a origem do Pages exclusivamente para GitHub Actions quando houver acesso administrativo à configuração do repositório.

## Edição segura de cartão

Os cartões podem ser editados depois do cadastro: nome, limite, dia de fechamento e vencimento. Ao mudar o fechamento, uma migração fixa o mês da primeira fatura das compras antigas que ainda não tinham cronograma salvo, preservando o ciclo que o painel mostrava antes. Cronogramas já escolhidos ou salvos não mudam. A tela também lembra que basta cadastrar o nome; número completo e código de segurança não são necessários para prever faturas.

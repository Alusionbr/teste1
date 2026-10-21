# Convite da Angélica — guia de continuidade

Convite de aniversário em HTML/CSS/JS puro, publicado pelo GitHub Pages em `/convite-angelica/`.
Confirmações de presença ficam no Supabase; a lista privada é o `admin.html`.

## Arquivos
- `index.html` — página do convite (tela de abertura, detalhes, local, valores, karaokê, RSVP).
- `styles.css` — visual.
- `app.js` — música, contagem regressiva, RSVP, agenda, compartilhamento e karaokê.
- `config.js` — data/horário, endereço e dados de conexão do Supabase.
- `letra.js` — **letra do karaokê** (ver abaixo).
- `admin.html` / `admin.js` — lista privada de confirmações (exige chave de 64 caracteres).

## Regras de comportamento
- O convite **sempre abre com música**: só existe o botão "Abrir convite com música".
  O botão "Tocar/Pausar música" no topo continua disponível para quem quiser pausar depois.
- O karaokê **não altera o resto do layout**: é uma seção própria, que fica escondida
  enquanto `letra.js` não tiver linhas.

## Como colocar a letra no karaokê
1. Abra `letra.js`.
2. Preencha `titulo`, `artista` e `linhas` (uma linha da letra por item).
3. Opcional: marque o segundo em que cada linha começa (`{ t: 12.5, texto: '...' }`)
   para sincronia exata. Sem tempos, a letra é dividida em partes iguais ao longo da música;
   use `inicioSegundos` para pular a introdução.
4. Use somente letra que você tenha autorização para publicar (a página é pública).

## Pendências conhecidas (plano de melhorias)
- Imagem e música estão em links temporários do Picsart (`editing-temp`): baixar para esta pasta.
- Compartilhar sempre a URL limpa (sem `utm_`).
- Pergunta "Quantas pessoas vão com você?" deve deixar claro que conta o próprio convidado.
- Guardar no repositório o SQL das funções `convite_angelica_*` do Supabase.
- Definir contato (WhatsApp) e prazo de confirmação.

## Continuar com outra IA
Entregue a ela esta pasta e este arquivo. Peça para: manter JavaScript puro, não adicionar
bibliotecas, preservar a regra "sempre com música" e testar em tela de 360px.

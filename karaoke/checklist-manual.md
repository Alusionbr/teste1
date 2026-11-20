# Karaokê em Casa — roteiro de teste manual

Rodar antes de publicar. Servir por HTTP (`python3 -m http.server 8765 -d karaoke`); service worker não roda em `file://`.

## Básico

- [ ] Abrir pela primeira vez: tudo vazio, sem dado de exemplo, passos de início na Playlist.
- [ ] Família: adicionar 3 pessoas com emoji e cor; editar uma; remover outra.
- [ ] Nova música pela busca: resultado “✓ sincronizada” cria a música com a letra.
- [ ] Cadastrar sem buscar: colar uma letra simples; “Buscar letra” encontra pelo título e artista.

## Playback

- [ ] Arquivo MP3 do aparelho: escolhe, toca, letra sincroniza; funciona em **modo avião**.
- [ ] YouTube (link comum, `youtu.be` e `music.youtube.com/watch?v=`): toca escondido atrás da letra (“só som”).
- [ ] Colar o link de um clipe oficial de gravadora (ex.: Sia, Chandelier) é recusado na hora, com pedido de outro vídeo.
- [ ] 🎬 alterna: só som → vídeo escurecido → vídeo aparecendo.
- [ ] iPhone/iPad: na primeira música aparece “toque no ▶ do vídeo”; depois as próximas encadeiam sozinhas.
- [ ] Vídeo de clipe oficial bloqueado: aviso claro + Trocar playback / Seguir sem playback.
- [ ] Spotify sem login: aviso de prévia de 30 s; ao acabar a prévia NÃO vai para os aplausos (mostra o aviso). Com login: música inteira, letra acompanha.
- [ ] Anúncio no YouTube: selo “Anúncio — a letra espera” e a letra não corre durante o comercial.
- [ ] Letra −/+ ajusta e fica salvo na música; atraso Bluetooth em Ajustes vale para todas.

## Palco

- [ ] “Agora é a vez de…” com contagem; Começar e Pular funcionam.
- [ ] Linha enche na cor do cantor; próxima linha aparece embaixo; contagem ● ● ● antes do primeiro verso.
- [ ] Dueto: cada parte na cor do seu cantor, com o nome em cima; “Todos” em dourado.
- [ ] Letra sem tempo: rola sozinha pela fração da música, com aviso para gravar a sincronia.
- [ ] Fim: aplausômetro pede microfone, mede 5 s e dá a nota; microfone desliga depois.
- [ ] Controles somem depois de 4 s tocando e voltam ao mexer.
- [ ] Teclado: espaço, ←, →, [, ], F, Esc.

## Lista compartilhada com vídeo do YouTube

- [ ] Ajustes → Fundo → “Só o vídeo do YouTube”: o palco mostra o vídeo entre as barras, sem a letra do app; 🎬 alterna os quatro fundos.
- [ ] Nova música → colar só o link: entra na playlist com o título do vídeo; clipe bloqueado é recusado.
- [ ] Celular → Música nova → colar só o link: a música aparece na fila da tela.
- [ ] Música de Spotify ou arquivo continua com a letra do app nesse modo.

## Cantar sozinho

- [ ] Sem nenhum cantor cadastrado: 🎤 numa música (aba Músicas) abre o palco com “Prepare-se!” e “🎤 Você”.
- [ ] 🎤 Cantar sozinho na Playlist ignora os cantores marcados e passa para a próxima música depois dos aplausos.
- [ ] Fim da música: aplausômetro mede; aparece “🏆 Primeira nota desta música!”; ↺ Cantar de novo repete; a segunda nota mostra “Novo recorde” ou “Seu recorde”.
- [ ] Música avulsa termina em “Fim da música”; ✕ sai em todas as telas.
- [ ] Selo 🏆 aparece na lista de Músicas; Ajustes → Apagar meu placar remove; o backup leva o placar.
- [ ] Controle remoto (celular) liga e comanda o palco em modo solo.

## Gravar sincronia

- [ ] Marcar todos os versos tocando; Desfazer; Pausa ♪; Salvar toca do começo para conferir.
- [ ] Dueto marcado antes continua depois de gravar.

## Celular (sala)

- [ ] `node karaoke/tests/sala-real.js` passa contra o Supabase real (confirma que `001_sala.sql` foi aplicado).
- [ ] Abrir sala: QR code lido pela câmera do celular abre o controle certo.
- [ ] Nome no celular vira cantor na Família da tela.
- [ ] Tocar, pausar, pular, Letra −/+, volume e Medir aplausos funcionam pelo celular.
- [ ] Pedir música da lista entra na fila para o cantor escolhido; ⏫ põe para tocar a seguir.
- [ ] Música nova pelo celular (com link do YouTube) entra na biblioteca e na fila.
- [ ] Tocar numa música da lista abre o painel: colar link do YouTube põe/troca o playback; clipe bloqueado é recusado no celular.
- [ ] ▶ Tocar agora interrompe (com confirmação), ⏫ Tocar a seguir e ＋ Fim da fila funcionam; música com arquivo na tela não tem troca de playback.
- [ ] Playback que falha na tela: o celular mostra o aviso e 🎧 Trocar playback recarrega a música.
- [ ] Recarregar a tela da festa: a mesma sala continua.
- [ ] Desligar a internet da tela: celular mostra “tela não está respondendo”; ao voltar, tudo segue.
- [ ] Fechar sala: o celular avisa que a sala não existe mais.

## Dados

- [ ] Compartilhar com e sem letras; abrir o link em outro navegador cria a playlist.
- [ ] Exportar backup; importar em navegador limpo com Adicionar e com Substituir.
- [ ] Atualização: subir a versão e conferir que o aparelho recebe a nova (aviso “Atualizar”).

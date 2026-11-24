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
- [ ] Vídeo com anúncio real: conferir se o player identifica outra mídia, se a letra espera e se os controles permitem interagir. A detecção é limitada; não presumir que todo anúncio seja identificado.
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

- [ ] Padrão: vídeo do YouTube em tela cheia; parado 4 s, somem as barras e só o player fica; qualquer toque/tecla traz de volta.
- [ ] Nada do player é clicável (a TV nunca vai para a página do YouTube); a sala (celulares, fila) segue funcionando.
- [ ] 🎞/🔤 (ou tecla L, ou botão no celular) liga e desliga a letra do app sem o vídeo parar nem recarregar; 🎬 alterna os quatro fundos. Reabra uma música com “só vídeo” salvo e percorra o ciclo completo, conferindo o som e a continuidade do relógio.
- [ ] Editor de música sem playback: os vídeos já aparecem sozinhos (campo preenchido com “título artista playback karaokê”); duração parecida vem primeiro com selo; tocar num troca o playback; “Já tenho o link” fica recolhido.
- [ ] Celular → Música nova → escolher a letra: os vídeos aparecem sozinhos; tocar num e Pedir esta música.
- [ ] Buscar “evidências” em Nova música (tela) e em ✨ Música nova (celular): aparecem resultados com miniatura; vídeo bloqueado é recusado; escolher entra na playlist/fila.
- [ ] Nova música → campo único: digitar “evidências” + ➕ Adicionar: a música entra na playlist com ▶ vídeo, duração e selo da letra; “Trocar vídeo” mostra outros e recusa clipe bloqueado; “Tirar” desfaz.
- [ ] 📋 Adicionar várias de uma vez: colar 5 músicas (uma com erro de digitação): aparece “n de 5”, o resumo diz quantas entraram; trocar um vídeo; Parar no meio funciona.
- [ ] Celular: ✨ Música nova → digitar o nome → aparece o vídeo escolhido → Pedir na fila (ou Outros vídeos).
- [ ] Ajustes → Exportar backup e importar em outro aparelho: as músicas vêm com letra e vídeo.
- [ ] Com dois celulares, quem não canta pode pausar, retomar e mexer no volume. Só a tela muda a ordem até liberar os atalhos pelo código da sala.
- [ ] Aba Fila → "Só as minhas músicas" com Ana e Ana Paula, no celular de Ana aparece o dueto das duas e fica de fora o solo de Ana Paula; no celular de quem é a vez aparece "É a sua vez!".
- [ ] Música de YouTube com letra: botão 🎞/🔤 guarda a escolha na música (fechar e reabrir mantém); editor tem "Letra no palco".
- [ ] Pedir música nova pelo celular: depois de alguns segundos a música ganha a letra sincronizada na tela (selo ✓).
- [ ] Permissões: em "Só o anfitrião" o celular só consegue pedir música (pausar, pular e fila ficam desligados); em "Só quem canta" só o cantor da vez pausa e pula; "Silenciar" um nome impede até pedir; um ajuste fino vira "Personalizado".
- [ ] Transferir a sala: gerar o convite, abrir o link no aparelho novo (outro navegador/TV): a fila e a música atual passam sozinhas, o antigo oferece "Abrir como controle"; convite vencido (5 min) ou reaproveitado pede aprovação manual.
- [ ] Derrubar a internet ou bloquear os serviços de busca: aparece “A busca não respondeu agora” e o atalho para o YouTube.
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

- [ ] `node karaoke/tests/sala-real.js` passa contra o Supabase real (confirma que `001_sala.sql` e `003_transferencia_tela.sql` foram aplicados).
- [ ] Abrir sala: QR code lido pela câmera do celular abre o controle certo.
- [ ] Abrir a sala na tela atual; no projetor, abrir Controle remoto, digitar o código e pedir para assumir. Confirmar que a tela atual mostra quem pediu.
- [ ] Aprovar na tela atual: fila inteira, ordem, cantores e letras aparecem no projetor. A música atual fica no ponto salvo e aguarda um toque em Começar.
- [ ] Conferir que a tela antiga parou o playback e perdeu o controle da sala; os celulares continuam conectados ao mesmo código.
- [ ] Repetir com músicas da fila usando playback de arquivo local: conferir que esses arquivos precisam ser escolhidos novamente no projetor.
- [ ] Recusar um pedido de transferência: a tela atual continua no ar e o projetor informa que o pedido foi recusado.
- [ ] Nome no celular vira cantor na Família da tela.
- [ ] Tocar, pausar, pular, Letra −/+, volume e Medir aplausos funcionam pelo celular.
- [ ] Pedir música da lista entra na fila para o cantor escolhido; ⏫ põe para tocar a seguir.
- [ ] Música nova pelo celular (com link do YouTube) entra na biblioteca e na fila.
- [ ] Tocar numa música da lista abre o painel: colar link do YouTube põe/troca o playback; clipe bloqueado é recusado no celular.
- [ ] Pedir música sempre acrescenta no fim. Com os atalhos liberados pela tela, o celular consegue tocar ou adiantar um item já na fila. Áudio local continua sendo escolhido na tela.
- [ ] Abrir um vídeo com anúncio na TV. Conferir que os controles nativos aparecem se o vídeo demora e que a música retoma quando o anúncio termina, mesmo se a duração informada mudar.
- [ ] Simular internet lenta no YouTube. Bloquear só o player sem cookies e conferir o carregamento pelo endereço padrão com controles nativos. Se os dois falharem, conferir que Abrir no YouTube leva ao mesmo vídeo.
- [ ] Playback que falha na tela: o celular mostra o aviso e 🎧 Trocar playback recarrega a música.
- [ ] Recarregar a tela da festa: a mesma sala continua.
- [ ] Desligar a internet da tela: celular mostra “tela não está respondendo”; ao voltar, tudo segue.
- [ ] Fechar sala: o celular avisa que a sala não existe mais.

## Dados

- [ ] Compartilhar com e sem letras; abrir o link em outro navegador cria a playlist.
- [ ] Exportar backup; importar em navegador limpo com Adicionar e com Substituir.
- [ ] Atualização: subir a versão e conferir que o aparelho recebe a nova (aviso “Atualizar”).

- [ ] Salvar um playback sem tocar. Em outra sala, procurar pelo mesmo título e artista, pedir o vídeo salvo e repetir a música.

- [ ] Sem sala aberta, buscar e salvar músicas no controle do celular. Selecionar algumas, entrar numa sala e enviar. Confirmar que entram no fim da fila sem interromper a música atual.
- [ ] Enviar música nova com playback e confirmar que o ID do vídeo é salvo no catálogo compartilhado.

## Sessão opcional e revisão antes de publicar

- [ ] Chrome, sem login: abrir, buscar, montar fila e cantar sem exigência de conta. Preferência de sessão começa desligada.
- [ ] Conta gratuita no mesmo navegador: sessão opcional funciona sem prometer remover anúncios.
- [ ] Conta YouTube Premium real, cookies permitidos: verificar se o player reconhece o benefício. Login no app da TV ou no celular não serve como prova.
- [ ] Cookies bloqueados: nada declara assinatura reconhecida; permanecem trocar playback e abrir no YouTube.
- [ ] Alterar a opção: música atual continua; próxima carga aplica a origem escolhida. Recuperar com a sessão habilitada mantém youtube.com.
- [ ] Anúncio real com mais de 12 segundos: verificar que a tela não cobre o player com erro enquanto ele progride e não avança a fila ao fim do anúncio.
- [ ] Repetir os casos sem conta e com sessão no navegador real da Smart TV e do projetor; anotar modelo, navegador e resultado.

Os testes automatizados usam players simulados. Nenhum item acima está validado apenas por eles. Esta versão não implementa bloqueio universal de publicidade.

## Caminho rápido e controle remoto

- [ ] Celular: digitar música/artista → Preparar música → Enviar playlist à festa, com vídeo já escolhido e sem marcar checkboxes.
- [ ] Colar várias músicas, preparar e enviar de uma vez. Linhas sem vídeo não aparecem como prontas.
- [ ] Música antiga sem playback: preparar automaticamente ao enviar ou começar a playlist. Falha não abre palco sem áudio.
- [ ] Cortar rede durante envio: tentar novamente só as faixas pendentes daquela tentativa; não interrompe quem canta.
- [ ] TV real: setas movem foco, Enter confirma, inclusive em diálogos; não mudam de faixa. Setas de edição em texto/volume/progresso continuam nativas.
- [ ] Mais opções conserva troca manual de vídeo, letra, dueto e modo explícito de áudio externo.

# Checklist manual — Estante

Rode antes de publicar qualquer alteração. Sirva o repositório por HTTP (`python3 -m http.server`) e abra `http://localhost:8000/estante/` — no `file://` o service worker não roda.

## 1. Abertura

- [ ] A página abre sem erro no console.
- [ ] A etiqueta de rede mostra "online".
- [ ] Sem repertório salvo, a aba Repertório mostra o texto de lista vazia.

## 2. Busca

- [ ] Buscar por artista e música no modo **Inteligente** traz resultados e o aviso diz quais fontes responderam (LRCLIB, Vagalume, Deezer e/ou Apple).
- [ ] Abrir um resultado carrega a letra; o rodapé mostra o crédito da fonte.
- [ ] Quando a fonte não devolve letra, aparece a mensagem explicando e os links da faixa.
- [ ] Modo **Trecho** encontra a música por um pedaço da letra (depende só do Vagalume — sem ele disponível, não há como buscar por trecho).
- [ ] Com o Vagalume fora do ar (simule bloqueando `api.vagalume.com.br` nas ferramentas de rede do navegador): os chips **Brasil** e **Trecho** ganham um ponto vermelho; buscar neles mostra a mensagem certa com o botão **Tentar na Inteligente**, e clicar nele repete a busca no modo Inteligente.
- [ ] Ainda com o Vagalume fora do ar, o modo **Inteligente** continua trazendo resultados (via LRCLIB/Deezer/Apple).

## 3. Letra colada e cifras

- [ ] "Colar letra" abre o texto colado; linhas só com acordes viram cifras.
- [ ] Colar um `.lrc` (com marcas `[00:12.30]`) habilita o botão **Sincro**.
- [ ] Os controles **Tom** e **Capo** só aparecem quando a música tem cifras.

## 4. Ajustes por música

- [ ] Mudar o tom transpõe as cifras (C +2 vira D).
- [ ] Mudar o capo desloca as cifras para baixo (tom +2 com capo 1 mostra C#).
- [ ] "Anotações" salva o texto e ele aparece na faixa acima da letra.
- [ ] Trocar de música e voltar traz tom, capo, velocidade e anotação de cada uma.
- [ ] Recarregar a página mantém tudo (só vale para músicas do repertório).
- [ ] A lista do repertório mostra as etiquetas de tom e capo.

## 4b. Velocidade automática

- [ ] Numa música com duração conhecida, **auto** acende e a velocidade muda sozinha.
- [ ] Rolando até o fim, a letra termina por volta do tempo da música.
- [ ] Mudar o tamanho da letra com o **auto** ligado recalcula a velocidade.
- [ ] Tocar em −/+ desliga o **auto** e volta ao manual.
- [ ] Numa letra colada sem duração, **auto** pergunta a duração; digitar `3:45` liga o automático.
- [ ] A etiqueta `auto` aparece na lista do repertório.

## 4c. Editar a letra

- [ ] **Editar letra** abre com o texto atual; salvar redesenha a letra na hora.
- [ ] Tom, capotraste, velocidade e anotações continuam iguais depois de salvar.
- [ ] Trocar o título pela edição não cria uma segunda cópia no repertório.
- [ ] Colar um `.lrc` pela edição reativa o botão **Sincro**.
- [ ] Escrever `[Refrão]` e `[Solo]` faz aparecer a tira de atalhos; tocar num deles rola até a seção.
- [ ] A tira some quando a música tem menos de duas seções.

## 4d. Gravação sem travar

- [ ] Segurar o `+` da velocidade durante a rolagem não engasga a letra.
- [ ] O valor ajustado continua lá depois de recarregar a página.
- [ ] Ajustar a velocidade de uma música do repertório não muda a velocidade das outras.

## 5. Repertórios

- [ ] Criar um segundo repertório: o novo abre vazio e o anterior continua intacto.
- [ ] Renomear e duplicar funcionam; a duplicata vem com as mesmas músicas.
- [ ] Apagar pede confirmação; ao apagar o último, ele é esvaziado em vez de sumir.
- [ ] ↑ ↓ mudam a ordem e × remove; a música em execução continua marcada corretamente.
- [ ] O rodapé mostra o número de músicas e a duração estimada.

## 6. Palco

- [ ] **Rolar** desce a letra; a velocidade responde aos botões e às setas ↑ ↓.
- [ ] Tocar na letra durante a rolagem pausa.
- [ ] **Sincro** acompanha a letra temporizada; tocar numa linha reposiciona.
- [ ] **Modo palco** escurece o papel; a tela não apaga sozinha.
- [ ] ← → trocam de música dentro do repertório.

## 7. Arquivos e compartilhamento

- [ ] **Exportar** baixa um JSON com todos os repertórios.
- [ ] **Importar** mostra o diálogo antes de mexer em qualquer coisa, dizendo o que vem no arquivo e o que seria apagado.
- [ ] **Adicionar** mantém os repertórios do aparelho e acrescenta os do arquivo.
- [ ] **Substituir** troca tudo — e só depois de confirmar.
- [ ] Fechar o diálogo no × não importa nada.
- [ ] Importar um export antigo (lista única) também passa pelo diálogo.
- [ ] **Compartilhar** copia/compartilha o link; abrir o link em outra janela oferece "Adicionar" e "Criar novo".
- [ ] **Imprimir** mostra a ordem do show com tom, capo, duração e anotações; a opção "Com as letras" traz uma música por página.

## 8. Offline e instalação

- [ ] Depois da primeira abertura, recarregar em modo avião (DevTools → Network → Offline) mantém o app e o repertório funcionando.
- [ ] A busca offline avisa que não há internet, sem quebrar a tela.
- [ ] O navegador oferece instalar o app (ícone aparece corretamente).
- [ ] Ao publicar uma versão nova, aparece o aviso "Nova versão disponível" com o botão de atualizar.

## 8b. No celular e no tablet

Teste em 360–390 px de largura e num tablet, ou nas ferramentas de dispositivo do navegador.

- [ ] O nome da música aparece no cabeçalho (não pode ficar espremido a zero).
- [ ] O cabeçalho ocupa uma linha só; os botões que não cabem são alcançados arrastando a fileira de lado.
- [ ] **Rolar**, **‹** e **›** aparecem na pedaleira sem precisar arrastar.
- [ ] Os rótulos Vel., Letra, Tom e Capo estão visíveis, dá para saber qual controle é qual.
- [ ] A página não rola de lado em nenhuma tela.
- [ ] Os diálogos (editar letra, colar letra) cabem na tela e rolam por dentro.

## 9. Migração

- [ ] Com um `estante:v2:setlist` antigo no navegador, abrir o app cria o repertório "Repertório" com as mesmas músicas e mantém a chave antiga como backup.

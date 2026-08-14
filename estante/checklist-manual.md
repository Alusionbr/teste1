# Checklist manual — Estante

Rode antes de publicar qualquer alteração. Sirva o repositório por HTTP (`python3 -m http.server`) e abra `http://localhost:8000/estante/` — no `file://` o service worker não roda.

## 1. Abertura

- [ ] A página abre sem erro no console.
- [ ] A etiqueta de rede mostra "online".
- [ ] Sem repertório salvo, a aba Repertório mostra o texto de lista vazia.

## 2. Busca

- [ ] Buscar por artista e música no modo **Inteligente** traz resultados e o aviso diz quais fontes responderam.
- [ ] Abrir um resultado carrega a letra; o rodapé mostra o crédito da fonte.
- [ ] Quando a fonte não devolve letra, aparece a mensagem explicando e os links da faixa.
- [ ] Modo **Trecho** encontra a música por um pedaço da letra.

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
- [ ] **Importar** aceita esse arquivo e também um export antigo (lista única).
- [ ] **Compartilhar** copia/compartilha o link; abrir o link em outra janela oferece "Adicionar" e "Criar novo".
- [ ] **Imprimir** mostra a ordem do show com tom, capo, duração e anotações; a opção "Com as letras" traz uma música por página.

## 8. Offline e instalação

- [ ] Depois da primeira abertura, recarregar em modo avião (DevTools → Network → Offline) mantém o app e o repertório funcionando.
- [ ] A busca offline avisa que não há internet, sem quebrar a tela.
- [ ] O navegador oferece instalar o app (ícone aparece corretamente).
- [ ] Ao publicar uma versão nova, aparece o aviso "Nova versão disponível" com o botão de atualizar.

## 9. Migração

- [ ] Com um `estante:v2:setlist` antigo no navegador, abrir o app cria o repertório "Repertório" com as mesmas músicas e mantém a chave antiga como backup.

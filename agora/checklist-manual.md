# Checklist manual do Agora

Rode antes de publicar. Servindo por HTTP (`python3 -m http.server`), porque o
service worker não roda em `file://`. Use uma aba anônima para começar do zero.

## Captura

- [ ] Escrever "comprar pão" e apertar Enter guarda a tarefa e limpa o campo, com o cursor pronto para a próxima.
- [ ] "pagar boleto 20m #casa hoje @baixa" vira título "pagar boleto", área casa, 20 min, energia baixa e dia de hoje.
- [ ] "entregar relatório 12/09" grava prazo (e, se a data já passou neste ano, cai no ano que vem).
- [ ] "ligar para o médico sexta" marca a próxima sexta-feira.
- [ ] O aviso mostra o que foi entendido e o "desfazer" apaga a tarefa recém-criada.

## Tela Agora

- [ ] Com a lista vazia, aparece o convite para esvaziar a cabeça.
- [ ] Mudar "Tenho" e "Energia" muda a sugestão; nada que exija mais energia que a declarada aparece na frente.
- [ ] "Trocar sugestão" percorre a fila e o contador (x de y) acompanha.
- [ ] "Quebrar em passos" abre o campo e o passo criado aparece como "Comece por" no cartão.
- [ ] "Hoje não" adia e o aviso confirma; a tarefa some da vez.
- [ ] Tarefa adiada três vezes mostra o bloco de tarefa parada com as três saídas.

## Foco

- [ ] "5 min" liga o timer; o relógio anda e o título da aba mostra o tempo.
- [ ] Pausar congela o relógio; voltar retoma de onde parou (sem pular o tempo pausado).
- [ ] "+5 min" aumenta o planejado sem zerar o que já passou.
- [ ] Ao acabar o tempo toca o som, o cartão muda e o relógio passa a contar o extra.
- [ ] "Terminei a tarefa" conclui, registra os minutos e oferece desfazer.
- [ ] "Pausa de 5 min" entra no modo pausa e mostra o botão de voltar para a tarefa.
- [ ] Escrever em "onde eu parei", sair do app e voltar: o texto continua lá e aparece no cartão da tarefa.
- [ ] Recarregar a página no meio de um foco mantém o timer no tempo certo.
- [ ] Deixar um foco aberto por mais de 4 horas (mexer no relógio do sistema): ao abrir, o app encerra e avisa quantos minutos registrou.

## Hoje

- [ ] "Puxar para hoje" move a tarefa para o bloco das três coisas.
- [ ] Passar do limite mostra o aviso suave (e não impede).
- [ ] Concluir pela caixinha soma nas vitórias e permite reabrir.
- [ ] Rotina do dia marcada aparece nas vitórias.

## Lista

- [ ] A caixa de entrada só mostra o que ainda não tem tempo e energia.
- [ ] Definir tempo e energia tira o item da caixa de entrada; o contador da aba diminui.
- [ ] Busca por palavra filtra sem perder o cursor do campo.
- [ ] Os filtros abertas / de hoje / travadas / concluídas / soltas trazem os grupos certos.
- [ ] Abrir uma tarefa permite editar título, área, tempo, energia, dia, prazo e anotações — e a mudança sobrevive ao recarregar.
- [ ] Editar um campo de texto e clicar direto em um botão: o clique funciona de primeira.
- [ ] "Soltar" tira da lista e o filtro "soltas" mostra; "Trazer de volta" reativa.
- [ ] "Apagar de vez" pede confirmação.

## Rotinas

- [ ] Criar rotina diária e rotina de dias escolhidos.
- [ ] Marcar hoje acende o ponto do dia e soma na sequência.
- [ ] Em dia que não é da rotina, a caixinha fica desabilitada.
- [ ] Faltar um dia não zera a sequência; faltar dois seguidos zera.

## Ajustes

- [ ] Os três temas mudam a cor da barra do navegador junto.
- [ ] Texto grande aumenta tudo proporcionalmente.
- [ ] Desligar animações remove as transições.
- [ ] Ligar avisos pede permissão; recusar volta a chave para desligado com aviso.
- [ ] Depois de três tarefas cronometradas, o bloco "Sua noção de tempo" mostra o fator e as etiquetas ganham a previsão corrigida (→).
- [ ] O gráfico dos sete dias bate com as sessões registradas.
- [ ] Baixar backup gera o .json; restaurar pergunta antes e repõe tudo.
- [ ] Os dois CSVs abrem no Excel/LibreOffice com acento correto.
- [ ] "Apagar tudo" pede duas confirmações.

## Modo calmo, atalhos e offline

- [ ] Tecla `C` (ou o botão) esconde abas, dicas e ações secundárias; `Esc` sai.
- [ ] `N` põe o cursor na captura; `1`–`5` trocam de tela; `espaço` pausa o foco.
- [ ] Nenhum atalho dispara enquanto se digita em um campo.
- [ ] Instalar como app pelo navegador e abrir em modo avião: tudo funciona.
- [ ] Com o app aberto e a rede desligada, recarregar continua funcionando.
- [ ] Console sem erros em todas as telas.

# Agora — organizador de tarefas para mentes que dispersam

Aplicativo de tarefas que roda no navegador, sem servidor e sem login, pensado
desde o começo para quem tem TDAH (e útil para qualquer pessoa em dia ruim).
Os dados ficam só no aparelho; dá para instalar e usar sem internet.

Abra `index.html` por HTTP (o modo offline precisa de `http`/`https`; em
`file://` o app funciona, mas sem service worker).

---

## O problema que ele resolve

Aplicativo de tarefas comum assume que a dificuldade é **lembrar** do que
fazer. Para quem tem TDAH, a dificuldade quase nunca é essa: é **iniciar**,
**escolher** e **estimar tempo**. Lista longa com prazos vencidos em vermelho
piora as três coisas — ela cobra, e cobrança fecha o app.

O Agora vira o jogo em seis decisões:

| Decisão | Por quê |
|---|---|
| **Uma tarefa por vez** na tela principal | A lista inteira à vista paralisa. A tela Agora mostra uma tarefa, o primeiro passo dela e um botão para trocar. |
| **Captura sem formulário** | Se guardar uma ideia custar três cliques, a ideia se perde. O campo fica no topo de todas as telas; escreveu, apertou Enter, acabou. |
| **Energia e tempo antes de prioridade** | Prioridade não ajuda quando o problema é começar. "Tenho 15 minutos e pouca energia" é uma pergunta respondível; "qual é a mais importante?" não é. |
| **Começar com 5 minutos** | O custo de iniciar é a barreira real. Um combinado curto contorna a negociação interna — e o timer deixa esticar. |
| **"Onde parei"** | Retomar é caro. Uma linha escrita na saída devolve o contexto na volta. |
| **Nada de vermelho acumulado** | Nenhum contador de atraso. Tarefa empacada não vira dívida: vira uma oferta de ajuda (quebrar em passo menor, remarcar ou soltar). |

## O que tem dentro

- **Captura rápida com atalhos de escrita**: `#casa` vira área, `20m` / `1h`
  vira estimativa, `@baixa` vira energia, `hoje` / `amanhã` / `sexta` vira dia
  e `12/09` vira prazo. Tudo opcional — frase solta também serve.
- **Tela Agora**: a próxima coisa, o motivo de ela ter sido sugerida, o
  primeiro passo e os botões de foco. Trocar de sugestão não custa nada.
- **Timer de foco** com pausa, `+5 min`, pausa curta de 5 minutos e registro
  do tempo real gasto. O relógio aparece no título da aba.
- **Calibragem da noção de tempo**: depois de três tarefas cronometradas o app
  mostra quanto você costuma levar em relação ao que estima (ex.: 1,8×) e
  passa a exibir a previsão corrigida ao lado da estimativa.
- **Tela Hoje**: no máximo três coisas escolhidas (o limite é ajustável),
  rotinas do dia e o bloco de vitórias.
- **Lista**: caixa de entrada com triagem de dois toques, filtros por área,
  texto e situação, e edição completa de cada tarefa.
- **Rotinas** com histórico de sete dias e sequência tolerante: falhar um dia
  não zera nada; só dois dias seguidos encerram a contagem.
- **Modo calmo** (tecla `C`), tema escuro/claro/baixo estímulo, texto grande e
  chave para desligar animações.
- **Backup** em JSON (restaurável) e exportação CSV de tarefas e sessões.

Atalhos: `N` anota, `1`–`5` troca de tela, `C` modo calmo, `espaço` pausa o
foco, `Esc` fecha o que está aberto.

---

## Arquivos

```txt
agora/
├── index.html            estrutura da tela
├── styles.css            visual, temas e modo calmo
├── src/core.js           APP_VERSION, estado, localStorage e datas
├── src/model.js          o que é uma tarefa: criar, interpretar a frase, mudar de estado
├── src/engine.js         escolha da próxima tarefa, calibragem de tempo e estatísticas
├── src/focus.js          timer de foco, sessões, som e aviso
├── src/routines.js       rotinas, histórico e sequência tolerante
├── src/views.js          peças comuns e as telas Agora e Hoje
├── src/views-gestao.js   telas Lista, Rotinas e Ajustes
├── src/backup.js         exportar/restaurar JSON e CSV
├── src/app.js            navegação, eventos, atalhos e tick do timer
├── sw.js                 cache do casco (offline)
├── manifest.webmanifest  instalação como app
└── icon.svg / icon-192.png / icon-512.png
```

Os scripts são carregados em ordem no `index.html`, sem módulos: cada arquivo
publica o que expõe em `window.Agora`. Ao criar um arquivo novo, inclua-o no
`index.html` **e** na lista `SHELL` de `sw.js`.

Os PNGs saem de `node tools/make-icons-agora.js` (Node puro, sem dependência).

---

## Princípios obrigatórios

### 1. Versão única

`APP_VERSION` em `src/core.js`, `VERSION` em `sw.js` e o `?v=` das tags do
`index.html` andam juntos. **Alterou qualquer arquivo, bumpe os três** — senão
o service worker continua servindo a versão antiga.

### 2. Offline é requisito

Nenhum recurso externo entra na página: sem CDN, sem fonte remota, sem
biblioteca. O app não faz uma única chamada de rede.

### 3. O timer conta por horário, nunca por soma de ticks

`decorridoMs()` é sempre `agora − início − pausado`. Aba escondida, celular
bloqueado ou navegador engasgado não podem roubar minutos. A sessão é gravada
assim que começa: fechar a aba no meio não apaga o que já foi focado, e
`recuperarAoAbrir()` fecha a conta de uma sessão esquecida.

### 4. Gravar é caro

`salvar()` serializa o estado inteiro. Ajuste que se repete (digitar, arrastar)
usa `salvarLogo()`; o que não pode se perder grava na hora. `fecharConta()`
fecha as gravações adiadas em `pagehide` e ao esconder a aba.

### 5. Campo de texto não redesenha a tela ao sair

O `change` de um campo de texto dispara no *blur* — no meio do clique que a
pessoa acabou de dar em um botão. Redesenhar ali troca o botão entre o apertar
e o soltar, e o clique se perde. Por isso texto grava e não redesenha;
`select` e data podem redesenhar.

### 6. Nada é apagado por engano

"Soltar" é um estado próprio (`solta`), não exclusão: sai da frente e volta
quando quiser. Conclusão, soltura e captura oferecem **desfazer** no aviso.
Restaurar backup sempre pergunta antes de substituir.

### 7. A linguagem não cobra

Nada de "atrasado", "pendências" ou contador vermelho. Data virada é "ficou
para trás há 3 dias"; tarefa parada é convite para quebrar, remarcar ou
soltar. Isso é regra de produto, não de estilo: vergonha é o que faz a pessoa
abandonar a ferramenta.

---

## Modelo de dados

Tudo em `localStorage["agora:v1:dados"]`.

```js
{
  versao: 1,
  tarefas: [{
    id, titulo, notas, projeto,
    energia,     // "" | baixa | media | alta
    minutos,     // estimativa
    dia,         // YYYY-MM-DD escolhido para fazer
    prazo,       // YYYY-MM-DD combinado com alguém
    passos: [{ id, texto, feito }],
    status,      // entrada | ativa | feita | solta
    gasto,       // minutos realmente cronometrados
    adiada,      // quantas vezes foi empurrada
    ondeParei,
    criadoEm, atualizadoEm, feitoEm
  }],
  rotinas: [{ id, nome, quando, dias, feitos: ["YYYY-MM-DD"], criadoEm }],
  sessoes: [{ id, tarefaId, titulo, inicio, fim, minutos, planejado }],
  foco: { tarefaId, titulo, tipo, inicio, planejado, pausadoEm, pausadoMs, alarmado } | null,
  prefs: { tema, calmo, texto, animacoes, som, avisos, limiteHoje, tempoDisponivel, energia },
  meta: { criadoEm, versaoApp }
}
```

`status: "entrada"` é a caixa de entrada (falta tempo e/ou energia). Uma
captura que já traz os dois nasce `ativa`.

---

## Regras para próximas alterações

1. Cálculo de sugestão, calibragem e estatística ficam em `engine.js`; o que é
   uma tarefa fica em `model.js`; timer em `focus.js`; rotinas em
   `routines.js`. Não empilhe regra em `app.js` — lá ficam só os eventos.
2. Alterou o formato do dado? Atualize `normalizar*`, o backup e este README.
3. Bumpe a versão nos três lugares e inclua arquivo novo no `SHELL` do `sw.js`.
4. Teste servindo por HTTP; service worker não roda em `file://`.
5. Rode `agora/checklist-manual.md` antes de publicar.

## Não fazer

- Não adicionar biblioteca externa, CDN ou fonte remota.
- Não enviar nada para servidor nenhum: o app não tem rede, e é isso que faz
  ele ser seguro para escrever qualquer coisa da vida pessoal.
- Não introduzir contador de atraso, alerta vermelho ou "score de
  produtividade".
- Não redesenhar a tela dentro do tick do timer.
- Não exigir triagem: tarefa sem estimativa continua aparecendo na tela Agora.

## Ideias para evolução

Prioridade alta:

1. Reordenar as três coisas do dia arrastando.
2. Repetição de tarefa (não só de rotina), com "toda quarta".
3. Modo "quebrar junto": perguntar passo a passo quando a tarefa trava.

Prioridade média:

1. Subtarefa com estimativa própria e soma no pai.
2. Exportar o dia em texto para colar em outro lugar.
3. Notificação agendada para a hora escolhida da tarefa.
4. IndexedDB quando o histórico crescer.

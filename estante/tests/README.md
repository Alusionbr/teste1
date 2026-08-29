# Testes do Estante

Suítes de navegador de verdade: sobem o app num servidor local, abrem no
Chromium e conferem o comportamento. Foram escritas junto com cada versão e
são o que impede uma correção antiga de voltar a quebrar.

## Rodar

```bash
node estante/tests/rodar.js            # todas as suítes
node estante/tests/rodar.js karaoke    # só as que casam com "karaoke"
node estante/tests/rodar.js v315       # uma só
```

O roteiro sobe o servidor sozinho (o service worker não roda em `file://`),
executa cada suíte num processo próprio — uma que trave não leva as outras
junto — e devolve código de saída diferente de zero se qualquer uma falhar.
Leva cerca de dois minutos no conjunto todo.

Para rodar uma suíte à mão, com o servidor já de pé:

```bash
python3 -m http.server 8777       # na raiz do repositório
node estante/tests/v315-test.js
```

## Precisa

- **Node 18+** e **Playwright com Chromium**. `tests/playwright.js` procura o
  Playwright instalado no projeto e depois o global; se não achar, a mensagem
  diz como instalar. Não é dependência do app — o Estante em si não carrega
  biblioteca nenhuma, e nada daqui é servido ao navegador.
- **Nenhuma internet.** As suítes interceptam LRCLIB, Vagalume, Deezer, Apple,
  MusicBrainz e a API do YouTube com respostas fixas. É de propósito: teste que
  depende de serviço de terceiro falha por motivo errado, e o Vagalume cai com
  frequência real.

## O que cada uma cobre

| Suíte | Assunto |
|---|---|
| `smoke.js` | o app abre, os scripts carregam, não há erro de página |
| `final-test.js` | fluxo completo: buscar, abrir, salvar, exportar, imprimir |
| `offline-test.js` | service worker, casco em cache, segunda abertura sem rede |
| `acervo-local-test.js` | busca no repertório salvo e no acervo do site, inclusive dentro da letra |
| `lyrics-fallback-test.js` | a ordem das fontes de reserva quando a letra não vem |
| `search-resilience-test.js` | fonte fora do ar, repetição em erro passageiro, atalho para a Inteligente |
| `musicbrainz-test.js` | identificação de faixa e duração pelo MusicBrainz |
| `setlist-test.js` | vários repertórios: criar, trocar, migrar, importar, imprimir |
| `songprefs-test.js` | tom, capotraste, velocidade e anotações por música |
| `palco-test.js` | rolagem, velocidade automática, wake lock, navegação entre músicas |
| `mobile-test.js` | layout e alvos de toque em telefone e tablet |
| `karaoke-test.js` | relógio do vídeo, protocolo `postMessage`, anúncio, integração |
| `karaoke-mobile-test.js` | os controles do karaokê por toque |
| `share-test.js` | compartilhar sem deixar o toque sem resposta (3.12.1) |
| `v34-test.js` | importação que pergunta, gravação adiada, seções, edição de letra |
| `v39-test.js` | cifra em letra sincronizada, transposição, atalhos de seção |
| `v312-test.js` | busca de vídeo no app, avisos flutuantes, pedaleira opcional |
| `v313-test.js` | ensaio de coral: naipe e repetição de trecho |
| `v314-test.js` | guardar o repertório, exportar no iPhone, campos e toque |
| `v315-test.js` | alvo pelo dedo, paisagem, "juntar ao aberto" |

## Ao mexer no app

Uma suíte que falha é uma de duas coisas, e vale parar para distinguir:

- **regressão** — conserte o app;
- **expectativa desatualizada** — a mudança era intencional e o teste é que
  precisa mudar. Nesse caso, ajuste a asserção **e escreva no comentário por
  que**, como está feito em `v34-test.js` (a pedaleira virou opcional na
  3.12.0) e em `v39-test.js` (a tira de seções ganhou o ⟳ na 3.13.0).

Nunca apague uma asserção para "passar".

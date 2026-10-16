# Mapa do Parque — Beto Carrero World

Mapa interativo do parque com **GPS em tempo real**, **rota a pé**, **fila anotada**, **roteiro do dia** e **grupo sincronizado** (ver onde cada pessoa está). Roda no navegador do celular, instala como app e funciona **sem internet** depois de aberto uma vez (só o grupo precisa de conexão).

Endereço publicado: `https://alusionbr.github.io/teste1/parque/`

## Como usar no parque

1. Abra o link no celular e toque em **Ligar GPS e bússola**. O ponto azul é você; o leque azul mostra para onde o celular aponta.
2. **Buscar**: digite o nome (ex.: "tigor", "banheiro", "sorvete") ou toque num atalho de categoria.
3. **Ir até lá**: toque num lugar → *Ir até lá*. A faixa de baixo mostra distância, tempo a pé e uma seta. Quando o mapa conhece o caminho, a rota segue por ele; quando não conhece, é linha reta e a seta funciona como bússola. O celular vibra ao chegar.
4. **◎** centraliza em você. Tocar de novo faz o mapa **girar junto com você**. O botão **▲ N** volta o norte para cima.
5. **Segure o dedo no mapa** para: marcar o carro, criar ponto de encontro, marcar um lugar, pedir rota até ali ou **corrigir sua posição** quando o GPS falhar dentro de prédio.
6. Em cada lugar: ☆ favoritar, ✓ já fui (guarda o horário), ⏱ informar fila, 📝 nota.
7. **➕ Marcar para todo mundo**: o botão verde ＋ (ou segurar o dedo no mapa → *Bebedouro, lixeira, banheiro…*) marca bebedouro, lixeira, banheiro, lanchonete, loja, primeiros socorros, fraldário, guarda-volumes, tomada, sombra, informações, entrada/saída ou ponto de foto. Aparece no mapa de todos. O OpenStreetMap não tem nada disso dentro do parque: o mapa fica completo conforme vocês andam.
8. **Atrações sem posição** (Rebuliço, Spin Blast, Super Soaker, Turbo Drive, Hot Wheels Epic Show…): estão na lista com área, altura e horário. Na frente delas, toque no nome → **Estou aqui agora**.
9. **⏰ Hora do Show** (atalho no topo ou aba *Shows*): horários oficiais do dia e, quando um show grande vai começar (Hot Wheels Epic Show, Excalibur, Madagascar Circus), aviso com vibração e o **plano dos brinquedos disputados** em ordem de caminhada. *Seguir o plano* traça a rota de um por um.
10. **Altura**: em Ajustes, coloque a altura da pessoa mais baixa; o app marca ⛔ o que ela não pode ir (altura mínima oficial) e tira do plano.
11. **Caminhos aprendidos**: enquanto vocês andam, o trajeto (sem nome, só com GPS bom) ensina o mapa por onde dá para passar. As rotas deixam de ser linha reta e passam a seguir os caminhos reais, e ficam melhores ao longo do dia. Dá para desligar em Ajustes.
12. **Fila ao vivo**: quando alguém informa a fila de uma atração, todo mundo que usa o app vê "~X min" no mapa e no detalhe (mediana da última hora; só vai o número, sem posição nem nome). Quanto mais gente informar, melhor fica.
13. **Roteiro** (☰ → Roteiro): progresso do dia, próximo favorito mais perto e linha do tempo do que você já foi.
14. Para instalar: no iPhone, Compartilhar → *Adicionar à Tela de Início*; no Android, menu → *Instalar app*.

## Grupo (até umas 3–10 pessoas)

1. Uma pessoa: 👥 → digita o nome → **Criar grupo novo** → manda o convite pelo WhatsApp.
2. As outras abrem o link do convite, digitam o nome e tocam **Entrar**.
3. Todo mundo aparece no mapa com as iniciais e a cor escolhida, atualizando a cada 4 segundos. Toque numa pessoa para ver a distância e pedir rota até ela.
4. **Status** (Na fila, Comendo, Me espera…) aparece embaixo do nome de cada um.
5. **Ponto de encontro**: segure o dedo no mapa → *Ponto de encontro aqui*. Todo o grupo recebe aviso e vibração.

Privacidade: a posição só é enviada com o app aberto e só quem tem o código do grupo vê. Quem fica 3 h sem abrir o app some do grupo. *Sair do grupo* tira você na hora.

## Limitações conhecidas

- O desenho vem do **OpenStreetMap** (outubro de 2026). Atrações e horários vêm da **lista oficial do parque** (conferida em 16/10/2026, em `oficial.js`). Atração sem posição no OSM depende de alguém marcar "Estou aqui agora".
- Enquanto ninguém andou por um trecho, a rota ali é linha reta com seta. Cada pessoa com o app aberto ensina os caminhos.
- Lugares do OSM que saíram da lista oficial (Star Mountain, cinemas, zoológico…) aparecem apagados com aviso de "pode estar fechado".
- O GPS do celular tem erro de 5 a 30 m, maior perto de prédios altos e embaixo de árvores. O número ao lado de "GPS ±" mostra o erro atual.
- A duração dos shows é estimada em 40 min (o parque não publica). Confira sempre a placa de altura na entrada do brinquedo.

## Arquivos

```txt
parque/
├── index.html           estrutura da tela
├── styles.css           visual (tema escuro)
├── park-data.js         GERADO: desenho e lugares do parque (não editar à mão)
├── geo.js               GPS ↔ plano do mapa, distância, direção
├── store.js             dados salvos no aparelho, categorias, APP_VERSION
├── route.js             grafo de caminhos e cálculo de rota
├── map.js               desenho SVG, zoom, giro, gestos, rótulos
├── gps.js               posição em tempo real e bússola
├── group.js             grupo no Supabase (RPC por fetch, sem biblioteca)
├── filas.js             fila ao vivo compartilhada
├── oficial.js           lista oficial: altura, horários, área, disputados (editar à mão)
├── lugares.js           junta oficial + OSM + marcações da comunidade
├── show.js              Hora do Show: sessões e plano dos disputados
├── trilhas.js           caminhos aprendidos (trajeto anônimo → rotas reais)
├── ui.js                telas e eventos
├── sw.js                cache offline
├── manifest.webmanifest / icon.svg
└── supabase/            001, 002 e 003 (aplicar em ordem)
```

## Para continuar o desenvolvimento (com outra pessoa ou outra IA)

Leia este README e a seção **Mapa do Parque** do `CLAUDE.md` na raiz. Pontos que não podem ser esquecidos:

- **Versão única**: `APP_VERSION` em `store.js`, `VERSION` em `sw.js` e o `?v=` das tags em `index.html` andam juntos. Sem isso o celular continua com a versão antiga do cache.
- **Atualizar o mapa**: baixe o recorte do OSM e rode o gerador:
  ```bash
  curl -o /tmp/parque.osm "https://api.openstreetmap.org/api/0.6/map?bbox=-48.6275,-26.8125,-48.6075,-26.7960"
  node tools/make-park-data.js /tmp/parque.osm
  ```
  Categorias escolhidas pelo nome ficam em `NAME_CATEGORY` dentro de `tools/make-park-data.js`.
- **Outro parque**: troque `PARK_WAY_ID` (id do contorno do parque no OSM) e o recorte `bbox`. O resto do app não tem nada preso ao Beto Carrero além do texto.
- **Servidor**: projeto Supabase `iowuejrpzoibyidiuvpt` (dividido com outros apps). Tudo do parque fica no schema separado `parque` (tabelas `membros`, `pinos`, `filas`, `lugares`, `trilhas`), que a API não expõe. O navegador só chama as funções `public.parque_*` (`parque_sync`, `parque_pin_set`, `parque_pin_del`, `parque_sair`, `parque_fila_set`, `parque_filas`, `parque_lugar_add`, `parque_lugar_del`, `parque_lugares`, `parque_trilha_add`, `parque_trilhas`). Nada é apagado: sair marca `active=false` e remover pino marca `removed=true`.
- Teste servindo por HTTP (`python3 -m http.server` na raiz e abra `/parque/`); o service worker não roda em `file://`. Use as DevTools → *Sensors* para simular posição.

Ideias para a próxima etapa:

1. Atualizar `oficial.js` quando o parque mudar atrações ou horários (lista em www.interno.betocarrero.com.br/atracoes).
2. Horários de shows do dia com lembrete 15 min antes.
3. Rastro do dia (por onde andou) e passos/quilômetros.

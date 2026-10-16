# Mapa do Parque — Beto Carrero World

Mapa interativo do parque com **GPS em tempo real**, **rota a pé**, **fila anotada**, **roteiro do dia** e **grupo sincronizado** (ver onde cada pessoa está). Roda no navegador do celular, instala como app e funciona **sem internet** depois de aberto uma vez (só o grupo precisa de conexão).

Endereço publicado: `https://alusionbr.github.io/teste1/parque/`

## Como usar no parque

1. Abra o link no celular e toque em **Ligar GPS e bússola**. O ponto azul é você; o leque azul mostra para onde o celular aponta.
2. **Buscar**: digite o nome (ex.: "tigor", "banheiro", "sorvete") ou toque num atalho de categoria.
3. **Ir até lá**: toque num lugar → *Ir até lá*. A faixa de baixo mostra distância, tempo a pé e uma seta. Quando o mapa conhece o caminho, a rota segue por ele; quando não conhece, é linha reta e a seta funciona como bússola. O celular vibra ao chegar.
4. **◎** centraliza em você. Tocar de novo faz o mapa **girar junto com você**. O botão **▲ N** volta o norte para cima.
5. **Segure o dedo no mapa** para: marcar o carro, criar ponto de encontro, marcar um lugar, pedir rota até ali ou **corrigir sua posição** quando o GPS falhar dentro de prédio.
6. Em cada lugar: ☆ favoritar, ✓ já fui (guarda o horário), ⏱ fila em minutos, 📝 nota.
7. **Roteiro** (☰ → Roteiro): progresso do dia, próximo favorito mais perto e linha do tempo do que você já foi.
8. Para instalar: no iPhone, Compartilhar → *Adicionar à Tela de Início*; no Android, menu → *Instalar app*.

## Grupo (até umas 3–10 pessoas)

1. Uma pessoa: 👥 → digita o nome → **Criar grupo novo** → manda o convite pelo WhatsApp.
2. As outras abrem o link do convite, digitam o nome e tocam **Entrar**.
3. Todo mundo aparece no mapa com as iniciais e a cor escolhida, atualizando a cada 4 segundos. Toque numa pessoa para ver a distância e pedir rota até ela.
4. **Status** (Na fila, Comendo, Me espera…) aparece embaixo do nome de cada um.
5. **Ponto de encontro**: segure o dedo no mapa → *Ponto de encontro aqui*. Todo o grupo recebe aviso e vibração.

Privacidade: a posição só é enviada com o app aberto e só quem tem o código do grupo vê. Quem fica 3 h sem abrir o app some do grupo. *Sair do grupo* tira você na hora.

## Limitações conhecidas

- O desenho vem do **OpenStreetMap** (dados de outubro de 2026). Atrações novas que ainda não estão no OSM não aparecem: marque com o toque longo.
- O OSM tem poucos caminhos desenhados dentro do parque, então muitas rotas são em linha reta com seta (não atravessam paredes por mágica: use a seta como direção).
- O GPS do celular tem erro de 5 a 30 m, maior perto de prédios altos e embaixo de árvores. O número ao lado de "GPS ±" mostra o erro atual.
- Horários e alturas mínimas não estão no app: o OSM só traz alguns horários, e inventar dado de segurança seria pior que não ter.

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
├── ui.js                telas e eventos
├── sw.js                cache offline
├── manifest.webmanifest / icon.svg
└── supabase/001_grupo.sql   tabelas e funções do grupo
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
- **Servidor do grupo**: projeto Supabase `iowuejrpzoibyidiuvpt`, tabelas `parque_membros` e `parque_pinos`. As tabelas ficam trancadas (RLS sem política); o navegador só chama as funções `parque_sync`, `parque_pin_set`, `parque_pin_del` e `parque_sair`, que exigem o código do grupo. Nada é apagado: sair marca `active=false` e remover pino marca `removed=true`.
- Teste servindo por HTTP (`python3 -m http.server` na raiz e abra `/parque/`); o service worker não roda em `file://`. Use as DevTools → *Sensors* para simular posição.

Ideias para a próxima etapa:

1. Desenhar à mão os caminhos internos que faltam no OSM (ou mandar para o próprio OSM) para a rota seguir as ruas do parque.
2. Fila compartilhada no grupo (cada um anota, todos veem a média recente).
3. Horários de shows do dia com lembrete 15 min antes.
4. Rastro do dia (por onde andou) e passos/quilômetros.
5. Altura mínima por brinquedo, conferida no site oficial do parque.

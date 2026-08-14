"use strict";
/*
 * Lista das ferramentas do laboratório.
 * Para publicar uma ferramenta nova, acrescente um objeto aqui.
 *   name    nome curto que aparece no card
 *   tagline uma linha dizendo para que serve
 *   href    caminho relativo da pasta da ferramenta
 *   tags    palavras-chave exibidas como etiquetas
 *   status  "ativo" | "rascunho"
 */
const HUB_TOOLS = [
  {
    name: "Estante",
    tagline: "Letras e cifras no palco: busca em várias fontes, repertório offline, rolagem automática, sincronia e transposição.",
    href: "./estante/",
    tags: ["música", "palco", "offline", "instalável"],
    status: "ativo"
  },
  {
    name: "Controle360 Multi",
    tagline: "Estoque, ficha técnica, custo médio, produção, vendas com CMV, pedidos, tarefas e consignado para vários negócios.",
    href: "./controle360/",
    tags: ["gestão", "estoque", "CMV", "offline"],
    status: "ativo"
  }
];

function toolCard(tool) {
  const card = document.createElement("a");
  card.className = "card" + (tool.status === "rascunho" ? " draft" : "");
  card.href = tool.href;

  const title = document.createElement("h2");
  title.textContent = tool.name;
  card.appendChild(title);

  const tagline = document.createElement("p");
  tagline.textContent = tool.tagline;
  card.appendChild(tagline);

  if (tool.tags && tool.tags.length) {
    const tags = document.createElement("div");
    tags.className = "tags";
    tool.tags.forEach(t => {
      const tag = document.createElement("span");
      tag.textContent = t;
      tags.appendChild(tag);
    });
    card.appendChild(tags);
  }

  const open = document.createElement("span");
  open.className = "open";
  open.textContent = tool.status === "rascunho" ? "Em construção" : "Abrir";
  card.appendChild(open);

  return card;
}

function renderTools() {
  const grid = document.getElementById("tools");
  if (!grid) return;
  grid.textContent = "";
  HUB_TOOLS.forEach(tool => grid.appendChild(toolCard(tool)));
  const slot = document.createElement("div");
  slot.className = "card placeholder";
  slot.innerHTML = "<h2>Próxima ferramenta</h2><p>Crie uma pasta na raiz do repositório e acrescente uma linha em <code>hub/tools.js</code>.</p>";
  grid.appendChild(slot);
}

renderTools();

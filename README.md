# Ferramentas

Repositório de ferramentas que rodam direto no navegador: sem servidor, sem login e sem banco de dados externo. Cada pasta é um aplicativo independente e a primeira página (`index.html`) é o índice que leva a todos.

Publicado pelo GitHub Pages a partir da raiz: <https://alusionbr.github.io/teste1/>

## Ferramentas

| Ferramenta | Pasta | Para que serve |
|---|---|---|
| **Estante** | [`estante/`](estante/) | Letras e cifras no palco: busca em várias fontes, repertórios offline, rolagem automática, sincronia, transposição e impressão da ordem do show. Instalável no celular. |
| **Controle360 Multi** | [`controle360/`](controle360/) | Estoque, ficha técnica, custo médio, produção, vendas com CMV, pedidos, tarefas e consignado para vários negócios. |

Cada ferramenta tem o seu próprio README com detalhes de uso.

## Como abrir

- **Publicado:** abra o endereço acima e escolha a ferramenta.
- **Local:** clone o repositório e sirva a pasta por HTTP, por exemplo `python3 -m http.server`, depois abra `http://localhost:8000`.

Abrir os arquivos direto pelo `file://` funciona para o Controle360, mas o Estante perde o modo offline: o navegador só aceita service worker em `http`/`https`.

## Estrutura

```txt
index.html          página de ferramentas (a primeira página)
hub/styles.css      visual da página de ferramentas
hub/tools.js        lista das ferramentas (HUB_TOOLS)
estante/            aplicativo de letras e cifras
controle360/        aplicativo de estoque e custos
tools/make-icons.js gerador dos ícones PNG do Estante (Node puro)
```

## Publicar uma ferramenta nova

1. Crie uma pasta na raiz com o `index.html` da ferramenta.
2. Acrescente um objeto em `HUB_TOOLS`, dentro de `hub/tools.js`.
3. Faça commit na branch `main`: o GitHub Actions publica a raiz automaticamente.

## Dados e backup

Cada ferramenta guarda os dados no armazenamento local do próprio navegador. Limpar os dados do navegador apaga tudo — use as opções de exportação de cada uma para manter backup.

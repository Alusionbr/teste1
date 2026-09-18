# File360

Ferramenta local para converter imagens e mídia, organizar PDFs e compactar arquivos. Não usa login, banco de dados, Supabase ou upload. As bibliotecas pesadas são carregadas apenas quando uma operação precisa delas.

A tela inicial oferece objetivos rápidos compatíveis com o arquivo escolhido. Depois do processamento, é possível editar o nome do resultado, baixar, compartilhar quando o navegador aceita arquivos e ajustar as opções novamente sem selecionar o original outra vez.

## Recursos atuais

- Objetivos rápidos compatíveis com o arquivo selecionado: reduzir imagem, juntar imagens em PDF, remover o áudio e criar GIF.
- Imagens em lote com conversão, redimensionamento, qualidade, recorte central, rotação e espelhamento.
- PDF com união, divisão, extração, rotação, PDF para imagens e imagens para PDF.
- Vídeo e áudio com conversão, corte, redução de resolução, remoção/extração de áudio e vídeo para GIF.
- ZIP e GZIP com criação e extração protegidas por limites locais.
- Resultado com nome editável, download individual ou ZIP, compartilhamento quando o aparelho oferece suporte e retorno aos ajustes sem reenviar o original.

## Executar

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:3000`. Para validar a entrega:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## Limites desta versão

- Imagens: até 25 MB e 24 MP; lote de até 100 arquivos e 250 MB de entrada.
- HEIC: até 20 MB, com decoder carregado sob demanda.
- PDF: até 25 MB e 100 páginas; PDF para imagem limitado a 30 páginas por execução.
- Vídeo/áudio: até 500 MB e 20 minutos quando o navegador oferece OPFS e ao menos 500 MB livres; fallback de 100 MB e 5 minutos nos demais casos. A saída ampliada é gravada temporariamente e removida após o uso.
- Vídeo para GIF: entrada de até 250 MB com armazenamento ampliado ou 100 MB no fallback, trecho de até 12 segundos, maior lado de até 720 px, 5–12 FPS e saída de até 50 MB.
- ZIP/GZIP: até 500 itens; extração total limitada a 250 MB.

Os limites protegem principalmente celulares contra falta de memória. A cobertura de codecs de mídia varia entre navegador e sistema operacional; a interface mostra o perfil realmente disponível no aparelho.

## Validação

Os 32 testes automatizados cobrem catálogo/compatibilidade de ações, nomes, assinaturas, dimensões, limites de mídia, GIF, OPFS, compartilhamento, intervalos e streams. O build estático valida as rotas SEO e o `basePath`. A homologação em Chromium desktop cobriu imagem para WebP, remoção de áudio de MP4, vídeo para GIF e retorno aos ajustes. Compartilhamento nativo, memória e codecs ainda devem ser homologados em iPhone/Safari e Android/Chrome reais; viewport emulado não comprova esses limites.

## Publicação

O `next.config.ts` usa exportação estática. O workflow da raiz define `NEXT_PUBLIC_BASE_PATH=/teste1/file360`, gera `file360/out` e copia o resultado para `/file360/` no artefato do GitHub Pages, preservando as outras ferramentas.

As decisões e a evolução planejada ficam em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) e [`docs/EXPANSAO-MOBILE-SOL.md`](docs/EXPANSAO-MOBILE-SOL.md).

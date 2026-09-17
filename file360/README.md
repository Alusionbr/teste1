# File360

Ferramenta local para converter imagens e mídia, organizar PDFs e compactar arquivos. Não usa login, banco de dados, Supabase ou upload. As bibliotecas pesadas são carregadas apenas quando uma operação precisa delas.

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
- Vídeo para GIF: entrada de até 250 MB, trecho de até 12 segundos, maior lado de até 720 px, 5–12 FPS e saída de até 50 MB.
- ZIP/GZIP: até 500 itens; extração total limitada a 250 MB.

Os limites protegem principalmente celulares contra falta de memória. A cobertura de codecs de mídia varia entre navegador e sistema operacional; a interface mostra o perfil realmente disponível no aparelho.

## Publicação

O `next.config.ts` usa exportação estática. O workflow da raiz define `NEXT_PUBLIC_BASE_PATH=/teste1/file360`, gera `file360/out` e copia o resultado para `/file360/` no artefato do GitHub Pages, preservando as outras ferramentas.

As decisões e a evolução planejada ficam em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

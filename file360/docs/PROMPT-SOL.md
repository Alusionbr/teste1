# PROMPT DE IMPLEMENTAÇÃO — GPT-5.6 SOL

Você é o GPT-5.6 Sol, responsável por implementar o MVP do File360. Este prompt é autocontido e define o produto, decisões técnicas, escopo e critérios de conclusão. Implemente software funcional; não entregue somente plano ou mockup. A arquitetura foi definida em 15/09/2026; confira as APIs e versões efetivamente instaladas em documentação oficial, fixe lockfile e não invente suporte de biblioteca.

## 1. Repositório e preservação

Use exclusivamente https://github.com/Alusionbr/teste1 para este trabalho. É um monorepositório com `estante/`, `controle360/`, `xadrez3d/`, `hub/`, `index.html`, `AGENTS.md` e `.github/workflows/pages.yml`. Cada aplicação existente é independente. O Pages publica a raiz em https://alusionbr.github.io/teste1/.

Leia o `AGENTS.md` aplicável, confira branch/remoto/status e preserve alterações existentes. Trabalhe em branch de feature e dentro de `file360/`. Não apagar/recriar repositório, dar force push, substituir index da raiz, transformar o monorepo inteiro em Next ou migrar projetos irmãos. Não alterar outros repositórios. Reutilize uma pasta File360 existente sem sobrescrever trabalho do usuário.

Mudanças fora de `file360/` são limitadas à futura entrada File360 no `hub/tools.js` e ao staging aditivo do workflow Pages. Faça-as somente depois de o build funcionar, preservando todas as rotas e arquivos publicados anteriormente. A arquitetura/documentação existente deve permanecer. Não fazer deploy comercial nem contratar infraestrutura sem autorização; entregue configuração executável e relate provisionamento pendente com precisão.

## 2. Produto e objetivo

“Selecione o arquivo. Escolha o que fazer. Baixe o resultado.” Público: criadores, estudantes, pequenos empreendedores e pessoas sem conhecimentos de codecs.

Sem login, cadastro, banco, histórico, projetos salvos, assinatura, billing, colaboração, API pública, IA generativa, app nativo ou armazenamento permanente. O estado dura uma sessão. Nunca enviar um arquivo automaticamente ao selecionar, inspecionar ou gerar preview. Local-first significa que a rota local não transmite bytes, nome, hash ou thumbnail do arquivo.

Padrão de UI em pt-BR. Interface de ferramenta refinada, compacta e acessível. Não usar template SaaS, hero gigante, gradiente roxo/azul, glassmorphism, cards repetitivos ou fluxo de 20 telas.

## 3. Escopo obrigatório do MVP

### Imagens locais

- Entrada JPG/JPEG, PNG, WebP; AVIF apenas se decoder nativo passar probe; GIF estático apenas (detectar e recusar animado); HEIC/HEIF por decoder nativo ou libheif WASM em worker sob demanda.
- Saídas JPG, PNG e WebP verificadas por MIME e assinatura. Não renomear extensão para simular conversão.
- Resize proporcional por lado maior, sem upscale por padrão; qualidade apenas JPEG/WebP; transparência→JPEG sobre fundo branco editável.
- Aplicar orientação uma vez, normalizar saída sRGB SDR quando suportado e remover EXIF/GPS/XMP no reencode. Verificar metadata em fixtures; não prometer eliminar toda informação esteganográfica.
- Batch até 100 arquivos, receita comum, progresso/item, continuar após erro individual e baixar ZIP dos sucessos. Relatório local de falhas separado.
- Limites: 25 MiB/arquivo, 24 MP, lado ≤12.000 px; HEIC fallback até 20 MiB/12 MP; soma de inputs até 250 MiB; outputs cumulativos até 100 MiB. Processar um decode por vez e encerrar/liberar cada imagem.
- Sem AVIF encode, GIF animado, SVG, TIFF, BMP, ICO, crop, espelhar ou encoder PNG com quantização neste MVP. PNG não tem slider falso de compressão com perdas.

### PDF local

- Unir documentos; extrair seleção/dividir em páginas; imagens→PDF; PDF→JPG/PNG. Preview de páginas, ranges e ZIP quando várias saídas.
- PDF.js para render; pdf-lib para estruturar/copiar/incorporar imagens, em workers separados conforme exigência das APIs.
- Apenas PDF estático não criptografado. Detectar e recusar senha, assinaturas, portfolios e formulários complexos que a edição não preservaria. Nunca usar `ignoreEncryption` como decrypt. Informar limitações se não for possível garantir preservação.
- Até 25 MiB somados/100 páginas; export PDF→imagem até 30 páginas, 144 DPI default e no máximo 8 MP por página. Renderizar páginas visíveis; exportar uma por vez; cancelar render tasks e liberar canvases.
- Não implementar OCR, senha, compressão, PDF→Office, edição de texto ou fidelidade PDF/A/tagging/formulários.

### Vídeo e áudio híbridos

- Um arquivo por job. Vídeo: converter MP4 H.264/AAC ou WebM VP9/Opus; cortar um intervalo com reencode preciso; compressão alta qualidade/equilibrado/menor arquivo; tamanho final desejado via servidor; remover áudio; reduzir resolução até 1080p; extrair áudio MP3/WAV/M4A.
- Áudio: converter MP3/WAV/M4A e manter um intervalo. Preview com waveform verdadeira e campos numéricos.
- Pipeline obrigatório combinável: trim → mute opcional → resize → compress/target → encode. Extração de áudio é alternativa de saída, incompatível com mute. Não realizar encode intermediário em cada etapa.
- Local: Mediabunny + WebCodecs em Dedicated Worker. MP3 export usa extensão de encoder MP3 do Mediabunny sob demanda, não supor encoder MP3 nativo. Use BlobSource/leitura incremental e output limitado; não carregar arquivos inteiros em PCM para waveform. Gere peaks incrementalmente ou use servidor com consentimento.
- Local de vídeo habilitado somente para MP4/MOV H.264/AAC SDR e WebM VP8/VP9+Opus homologados; no máximo 100 MiB, 5 minutos, fonte/saída até 1080p30 SDR e output 100 MiB. Áudio local decodificável até 5 minutos e mesmos limites em bytes. Verifique APIs, decoder, encoder, mux e configurações reais; `canPlayType` é só preview. Examine tracks descartadas pela biblioteca; não descartar áudio silenciosamente.
- Onde `deviceMemory` indicar ≤4 GiB, reduzir mídia local a 50 MiB/720p e imagem a 12 MP. Ausência dessa API não significa RAM livre; mantenha defaults conservadores. RAM máxima real de Safari não é conhecida; o usuário pode sofrer encerramento da aba sem exception.
- Servidor: FFmpeg/ffprobe nativo para entradas homologadas MP4/MOV/M4V, MKV, AVI, WebM, MPEG/MPG e 3GP; codecs inicialmente H.264, HEVC SDR, VP8/VP9, MPEG-1/2/4 Part 2, MJPEG, H.263 e AAC/MP3/PCM/FLAC/Vorbis/Opus/WMA/AMR conforme build. Cada perfil habilitado precisa de fixture; perfil sem decoder ou sem teste fica explicitamente indisponível. ProRes, AV1 e fontes adicionais não obrigatórios.
- Áudio servidor: MP3/WAV/AAC/M4A/FLAC/OGG/Opus/WMA/AIFF conforme codec homologado; saídas MP3/WAV PCM16/M4A AAC-LC.
- Limite servidor: 250 MiB/job, vídeo até 10 min, fonte até 4K60, saída até 1080p30; áudio até 30 min; output até 300 MiB. Prever tamanho PCM antes de WAV. Recusar arquivos de 1,4 GB/7,8 GB antes de ler tudo; não oferecer um backend ilimitado inexistente.
- HDR/Dolby Vision/10-bit ficam fora do transcode local. Implemente tone-map SDR BT.709 no FFmpeg somente se fixture validar cor; caso contrário, recuse esse perfil claramente em vez de gerar cores erradas. Não é permitido marcar HDR suportado sem prova.
- Sem merge de mídia, batch de mídia, edição por frame, corte rápido, speed, fades, crop/proporção, codec livre, GIF de vídeo ou presets sociais na primeira versão.

### Corte

Representar tempos como inteiros em microssegundos e intervalo `[inUs,outUs)`. Usar PTS/timescales reais na exportação. Timeline tem preview, thumbs limitados, in/out, duração, zoom e botão de ouvir/ver trecho. Campos mostram HH:MM:SS.mmm; alças não são a única interação.

Modo P0 é corte preciso com reencode, não `-c copy`. Não prometer frame-perfect no player. `video.currentTime` e miniaturas não comprovam exatidão do export. VFR não usa FPS médio para identificar frames. Validar B-frames e timestamps não zero. Áudio MP3/AAC possui padding/delay; verificar duração decodificada e A/V sync.

### Smart Compression

Três perfis locais e remotos com parâmetros por engine. Tamanho desejado roda remoto com H.264/MP4 2-pass e arquivo intermediário/passlogs apenas no diretório do job.

MB do alvo é decimal. `S=MB*1_000_000`; `D=duração após trim`; `totalBps=8*S*0.96/D`; `videoBps=totalBps-audioBps`. AAC 128k default, 96k no perfil pequeno; zero se mute. Nunca reduzir para mono sem escolha do usuário.

Escolher resolução sem upscale, proporção preservada/dimensões pares, até 1080p, em sequência 1080/720/480. Heurística inicial `bppf=videoBps/(width*height*fps)`: abaixo de 0,06 recomendar reduzir; abaixo de 0,035 em 480p pedir alvo maior. São heurísticas, não score de qualidade. Mostrar proposta e alteração de FPS antes de processar.

Verificar bytes após saída. Se exceder alvo, uma correção de bitrate e no máximo uma nova tentativa, dentro do timeout total. Nunca usar `-fs` para truncar. Só declarar alvo cumprido quando output íntegro ≤S. Se falhar, explicar e oferecer arquivo real com tamanho real ou novo alvo. Pode ficar menor que alvo em cenas simples. Texto “Até 50 MB, buscando preservar a qualidade”, sem garantia de exatamente 50 MB.

## 4. Stack e estrutura

Next.js App Router + React + TypeScript strict, export estático, CSS Modules + tokens globais, reducer/context por sessão, Zod para contratos. Node LTS compatível e Fastify no backend. pnpm workspace limitado a `file360/`; versões exatas no lockfile. Sem Redux, ORM, Redis, Kubernetes, framework de editor, FFmpeg WASM ou Service Worker.

Estrutura-alvo, criando arquivos só quando usados:

```text
file360/
  package.json, pnpm-workspace.yaml, pnpm-lock.yaml
  docs/{ARQUITETURA.md,PROMPT-SOL.md,VALIDACAO.md,OPERACAO.md}
  apps/web/
    next.config.ts
    src/app/{layout.tsx,page.tsx,converter/[slug]/page.tsx,
             comprimir/[kind]/page.tsx,cortar/[kind]/page.tsx}
    src/components/ui/
    src/features/{workspace,media,images,pdf,batch,download}/
    src/runtime/{planner,capabilities,job-reducer,asset-store,artifact-store}
    src/engines/{local-media,local-image,local-pdf,server}
    src/workers/{media.worker,image.worker,pdf.worker,protocol}
    src/config/{tools,presets,limits,deployment}
    src/styles/{tokens.css,globals.css}
    public/engines/
  apps/processor/src/{server.ts,routes/,jobs/,security/,runner/,cleanup/}
  packages/contracts/src/
  tests/{unit,integration,e2e,fixtures}/
  scripts/{stage-pages,generate-fixtures,verify-artifacts}/
  infra/{Containerfile.media,processor.service,janitor.service,
         janitor.timer,Caddyfile.example,env.example}
```

Implemente contratos tipados, não herança com dezenas de métodos vazios:

- `Asset`: id, File/Blob no store local, tamanho, MIME detectado, container/tracks/duration/dimensions após probe. Não guardar bytes em reducer/JSON.
- `Operation`: união discriminada para trim, mute, resize, encode/profile, targetSize, extractAudio, imageRecipe, pdfMerge, pdfExtract, pdfRender, imagesToPdf.
- `ExecutionPlan`: schemaVersion=1, engineId, location local/temporary-server, inputIds, operations normalizadas, policyVersion, saída esperada/limite e warnings.
- `EngineAdapter`: `assess(request,caps)`, `run(plan,io,AbortSignal,onEvent) → Artifact[]`, `dispose()`. EngineIO contém leitura/sink; UI nunca conhece comandos FFmpeg.
- `Artifact`: id, nome seguro, MIME/assinatura verificados, bytes, metadata real e handle local ou referência remota de download.
- `Job`: id, revision/generation, plan congelado, engine, timestamps, status, phase/progress opcional, outputIds e erro tipado.

Estados: idle→inspecting→ready→awaitingConsent quando remoto→preparing→uploading quando remoto→queued→processing→finalizing→done; failed/cancelling/cancelled/expired nos caminhos apropriados. Eventos antigos não ressuscitam job cancelado. `done` somente depois de fechar e validar artefato. Etapas sem porcentagem usam progresso indeterminado; nunca progresso falso baseado em timer.

Planner normaliza e valida pipeline, funde encode e escolhe motor pelo plano inteiro. Se um passo obrigatório exigir servidor, execute todo o plano remoto após autorização. Não subir/descer arquivos entre etapas. Operações conflitantes geram erro útil. Alterar receita cria novo plano; preservar original para retry.

## 5. Backend efêmero real

Uma VM Linux, API Fastify única, fila Map em memória e manifests JSON atômicos. Uma execução ativa global, fila máxima 3 e espera máxima 2 min. Sem banco, sessão de usuário ou histórico. Sugestão de máquina para validar: 4 vCPU/8 GiB, sem promessa de throughput.

`JOB_ROOT/<uuid>/{manifest.json,input/0.bin,work/,output/}` fora do webroot. Arquivo original nunca compõe path. Token 256 bits por job entregue uma vez; só hash no manifest. Schemas/versionamento iguais frontend/backend, mas o servidor revalida tudo independentemente do cliente. Operações idempotentes e updates serializados por job.

Endpoints:

1. `GET /v1/capabilities`: perfis disponíveis, limites, busy/availability.
2. `POST /v1/jobs`: declara entrada/plano, reserva quota, devolve id/token/expiresAt; não aceita comando.
3. `PUT /v1/jobs/:id/input`: bearer, body binário streaming, contador de bytes reais e timeout; não JSON/base64. Um input por job remoto.
4. `POST /v1/jobs/:id/inspect`: probe+preview/peaks limitados no sandbox, após upload informado.
5. `POST /v1/jobs/:id/run`: bearer, revalidar plano vs probe e enfileirar uma vez.
6. `GET /v1/jobs/:id`: bearer, revision/status/phase/progress/artifacts; polling 1 s ativo/5 s oculto, backoff em falhas.
7. `POST /v1/jobs/:id/download-ticket`: bearer, ticket por output válido 60 s para iniciar.
8. `GET /v1/download/:ticket`: download streaming, attachment, nosniff, no-store e Range. Ticket suporta requests Range/retry na janela, não é single-use. Renovar mediante bearer enquanto job válido.
9. `DELETE /v1/jobs/:id`: idempotente, cancelar worker/container e apagar após término.

Preview remoto: usar original após consentimento, gerar proxy leve e até 24 thumbnails/peaks limitados. Exportar a partir do original; mapeamento proxy→source por tempo explícito. Sem preview, conversão e ranges numéricos continuam possíveis com duração do probe. Previews também exigem bearer/ticket e expiram com job.

Container por job lançado pelo controlador usando Podman rootless, imagem fixa por digest previamente instalada e sem pull durante job. Sem socket Docker privilegiado. FFprobe e FFmpeg no sandbox; rootfs read-only, non-root, network none, cap-drop ALL, no-new-privileges, seccomp, mount somente daquele job, sem secrets. 2 CPUs, 2 GiB memória sem swap adicional, 64 PIDs, timeout total 15 min. Exigir cgroups v2 e verificar os limites no host; se enforcement não funcionar, backend falha fechado. Código não pode recuar para processamento desprotegido de uploads públicos.

Use `spawn(bin,args,{shell:false})`, allowlists e números limitados. Sem URL import, playlists, argumentos/filtergraph livres, acesso a protocolos remotos ou caminhos fornecidos pelo usuário. Mapear só tracks selecionadas e descartar anexos não necessários explicitamente. Compile args exclusivamente no adapter servidor. Limite stdout/stderr e não registrar conteúdo/nome/token/senha.

Disco temporário dedicado 10 GiB; reservar orçamento até 2 GiB/job; limitar saída 300 MiB e arquivos temporários por quota/rlimit/watchdog. Verificar free space antes de admissão e durante execução. Não confiar só em Content-Length. Pré-checar dimensão/páginas/duração via parser com timeout e memória.

TTL absoluto 60 min desde criação; upload sem progresso 2 min/total 10 min; fila 2 min; processing incluindo retry 15 min; resultado 20 min desde conclusão limitado ao TTL absoluto. Download tem lease no máximo 10 min, sempre capado pelo hard expiry; nunca deletar ao primeiro GET ou ao emitir ticket.

Janitor independente via systemd timer a cada 60 s e startup sweep. Não depender de setInterval na API, unload, sendBeacon ou aba aberta. Remover upload parcial, input, output, preview, passlogs e containers órfãos. Restart cancela jobs incompletos e remove parciais, não retoma encode; validar manifest/output antes de reexpor concluído não expirado. Host indisponível pode atrasar exclusão: limpar antes de reabrir API e alertar.

Escrever output `.part`, verificar integridade, então rename atômico. DELETE/cancel/finalize/expiry usam lock por job; não servir parcial; evento tardio não marca done. SIGTERM seguido de kill em até 5 s; aguardar processo parar antes de apagar. Janitor confirma caminhos sob JOB_ROOT e não segue symlinks. Volume criptografado sem backup/snapshot de arquivos do usuário; não prometer apagamento forense instantâneo.

TLS, CORS origens exatas, Origin nos writes de browser, autorização por job, quota global e rate limit por IP. CORS não substitui autorização. Nomes de saída tratados como texto e attachment seguro, normalizados, sem separadores/controles/bidi enganoso/nome reservado e com desambiguação. MIME declarado/extensão não são suficientes; sniff + probe real. Arquivo grande/corrompido/unsupported dá código e ação clara. Evitar logs de tickets e `Referrer-Policy: no-referrer`.

## 6. Privacidade e cancelamento

Badge sempre correto: `Processamento local` ou `Processamento temporário`. Antes de qualquer upload, modal informa arquivo, operação e prazo real, CTA “Enviar e processar temporariamente”. Confirmar uma vez para aquele arquivo/plano não autoriza arquivos futuros. Falha local não envia automaticamente. Para operação local, “Seu arquivo não sai do seu dispositivo” se refere aos bytes; download de código da engine continua normal.

Sem analytics que capture nomes/hashes/thumbnails/tokens/conteúdo, sem session replay, sem SDK publicitário P0. Não mostrar botão remoto se backend não configurado ou indisponível; mensagem útil e manter configuração.

Cancelamento local usa cancel/AbortSignal da engine; em 2 s sem resposta terminar worker exclusivo e limpar outputs. Liberar frames, AudioData, ImageBitmap, object URLs e canvas; reabrir worker na próxima tarefa. Eventos transferidos por ArrayBuffer devem respeitar ownership; não destacar buffer usado pelo preview. Remoto exige DELETE, não só interromper polling.

## 7. UX e design exatos

Tokens: fundo #F5F5F2; superfície #FFFFFF; preview #ECEEEB; texto #202723; secundário #59645D; ação #176343 com branco/hover #124D34; bordas #D9DED8; erro #A32C2C; aviso #855000. Verificar contraste WCAG AA. system-ui/-apple-system/Segoe UI, sem download de fonte. Corpo/input 16 px, auxiliar 14, legenda 12, painel 20, título 28, home 40 desktop/30 mobile; tempos tabular-nums.

Spacing 4/8/12/16/24/32/48. Layout max1280, 12 colunas, gutter24 desktop/16 mobile, margens32/16. ≥1100 px preview flexível + painel320; 768–1099 adaptar painel; <768 coluna com ferramenta/ajustes em sheet acessível. Raios6 controles/10 painéis; sem sombra base, dropdown/dialog sombra leve. Primário40 desktop/44 toque; targets ≥44; foco2px+offset2. Motion120–180ms, respeitar reduced-motion.

Home: FILE360 discreto; “Resolva seu arquivo.”; frase curta; dropzone240 desktop/180 mobile com botão e teclado. Seleção é local; não chamar de upload quando nada foi enviado. Depois mostrar arquivo/tamanho/metadata e barra de ações compatíveis, sem outra página obrigatória.

Editor: preview, painel de saída, resumo da receita e CTA; avançados recolhidos. Timeline88–120 px, thumbnails48–64, ruler24, alças com targets44; waveform96 desktop/72 mobile. Campos numéricos substituem drag; teclado e leitor de tela. Progresso6px+fase real e cancelamento. Erros preservam configuração; texto específico e recovery apenas disponível. Não atribuir falha desconhecida a RAM com certeza.

Mobile: inputs16px, sem overflow em360px, safe-area e CTA fixa sem encobrir inputs/teclado. Pan horizontal da timeline não bloqueia scroll vertical. Preview proporcional com playsInline e sem autoplay com som. Informar que trocar de aplicativo pode suspender jobs locais; não prometer background no iPhone.

Resultado: nome real, bytes reais, formato/duração/dimensões e Baixar; Processar outro. Batch lista sucessos/falhas e ZIP. Não declarar arquivo salvo só porque houve clique. Não revogar URL prematuramente; permitir novo download e limpar recursos File360 no reset, jamais storage/cache de apps irmãos.

Componentes: AppShell, ToolPage, FileDropzone/FilePicker, AssetList/FileSummary, Workspace, OperationBar, VideoEditor, AudioEditor, TrimTimeline, Waveform, TimeRangeFields, ImageRecipePanel, PdfPageGrid/PageRangeField, OutputSettings, PipelineSummary, ProcessingModeBadge, ServerConsentDialog, JobProgress, BatchResults, ResultPanel, DownloadButton, ErrorNotice e AdSlot. Criar composição simples, sem abstrações que só renomeiam HTML.

## 8. SEO, deploy, performance e extensibilidade

Catálogo central `ToolDefinition`: slug, família, entrada/saída, operações iniciais, texto próprio/FAQ, capability e habilitação. Gerar mesmo Workspace e mesmos engines nas 9 rotas:

- /converter/mp4-para-mp3
- /converter/mov-para-mp4
- /converter/png-para-jpg
- /converter/jpg-para-webp
- /converter/heic-para-jpg
- /converter/pdf-para-jpg
- /comprimir/video
- /cortar/video
- /cortar/audio

HTML/metadata/sitemap/canonical gerados estaticamente; slugs inválidos404. Nada de dados de arquivo/job na URL. Não criar centenas de páginas vazias. Demonstração Pages noindex; produção canonical próprio.

Next `output:'export'`, `trailingSlash:true`, basePath configurável `/teste1/file360` no Pages e vazio no domínio próprio. URLs de WASM/workers/assets respeitam basePath. Não usar SSR/Server Actions/API routes do Next para jobs. Home pode renderizar HTML sem JS; ferramenta depende de JS com aviso acessível.

Staging Pages: criar diretório de publicação, copiar os aplicativos estáticos existentes preservando estrutura e sobrepor export File360 em `file360/`; não publicar server/env/secrets/node_modules/test fixtures. Não limpar ou editar fonte irmã. Workflow atual publica raiz; a mudança deve conservar seus conteúdos públicos e adicionar build, não trocá-los por `out` do File360. Testar links de todas as aplicações. GitHub Pages é demonstração: não usar como destino comercial permanente. Produção usa static hosting/domínio que aceite o negócio, headers e API separada configurável.

Meta home ≤200 KiB gzip JS inicial, ≤500 KiB total transferido sem engine. Engines só carregam após ferramenta/arquivo exigir; Mediabunny, PDF.js, libheif e MP3 extension fora do shell. Dynamic imports reais dentro de workers; auditoria de network/build. Asset hashes, versões fixas, cache HTTP; sem Service Worker e sem OPFS no MVP. Sink limitado em Blob é aceitável dentro dos budgets; não chamar de streaming ilimitado. Não criar ZIP de centenas de MB fora do limite. Lib zip.js dinâmica e saída incremental quando a API permitir, com limite cumulativo sempre.

Não instalar ffmpeg.wasm no MVP. Não configurar COOP/COEP globalmente. Evolução futura poderá ter WASM multithread em origem dedicada isolada; WebCodecs não requer SharedArrayBuffer. Nunca carregar todos os codecs na home.

AdSlot vazio, sem SDK, só abaixo do conteúdo ou fora da área de edição. Se habilitado no futuro, espaço reservado antes do paint; nunca perto de download, sobre timeline ou como popup. Antes de scripts de ads, editor deve ter origem independente sem terceiros; separar só rotas não protege o arquivo.

Registro de presets versionado, preparado para TikTok, Reels/Feed/Stories, YouTube/Shorts, WhatsApp, Facebook, X, Discord, Telegram; não implementar presets dessas marcas ainda. P0 só perfis genéricos. Não espalhar dimensões/bitrates nos componentes; futuros presets terão sources/reviewedAt e limites oficiais verificados na data, pois variam por produto/plano.

## 9. Segurança de dependências e testes

Verificar licenças do binário, não só wrapper: FFmpeg/x264 podem implicar GPL, libheif/codecs LGPL e outros termos. Gerar notices/SBOM/build flags e documentação de source/relink conforme necessário. Não incluir Ghostscript, LibreOffice, ImageMagick, Pandoc, RAR/7Z ou outros parsers fora do escopo. Atualizar vulnerabilidades relevantes e não desativar limites de bibliotecas para aceitar arquivos maliciosos.

Vitest unit/integration, Playwright Chromium/Firefox/WebKit e axe; engines/processador reais nos testes de integração, mocks apenas para falhas determinísticas de UI. Fixtures pequenas sintéticas/licenciadas com SHA256 e expected metadata; gerar grandes arquivos/bombs controladas em isolamento durante teste, não versionar gigabytes.

Unit: schemas, nome seguro, ranges/PTS, planner/conflitos, políticas de tamanho, máquina de estados/cancelamento e catálogo. Integração: conversão real, ffprobe, decode de saída, imagem assinatura/dimensão/metadata, contagem/aparência de PDF, ZIP integrity. Testar arquivo corrompido e MIME falso.

Gates verificáveis:

1. `lint`, typecheck, unit, integration, build estático e E2E verdes; não alterar testes para esconder bugs. Documentar testes impossíveis de executar no ambiente.
2. 100 imagens fixture1–2MP → WebP max1200 q82 dentro dos limites, nomes únicos/100 saídas válidas; 1 falha preserva demais; não reter100 RGBA buffers.
3. HEIC orientado e JPEG com EXIF/GPS passam; encoder fallback que retorna PNG não vira arquivo WebP falso.
4. PDF merge/seleção/imagens corretos; senha/assinatura/casos não suportados tratados; render incremental e cancelamento.
5. Vídeo CFR com contador de frames, VFR, B-frames, rotação, sem áudio, HEVC SDR e corrupção. Corte exportado contém limites segundo PTS com tolerância de até1 intervalo de frame da fonte. Não usar seek do player como prova.
6. WAV mesma taxa: trim≤1 sample; MP3/M4A duração decodificada e A/V sync≤50ms nas fixtures. Saída íntegra com tracks corretas.
7. Alvo50MB: bytes≤50.000.000 ou erro explícito de alvo não atingido; nunca arquivo truncado ou progresso falso.
8. Interceptar requests e provar zero arquivo/nome/hash/thumbnail antes de consentimento; local permanece sem upload. Um token não lê/cancela outro job.
9. Streaming oversized sem Content-Length, path traversal, comando, SSRF/playlist, rate limit, fila/disco cheio, timeout, output excessivo, cancel/run/DELETE em corrida.
10. Cancel local≤2s; servidor para container≤5s; sem finalização tardia. Crash da API não impede janitor. TTL remove/inacessibiliza em prazo documentado com host operacional; boot sweep antes de servir.
11. Download repetido/Range/ticket renovado e expirado; nunca apagar no primeiro GET. Nomes acentuados/emoji/duplicados seguros.
12. Responsivo360/390/768/1280, teclado, zoom200%, leitor de tela no fluxo principal e sem violações críticas axe. Testar progress aria-live sem ruído excessivo.
13. Home dentro do orçamento, sem requests de engine precoces; alvo produção p75 LCP≤2,5s/INP≤200ms/CLS≤0,1; Lighthouse mobile≥90 é smoke, não prova de INP real.
14. Playwright WebKit não substitui iPhone: registrar teste Safari macOS, iPhone físico e Android físico com versões/modelos reais. Base mínima produto Safari/iOS17.4, mas suporte depende de capability. Caso sem dispositivos, registrar pendência obrigatória de homologação; não afirmar execução.
15. Apps irmãos e rotas do Pages preservados; diff fora do escopo inexistente exceto integração descrita.

## 10. Ordem de execução

1. Reconhecer somente escopo File360 e regras do repo; verificar estado, criar branch e registrar plano curto. Não gastar tempo reconstruindo arquitetura nem varrer arquivos irmãos sem necessidade.
2. Montar workspace/config/contratos e shell estático mínimo. Validar export/basePath/worker real em subpasta. Não criar dezenas de módulos futuros vazios.
3. Fazer provas pequenas: imagem real+HEIC; PDF real; MP4→MP4 com áudio/corte/cancelamento em worker; um job nativo isolado com timeout/cleanup independente. Documentar limitações encontradas antes de ampliar UI.
4. Completar imagens+batch+ZIP e resultado/download, com testes. Esta é a primeira fatia utilizável.
5. Completar PDF, virtualização/ranges/exports e testes.
6. Completar planner, editores de mídia locais, timeline/waveform, modos de qualidade e pipeline. Não oferecer motores/perfis que não passaram prova.
7. Completar backend, consentimento, proxy de preview, fallback real, target-size2pass, status/tickets/cancelamento/TTL/isolation tests.
8. Completar SEO, catálogo, mobile, acessibilidade, perf budget e docs operacionais/notices.
9. Integrar Pages aditivamente se autorizado pelo contexto do trabalho; verificar apps existentes. Não publicar backend/segredos no Pages.
10. Revisar diff final e entregar commits claros, comandos de execução e relatório de teste com evidências e pendências reais.

## 11. Critério de conclusão

O usuário consegue selecionar, configurar, processar e baixar arquivo realmente transformado em todas as famílias P0 suportadas; falhas são recuperáveis; privacidade e limites são verdadeiros. Frontend roda sem backend configurado oferecendo somente caminhos locais disponíveis. Backend deve ser código executável e testado, não stub ou conversão fake.

O MVP híbrido completo requer integração real do processador; build estático ou mocks não bastam. Se o ambiente impedir provisão/homologação física, complete o que for executável e declare explicitamente a pendência, sem afirmar lançamento ou teste que não ocorreu. Não descartar escopo silenciosamente, não implementar futuros P1–P3 e não criar conta/banco como atalho.

Entregue README com setup frontend/processador, `.env.example` sem secrets, limites/matriz real por build, procedimento de atualização de engines, limpeza/restart, testes e status de homologação, mais resumo final do que funciona, como rodar e o que ainda depende de infraestrutura/dispositivos.


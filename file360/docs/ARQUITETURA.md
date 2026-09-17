# File360 — arquitetura executável

Data da investigação: 15/09/2026. Estado: arquitetura-base e primeira versão local implementada em `feat/file360-local-mvp`.
Repositório: https://github.com/Alusionbr/teste1. Base inspecionada: ee2efad13a39eadee70fd1c9a9b18e5636e3efc5.

> Atualização da primeira rodada: a implementação entregue não depende de Supabase nem de outro servidor. Imagens, HEIC, PDF, mídia e ZIP/GZIP rodam no navegador com limites conservadores. Todo backend descrito abaixo permanece como evolução opcional para codecs incompatíveis, documentos Office e arquivos acima dos limites locais; ele não faz parte desta versão.

## A. Resumo executivo

File360 é uma ferramenta: selecionar arquivo → escolher transformação → processar → baixar. Sem conta, banco de dados, histórico, billing ou armazenamento permanente. O arquivo permanece no dispositivo sempre que o motor local suporta o plano inteiro com limites conservadores. Qualquer upload exige uma ação explícita informada, inclusive para inspecionar ou gerar preview.

Escolha: Next.js + React + TypeScript com exportação estática; motores locais sob demanda em workers; backend independente Node/Fastify com FFmpeg nativo em containers efêmeros. Uma VM Linux, uma fila em memória, manifests JSON temporários e limpeza independente. Sem Redis, Kubernetes ou funções serverless para processamento de mídia.

O repositório já contém aplicações independentes e GitHub Pages. Acrescentar File360 em `file360/`. Preservar `estante/`, `controle360/`, `xadrez3d/`, raiz e hub. Só a futura integração de publicação poderá acrescentar uma entrada ao hub e adaptar o workflow preservando os demais aplicativos. Não substituir a raiz por um app Next.

O MVP entrega imagens/batch, quatro ferramentas PDF, conversão/corte de áudio e conversão/corte/compressão/extração de áudio de vídeo. WebCodecs cobre um subconjunto explícito; FFmpeg nativo cobre incompatibilidades dentro dos limites. ffmpeg.wasm é uma extensão posterior, não uma dependência do MVP.

## B. Decisões

| Decisão | Escolha | Motivo | Alternativa rejeitada/adiada |
|---|---|---|---|
| Frontend | Next App Router, static export | HTML indexável e páginas derivadas de catálogo; preferência da equipe | Next SSR permanente: não há dados pessoais ou conteúdo dinâmico que o exijam |
| Vite/React Router | Alternativa válida, não escolhida | Vite facilita workers; React Router suporta prerender | SPA Vite pura exigiria completar SEO; não manter dois routers |
| Estado | reducer + context por sessão | Jobs transitórios e máquina de estados pequena | Redux, backend de sessões e persistência de projetos |
| Mídia local | Mediabunny + WebCodecs em worker | Demux/mux e conversão sem criar esses componentes do zero | WebCodecs isolado não lê/escreve containers |
| MP3 local | Extensão MP3 do Mediabunny, lazy | Evita carregar FFmpeg inteiro para MP3 | Supor encoder MP3 nativo no WebCodecs |
| Mídia incompatível | FFmpeg/ffprobe nativos | Cobertura e controle de recursos | ffmpeg.wasm como motor universal |
| Imagem | Canvas/OffscreenCanvas; libheif WASM só para HEIC sem decode nativo | Menor carga para JPG/PNG/WebP | Sharp no navegador; pacote de todos os codecs na home |
| PDF | pdf-lib manipula; PDF.js renderiza | Responsabilidades separadas | Supor que PDF.js edita ou pdf-lib descriptografa |
| ZIP de resultados | zip.js, escrita incremental quando possível | Não reter todas as imagens decodificadas | Zipar tudo síncrono na thread principal |
| Backend | Fastify, uma instância, Podman rootless por job | Isolamento por arquivo e implantação pequena | FFmpeg dentro de request Next; Docker socket privilegiado no app |
| Jobs | Map em memória + manifest efêmero atômico | Status/expiração sem banco; coleta após restart | Apenas Map sem recuperação de cleanup |
| Progresso remoto | polling de 1 s ativo / 5 s oculto | Simples, bearer headers e reconexão | WebSocket, infraestrutura de eventos |
| Upload | PUT binário com limite durante streaming | Sem base64 e sem buffering integral na API | Corpo JSON com arquivo; upload via função serverless |
| Pipelines | lista tipada normalizada, compilada em um plano | Funde transforms; evita encode intermediário | Comandos FFmpeg vindos da UI ou passos com download/reupload |
| Hospedagem | Pages só demonstração; domínio próprio para lançamento | Headers, isolamento de origem e termos de uso | Usar Pages como infraestrutura comercial definitiva |
| Publicidade | AdSlot reservado, SDK desligado | Layout estável; processamento sem terceiro observando arquivo | Script publicitário com acesso ao mesmo contexto do editor |

Next export exige gerar as rotas conhecidas no build, `trailingSlash: true`, base path configurável e assets/worker URLs compatíveis com subpasta. Não usar Route Handlers dinâmicos, Server Actions ou otimização de imagem que dependa de servidor. [Documentação Next](https://nextjs.org/docs/app/guides/static-exports). Vite e React Router são tecnicamente viáveis, não inferiores por definição: [Vite](https://vite.dev/guide/features.html), [React Router](https://reactrouter.com/start/framework/rendering).

## Investigação e limites reais

### Mídia: três motores, três contratos

| Motor | Força | Limitação | Regra de seleção |
|---|---|---|---|
| WebCodecs + Mediabunny | Frames/pacotes incrementais, possível aceleração de hardware | Codec/encoder/container/dispositivo variam; não é FFmpeg completo | Primeiro para MP4/MOV/WebM SDR homologados, com decode e encode verificados |
| FFmpeg WASM | Ferramentas FFmpeg sem upload | Download pesado, cópias, RAM, CPU, aquecimento, encerramento de aba | P2 opt-in para arquivos pequenos após benchmark; single-thread primeiro |
| FFmpeg nativo | Codecs variados, 2-pass, preview de incompatíveis, limites de SO | Upload, fila, custo, privacidade temporária | MVP para incompatibilidade, alvo de tamanho, HDR tratado e codecs legados |

A documentação do ffmpeg.wasm informa limite de entrada de 2 GB no projeto e mostra desempenho muito inferior ao nativo no seu benchmark. Isso NÃO é uma garantia prática de 2 GB no iPhone, nem um limite universal de toda implementação WASM. WASM com endereçamento de 32 bits possui espaço endereçável de 4 GiB; cópias e buffers do programa reduzem muito o espaço útil. O benchmark publicado usa hardware/versões específicos; não extrapolar seus tempos ao usuário. [FAQ](https://ffmpegwasm.netlify.app/docs/faq/), [benchmark](https://ffmpegwasm.netlify.app/docs/performance/), [memória WASM](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/Memory).

Não existe um teto portátil e confiável de RAM disponível à aba. `deviceMemory` é ausente em vários navegadores e não mede RAM livre. A página pode morrer sem lançar erro capturável. Limites abaixo são políticas iniciais do produto, sujeitas a homologação; não são medições realizadas nesta investigação.

- Frame RGBA 3840×2160: aproximadamente 31,6 MiB. Oito frames: cerca de 253 MiB antes de decoder, encoder e UI.
- Foto de 48 MP: aproximadamente 183 MiB por buffer RGBA; resize pode manter vários buffers.
- Áudio PCM float32 estéreo 48 kHz por hora: aproximadamente 1,38 GB decimais. Não executar `decodeAudioData` no arquivo inteiro para gerar waveform longa.
- Browser worker evita bloquear React, mas compartilha os recursos do dispositivo. Não é proteção contra encerramento por falta de memória.
- Liberar `VideoFrame`, `AudioData`, ImageBitmap, canvases e object URLs. Limitar filas de decode/encode a poucos frames e backpressure.
- OPFS permite usar disco da origem; não transforma memória linear do ffmpeg.wasm em disco automaticamente. Implementar sink compatível ou não prometer streaming.
- `navigator.storage.estimate()` é estimativa, com quotas e descarte variáveis. Nenhuma retomada de projeto; temporários OPFS são limpos ao concluir, cancelar e no próximo início após abandono. Fechar a aba não garante apagar OPFS imediatamente. MVP não usa OPFS, apenas sinks limitados em memória. [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), [quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

WebCodecs precisa de demux/mux; checar existência das APIs, `isConfigSupported`, configuração completa e pequena execução de validação. H.264 decode não implica H.264 encode, nem áudio AAC encode. `canPlayType()` só auxilia preview. Não enviar vídeo sem áudio porque a biblioteca descartou uma faixa automaticamente: inspeção de `discardedTracks` é obrigatória. [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API), [seleção de codecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection), [Mediabunny](https://mediabunny.dev/guide/converting-media-files).

Safari tem suporte a partes do WebCodecs e HEIC, mas os formatos, perfis, APIs de áudio e hardware continuam exigindo detecção. Homologar Safari/iPhone real; Playwright WebKit não substitui isso. O seletor de Fotos pode entregar uma representação convertida: informar sobre o arquivo efetivamente recebido, sem prometer bytes do original da fototeca. [Safari 17](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/), [Safari 17.4](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/).

### Corte e precisão

- Modelo temporal: inteiros em microssegundos, intervalo `[inUs, outUs)`; não usar decimal em segundos como fonte de verdade. Converter somente na fronteira do motor. Preservar timescale/racionais para cálculo dos PTS.
- Corte rápido sem reencode: depende de keyframes, GOPs e pacotes. Exibir limites efetivamente escolhidos. Nunca chamar de frame-perfect.
- Corte preciso: decodificar desde ponto anterior necessário, descartar até o início, reencodar frames selecionados e reconstruir timestamps/áudio. MVP usa modo preciso; rápido é P1.
- VFR não permite calcular frame por `tempo × FPS médio`. Usar PTS/indexação real, incluindo ordem de apresentação e B-frames. Frame stepping exato é P1, somente para fonte indexada/homologada.
- Timeline MVP seleciona tempo com zoom e campos numéricos; miniaturas e `video.currentTime` são previews aproximados. Precisão da exportação é testada independentemente.
- Áudio PCM pode ser recortado por amostra; MP3/AAC têm quadros, padding e atraso do encoder. Definir tolerância de duração e sincronismo; não prometer precisão de amostra em todos os players.
- HDR/Dolby Vision/10-bit: MVP não faz transcode local. Backend admite HEVC SDR; HDR só entra se tone mapping SDR BT.709 passar fixtures. Se não passar, recusar explicitamente esse perfil, sem cores lavadas silenciosas.

FFmpeg diferencia busca com descarte na transcodificação de cópia de streams, na qual o trecho anterior pode permanecer. Progresso nativo usa `-progress pipe:1`. [Manual FFmpeg](https://ffmpeg.org/ffmpeg.html). No WASM, callbacks de progresso têm ressalvas quando durações diferem; não usá-los cegamente para trim/speed. [API ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/api/ffmpeg/classes/ffmpeg/).

### Imagens, PDF e documentos

- Canvas garante PNG, não todos os MIME pedidos. Verificar `Blob.type` e assinatura; se o navegador retornou PNG, não salvar como `.webp` ou `.avif`. Qualidade Canvas depende do encoder e só se aplica aos formatos com perdas. Slider PNG é substituído por resize/conversão; otimização PNG sem perdas é P1. [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).
- AVIF: decode via capability; encode nativo não presumido. Encoder WASM específico ou Sharp nativo em P1. WebP/JPEG são saídas MVP; não adicionar 20 MB de codecs para uma opção secundária.
- HEIC: decode nativo com fixture, fallback `libheif-js` WASM mantido/atualizado; worker exclusivo e uma imagem por vez. Orientação aplicada exatamente uma vez, saída sRGB SDR; primary image apenas com aviso sobre sequência/Live Photo e dados auxiliares. Sem export HEIC no MVP. [libheif](https://github.com/strukturag/libheif), [wrapper](https://github.com/catdad-experiments/libheif-js).
- Sharp suporta muitas operações mas HEIC não é garantido pelo binário padrão; requer build libvips/libheif apropriado. Preferir Sharp a ImageMagick no futuro; instalar ImageMagick só para lacuna específica, com policy de delegates e coders fechada. [Sharp output](https://sharp.pixelplumbing.com/api-output/).
- SVG não será aceito no MVP. P1: sanitização estrita, sem scripts/event handlers/foreignObject/URLs externas/data recursivo; rasterizar como imagem em contexto isolado ou resvg. Nunca inserir SVG/HTML do usuário no DOM. Rasterizar não equivale a vetorizar. [SVG como imagem](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image).
- PDF.js renderiza; pdf-lib une/copia páginas/incorpora imagens. Renderizar apenas páginas visíveis e exportar uma página por vez, limitando pixels, DPI e memória. [PDF.js FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions).
- pdf-lib não suporta criptografia e `ignoreEncryption` não remove senha. Senhas serão qpdf no backend em P1; jamais brute force. PDFs assinados, formulários complexos e portfolios ficam fora da edição MVP; detectar e avisar/rejeitar, pois alterações invalidam assinaturas e podem perder comportamento. PDF gerado preserva aparência de páginas estáticas, não promete PDF/A, tags de acessibilidade ou formulários perfeitos. [pdf-lib](https://github.com/Hopding/pdf-lib#encryption-handling), [qpdf](https://qpdf.readthedocs.io/en/stable/cli.html).
- Compressão PDF: regravar estrutura nem sempre reduz tamanho. qpdf para otimização estrutural, sem promessa; rasterização/downsample com perda e Ghostscript são P2, com preview e licença revisada. Ghostscript é AGPL/comercial, não assumir que é biblioteca permissiva. [Ghostscript](https://www.ghostscript.com/releases/gpcldnld.html).
- LibreOffice headless é servidor temporário em P2, processo/perfil isolado por job, macros e rede bloqueadas, fontes instaladas explícitas. DOCX/PPTX/XLSX → PDF é best effort. Paginação, fontes, SmartArt, fórmulas, links e animações podem mudar. [LibreOffice](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html).
- Pandoc é para conteúdo estruturado, não fidelidade visual Office. Markdown/TXT/HTML simples podem ser locais, sem renderizar HTML ativo. Planilhas não devem ser convertidas passando por um AST de texto. [Pandoc](https://pandoc.org/MANUAL.html).
- ZIP local com zip.js. TAR/GZIP simples locais em P1; 7Z/RAR via 7-Zip nativo em P2; RAR apenas leitura/extração, sem criação. Suporte a formato não dispensa verificar licenças exatas de distribuição. [zip.js](https://gildas-lormeau.github.io/zip.js/), [7-Zip](https://www.7-zip.org/).

## C. Arquitetura

```text
Página HTML estática / página SEO (ToolDefinition)
  └─ Workspace React (estado transitório, sem bytes no reducer)
      ├─ FilePicker → AssetStore de File/Blob → Inspector limitado
      ├─ CapabilityRegistry + PolicyLimits + Intent/Operations
      └─ Planner → ExecutionPlan imutável e versionado
           ├─ local: lazy import → Worker → EngineAdapter
           │     ├─ Canvas/HEIC
           │     ├─ PDF.js/pdf-lib
           │     └─ Mediabunny/WebCodecs/MP3 extension
           │                ↓
           │            ArtifactStore → Download / zip.js
           └─ remoto: ConsentGate → API client
                    ↓ HTTPS upload streaming, bearer efêmero
              Fastify (uma instância) + fila limitada em memória
                    ├─ manifests JSON atômicos fora do webroot
                    └─ Podman rootless: sandbox por job, sem rede
                          ├─ inspeção/preview/FFmpeg
                          └─ output.part → validação → output final
                    ↓ polling status + ticket curto para download
               Download → expiração/DELETE

Janitor independente + startup sweep → jobs, parciais, previews,
passlogs e containers órfãos; nada depende de a aba permanecer aberta.
```

Um pipeline fica inteiro em um motor sempre que possível. Se qualquer passo obrigatório exigir servidor, calcular a versão completa no servidor após consentimento; não alternar entre upload/download por etapa. Extração, redução e encode são fundidos. V1 pode suportar DAG para merge e múltiplas saídas; MVP é lista normalizada com uma saída, exceto PDF split e batch.

### Política inicial de recursos (valores configuráveis, ainda não homologados)

| Tipo | Limite inicial | Observações |
|---|---|---|
| Imagem local | 25 MiB; 24 MP; lado ≤ 12.000 px | Pré-inspeção de dimensões; rejeitar 48 MP antes de alocar quando possível |
| HEIC fallback WASM | 20 MiB; 12 MP | Conservador em qualquer dispositivo, uma imagem por vez |
| Batch de imagem | 100 arquivos; soma ≤ 250 MiB | Decodificar um por vez; saídas cumulativas ≤ 100 MiB |
| PDF local | soma ≤ 25 MiB; ≤ 100 páginas | PDF→imagem no máximo 30 páginas/export; default 144 DPI; ≤ 8 MP/página |
| Mídia local | 100 MiB; 5 min; fonte/saída ≤ 1080p30 SDR | Checar perfil e API; saída ≤ 100 MiB; uma execução pesada |
| Upload remoto | 250 MiB/job; um original | Sem URL import, multipart de vídeo ou retomada parcial no MVP |
| Vídeo remoto | ≤ 10 min; ≤ 3840×2160 e 60 FPS fonte | Saída ≤ 1080p30; timeout 15 min; fixture HEVC/HDR específica |
| Áudio remoto | ≤ 30 min e 250 MiB | MP3/WAV/M4A saída; WAV respeita limite de saída |
| Saída remota | 300 MiB | Predizer PCM antes de começar e abortar ao atingir teto |
| Executor | 1 job ativo global, fila máxima 3 | VM inicial sugerida 4 vCPU/8 GiB; medir antes de ampliar |
| Sandbox | 2 CPUs, 2 GiB RAM sem swap extra, 64 PIDs | Verificar enforcement cgroups v2 no host; falhar fechado |
| Disco | partição temporária 10 GiB; orçamento 2 GiB/job | Reservar antes de upload; limite por arquivo/processo e watchdog |

Quando `deviceMemory` existir e indicar ≤ 4 GiB, reduzir mídia local a 50 MiB/720p e imagem a 12 MP. A ausência da API não significa máquina potente: manter defaults conservadores e validar iPhone real. Em device/API sem encoder adequado, oferecer servidor, nunca mudar silenciosamente o modo de privacidade. Vídeo de 1,4 GB e arquivo de 7,8 GB são recusados no MVP antes da leitura integral; não prometer fallback inexistente.

### Smart Compression

MVP tem máxima qualidade, equilibrado e menor arquivo; são políticas por motor, não CRFs iguais entre codecs. O modo tamanho desejado usa FFmpeg nativo com duas passagens.

`S = alvoMB × 1.000.000`, `D = duração após corte e velocidade`, `m = 0,04` de margem inicial.
`bitrateTotal = 8 × S × (1-m) / D`; `bitrateVideo = bitrateTotal - bitrateAudio`.

Áudio padrão: AAC 128 kb/s, ou 96 kb/s no perfil menor; mono de voz só se o usuário escolher. Sem áudio, reservar zero. Usar codec H.264/MP4 para compatibilidade; não trocar para HEVC ocultamente.

Resolução: experimentar lista descendente sem upscale, preservando proporção, dimensões pares, saída até 1080p. Heurística inicial `bppf = bitrateVideo/(largura×altura×fps)`: reduzir para 720p/480p quando abaixo de 0,06; se abaixo de 0,035 mesmo em 480p, alertar e solicitar alvo maior. Valores são heurísticas a calibrar, não nota objetiva de qualidade. Não reduzir FPS silenciosamente; mostrar proposta antes de executar. Testar cenas de movimento, texto e ruído.

Exemplo: 50 MB / 120 s, margem 4%, AAC 128 kb/s → cerca de 3,072 Mb/s para vídeo. Para esse conteúdo 720p pode ser mais apropriado que 1080p; usuário vê recomendação e pode mudar.

Após 2-pass, medir bytes. Se ultrapassar alvo, uma correção de bitrate e no máximo uma nova tentativa, dentro do mesmo timeout total. Nunca usar `-fs` para truncar um arquivo. Se não cumprir, não declarar sucesso do alvo; oferecer resultado íntegro com tamanho real ou novo alvo. Arquivo final pode ficar muito abaixo do alvo em cenas simples, sem erro. UI: “Até 50 MB, buscando preservar a qualidade”; não “exatamente 50 MB”. Não mostrar SSIM/VMAF inventado.

### Backend sem banco

Uma instância de API possui a fila. Diretório privado `JOB_ROOT/<uuid>/`: `manifest.json`, `input/0.bin`, `work/`, `output/`. Nome original não compõe caminho. Escrita de manifest em temporário + rename; updates serializados por job. Token aleatório de 256 bits devolvido uma vez; somente hash no manifest. UUID não é credencial.

API mínima:

| Endpoint | Contrato |
|---|---|
| GET /v1/capabilities | formatos/perfis/limites e disponibilidade reais; sem dados do usuário |
| POST /v1/jobs | declaração de entrada/plano; valida esquema e reserva quota; devolve id/token/expiresAt |
| PUT /v1/jobs/:id/input | bearer; bytes binários; conta bytes reais, hash incremental, timeout |
| POST /v1/jobs/:id/inspect | probe e previews limitados dentro do sandbox; pode ser chamado após consentimento e upload |
| POST /v1/jobs/:id/run | bearer; valida plano novamente contra probe; idempotente, enfileira uma vez |
| GET /v1/jobs/:id | bearer; estado/revision/fase/progresso/artefatos/expiração |
| POST /v1/jobs/:id/download-ticket | bearer; ticket por output, expira em 60 s para iniciar GET |
| GET /v1/download/:ticket | attachment + no-store + nosniff; streaming, Range; não exige Bearer em link |
| DELETE /v1/jobs/:id | idempotente; cancela, mata processo/container, aguarda término e remove arquivos |

Ticket não é single-use: Range/retry do mesmo download precisa funcionar na janela válida. Pode emitir outro ticket enquanto job existir. Ocultar ticket de logs, referrer, analytics e mensagens. Download autorizado recebe lease de até 10 min, sempre limitado pelo hard expiry; não deletar no primeiro byte nem assumir que HTTP 200 significa arquivo salvo. Sem download feito via Blob remoto gigante.

TTL máximo 60 min desde criação. Upload parado: 2 min; upload total: 10 min; fila: 2 min; processamento incluindo retry: 15 min; resultado: 20 min desde conclusão, sempre capado pelo TTL absoluto. Cancelar apaga assim que subprocessos terminarem; janitor a cada 60 s, independente da API. No restart, parar containers órfãos, marcar jobs interrompidos como falhos, remover parciais; não retomar encode automaticamente. Resultado concluído só volta a ser servido se manifest/output forem coerentes e não expirados.

DELETE, timeout e término competem sob lock por job; cancelamento ganha antes do commit de output. Escrever `.part`, validar e publicar via rename; nunca servir parcial. Janitor usa relógio de parede para expiração persistida e timeout monotônico para processos ativos. Limpeza deve ignorar symlinks e confirmar que caminhos estão sob JOB_ROOT. Não prometer apagamento forense instantâneo de SSD; excluir logicamente, usar volume criptografado, sem backups/snapshots de arquivos de usuário. Durante indisponibilidade do host, limpeza pode atrasar; executar sweep antes de reabrir a API e alertar sobre atraso.

Segurança: TLS, CORS com origens exatas (não é autenticação), verificar Origin nos writes de navegador, bearer por job, quotas/rate limits por IP e global, limite de fila/disco/saída/CPU. Nomes são texto escapado, sem controles/bidi problemático, separadores, nomes reservados ou colisões. MIME e extensão são sinais, assinatura + parser de sandbox decidem. Permitir apenas um subconjunto de demuxers, sem playlists, URLs, anexos/legendas executáveis ou protocolos remotos. `spawn(executable, args, {shell:false})`, enums e números validados; nenhum filtergraph/comando livre do cliente.

Probe é um parser não confiável e também fica no sandbox. Um container por job com rootfs read-only, UID não-root, rede none, capabilities drop ALL, no-new-privileges, seccomp padrão, mounts só daquele job e nenhum segredo. Controlador usa Podman rootless local, sem socket Docker privilegiado; só lança uma imagem fixa por digest e argumento validado. Memória/cgroups não devem ser desabilitados para “fazer funcionar”. [Podman](https://docs.podman.io/en/latest/markdown/podman-run.1.html).

Futuros ZIPs: limitar contagem, bytes efetivamente expandidos, razão de expansão e tempo; recusar paths absolutos, `..`, symlink/hardlink e dispositivos. Nunca extrair recursivamente arquivos aninhados automaticamente. Antivírus pode complementar, não substitui isolamento e limites. [OWASP Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## D. Local versus servidor por operação

Legenda: L local; S servidor; H local com servidor sob consentimento; F futuro; N não recomendado. H não significa que os dois motores rodem sempre. A fase limita o que existe no lançamento.

| Categoria/operação | Caminho | Fase e restrição |
|---|---|---|
| Vídeo converter MP4/WebM | H | P0; perfis locais explícitos, FFmpeg incompatíveis |
| Vídeo cortar preciso/tempos numéricos | H | P0; reencode, intervalo por PTS |
| Vídeo timeline/miniaturas | H | P0; local quando preview decodificável, servidor após consentimento |
| Vídeo corte rápido sem reencode | H | P1; ajuste visível a keyframes |
| Vídeo corte/avanço por frame | H | P1; apenas PTS indexados, nunca FPS médio |
| Vídeo juntar | H | P1; fontes heterogêneas exigem normalização/reencode |
| Vídeo remover áudio | H | P0, parte do pipeline |
| Vídeo extrair áudio/vídeo→áudio | H | P0; copy só se container compatível, senão encode |
| Vídeo resolução | H | P0 como preset/etapa, sem upscale |
| Vídeo proporção/crop/contain | H | P1; preview explícito do corte |
| Vídeo FPS | H | P1 controle; P0 política saída ≤30 com informação |
| Vídeo compressão qualitativa | H | P0 |
| Vídeo tamanho desejado | S | P0; 2-pass e verificação |
| Vídeo codec/bitrate avançados | H | P1; enums por perfil, sem texto livre |
| Vídeo velocidade | H | P1; sincronizar áudio/pitch escolhido |
| Vídeo girar/espelhar | H | P1 |
| Vídeo→GIF | H | P1, limitar duração/pixels/frames |
| Vídeo presets sociais | H | P1; perfis genéricos P0 |
| Áudio converter/cortar/manter trecho | H | P0; MP3/WAV/M4A saída |
| Áudio waveform/seleção numérica | H | P0; peaks incrementais ou servidor |
| Áudio dividir/remover trecho | H | P1 |
| Áudio juntar | H | P1 |
| Áudio volume/normalização/fades | H | P1; normalização loudness pode precisar análise+encode |
| Áudio velocidade | H | P1; especificar preservar tom |
| Áudio bitrate/sample rate/mono-estéreo | H | P1 controle; defaults P0 |
| Imagem JPG/PNG/WebP converter | L | P0; encoder verificado |
| Imagem resize/compressão qualidade | L | P0; PNG sem slider falso |
| Imagem batch | L | P0, 100 itens dentro do orçamento |
| HEIC→JPG/PNG/WebP | L | P0, native→WASM e limites; sem server HEIC MVP |
| Imagem crop/girar/espelhar | L | P1 |
| Imagem remover metadata | L | P0 reencode com política explícita EXIF/GPS/XMP removidos |
| Imagem→PDF | L | P0; JPG/PNG e intermediário das imagens aceitas |
| Imagem→favicon ICO | L | P1; encoder ICO multirresolução dedicado |
| Imagem AVIF saída | H | P1; codec WASM específico ou Sharp |
| TIFF/BMP/ICO importar | H | P1/P2; não presumir suporte universal Canvas |
| SVG→raster | H | P1 após sanitização; raster→SVG vetorial fiel N |
| GIF animado transformar | H | P2; não achatar silenciosamente |
| PDF unir/dividir/extrair | L | P0; sem criptografia/assinaturas/forms complexos |
| PDF preview/PDF→JPG/PNG | L | P0; páginas incrementais |
| PDF remover/reordenar/rotacionar páginas | L | P1; mesma engine |
| PDF comprimir estrutura | S | P1 qpdf, redução não garantida |
| PDF comprimir com perda | S | P2, licença/render QA |
| PDF senha/adicionar/remover conhecida | S | P1 qpdf; sem brute force |
| PDF→Office fiel | N | Não prometer; OCR/reconstrução só pesquisa P3 |
| TXT/Markdown/HTML estático | L | P1; sem conteúdo ativo |
| DOC/DOCX/ODT/RTF→PDF | S | P2; LibreOffice, best effort |
| DOCX/ODT/Markdown conteúdo | S | P2 Pandoc, não preservar layout |
| XLS/XLSX/ODS→PDF | S | P2; planilhas/áreas/fontes/recalculo podem mudar |
| PPT/PPTX→PDF | S | P2; sem animação/mídia interativa |
| Office round-trip perfeito | N | Não oferecer como garantia |
| ZIP de resultados | L | P0, limites de memória/output |
| ZIP criar/listar/extrair genérico | L | P1, limites contra bombas |
| TAR/GZIP criar/listar/extrair | L | P1; GZIP é stream, não diretório |
| 7Z criar/listar/extrair | S | P2; WASM futuro apenas se justificar |
| RAR listar/extrair | S | P2; build/licença verificados |
| RAR criar | N | Não incluir |

## E. Matriz de formatos

“Entrada” significa aceitar variantes homologadas, não todo arquivo com essa extensão. Publicar uma matriz baseada no registro efetivo do build e nos testes, não em toda a lista de codecs FFmpeg.

| Família/formato | Entrada local | Entrada servidor | Saída produto |
|---|---|---|---|
| MP4/M4V | H.264/AAC SDR homologado | H.264; HEVC conforme perfil | MP4 H.264/AAC P0; M4V não prioritário |
| MOV | H.264/AAC se demux+decode aprovados | HEVC SDR; ProRes após limite/teste | MOV saída P2; principal destino MP4 |
| WebM | VP8/VP9 + Opus conforme browser | FFmpeg allowlist | WebM VP9/Opus P0 |
| MKV | Não habilitado P0 | H.264/HEVC/VP8/VP9 homologados | MKV saída P2 |
| AVI | Não P0 | MPEG-4 Part 2/MJPEG homologados | Saída legada P2, pouco valor |
| MPEG/MPG | Não P0 | MPEG-1/2 homologados | Saída P2 |
| 3GP | Não P0 | H.263/H.264 + AAC/AMR conforme build | Saída não prioritária |
| TS/MTS/M2TS/FLV/WMV | Futuro | P2 por fixtures e decoder | Não saída MVP |
| AV1/HEVC/HDR | Capability não basta para habilitar P0 | HEVC SDR P0; AV1/HDR gating | HEVC/AV1 saída P2 |
| MP3 | Decode validado; encode via extensão | Sim | MP3 P0 |
| WAV | PCM homologado | PCM | WAV PCM16 P0 |
| AAC/M4A | Decode por capability | AAC | M4A AAC-LC P0; AAC ADTS P1 |
| FLAC | Decode por capability | Sim | FLAC P1 |
| OGG/Opus | Decode por capability | Vorbis/Opus | P1; OGG é container |
| WMA/AIFF | Não P0 | WMA/PCM homologados | AIFF P2; WMA saída sem prioridade |
| JPG/JPEG/PNG/WebP | Sim com verificação | Futuro Sharp | Os três P0 |
| HEIC/HEIF | Native ou libheif WASM, limites | Futuro build específico | Entrada P0, sem export HEIC |
| AVIF | Capability decode | Futuro Sharp | Encode P1 |
| GIF | Só estático no MVP; detectar animação e recusar | Futuro | GIF animado P2 |
| BMP/TIFF | Não P0 | P1/P2 Sharp/build | P1/P2, TIFF multipágina exige seleção |
| SVG | Não P0 | P1 rasterização segura | Sem raster→vetor automático |
| ICO | Não P0 | Não necessário inicialmente | Favicon P1 |
| PDF | Estático, não criptografado P0 | Senha/otimização P1 | PDF e páginas JPG/PNG P0 |
| DOC/DOCX/ODT/RTF | Não converter Office local P0 | LibreOffice/Pandoc P2 | PDF e subconjunto, best effort |
| TXT/HTML/MD | P1 | Pandoc quando necessário P2 | P1 texto/markup seguro |
| XLS/XLSX/ODS | Não P0 | LibreOffice P2 | PDF; conversões de dados específicas futuras |
| PPT/PPTX | Não P0 | LibreOffice P2 | PDF estático P2 |
| ZIP | Criação de resultados P0 | Futuro | ZIP P0 |
| TAR/GZIP | P1 | Possível, não necessário | P1 |
| 7Z/RAR | Não P0 | 7-Zip P2 | 7Z sim, RAR não |

## F. Fluxos UX

1. Home: marca pequena, título “Resolva seu arquivo.”, frase “Converta, corte ou reduza. Sem instalar nada.” e dropzone. Não afirmar “qualquer formato”. Abaixo, links textuais para ferramentas e explicação curta de privacidade. Escolher arquivo ainda não é upload.
2. Entrada: seleção por botão/arraste/teclado; lista imediata com nome/tamanho; inspecionar metadados progressivamente. Não bloquear lista enquanto preview prepara. Aceitar lote somente de imagens nessa versão. Categoria desconhecida oferece mensagem e formatos aceitos, sem spinner interminável.
3. Conversão: ações compatíveis em barra compacta, formato recomendado, resumo da saída e botão “Processar”. Detalhes avançados fechados. Preview não precisa existir para conversão numérica de fonte incompatível.
4. Corte vídeo: preview central, timeline de miniaturas visíveis, alças grandes, campos início/fim/duração com milissegundos, zoom e “Prévia do trecho”. Aviso discreto de reencode. Seleção mantida ao trocar formato. Proxy remoto limitado se fonte não reproduzir; usuário aprova upload antes. Proxy é só preview, export usa original e timestamps do probe.
5. Corte áudio: waveform de peaks por janela, playhead, in/out e teclado; nada de onda fictícia. Sem decode local, gerar peaks no sandbox após autorização. Mudar volume do player não muda o arquivo sem operação explícita.
6. Imagem: preview antes/depois por amostra, dimensões travadas pela proporção, lado maior, qualidade para JPG/WebP, fundo branco configurável para transparência→JPG. Sempre mostrar dimensões finais.
7. PDF: miniaturas virtualizadas, seleção acessível por checkbox e campo de páginas (“1-3, 7”), opções unir/dividir/imagens→PDF/PDF→imagens. Ordem do input determina merge; controles de mover documento evitam dependência de drag.
8. Batch: uma receita comum, resumo de quantidade e limites, lista de status, progresso “37 de 100”, erro por item, continuar nos demais. Resultado distingue concluídos/falhos, oferece ZIP dos sucessos e relatório local dos erros. Sem arquivos fictícios dentro do ZIP.
9. Remoto: modal mostra que arquivo será enviado, operação, limite e prazo real. CTA “Enviar e processar temporariamente”. Escolha não autoriza enviar próximos arquivos automaticamente. Mostrar `Processamento temporário` também durante preview remoto.
10. Erro: preservar seleção/configuração quando possível. Código técnico copiado opcionalmente, texto claro e ação concreta. “Este codec não pode ser convertido neste navegador. Você pode usar o processamento temporário.” Se backend ausente, não renderizar CTA que não funciona. Falha desconhecida de worker não é automaticamente declarada falta de RAM.
11. Conclusão: nome, formato, bytes reais, duração/dimensões e botão Baixar. Processar outro limpa recursos próprios, não IndexedDB/localStorage/Cache de aplicativos irmãos. Falha no download permite repetir antes do TTL. Não declarar “salvo no seu dispositivo” com base só no clique.
12. Mobile: preview acima, ferramenta selecionável em sheet/painel, parâmetros em coluna e ação fixa com safe-area; timeline com pan/zoom que não captura scroll vertical. 44 px nos alvos, inputs 16 px, 360 px sem overflow. Teclado aberto não cobre in/out nem CTA. Explicar que iOS pode suspender processamento ao trocar de app; não prometer background.

### SEO, presets, privacidade e anúncios

`ToolDefinition` é única fonte: slug, família, input/output, receita inicial, copy original, FAQs úteis, capability requerida, estado habilitado. Uma página não implementa motor. Gerar páginas estáticas + sitemap + canonical por deployment; slugs ausentes retornam 404. Estado de job/arquivo nunca entra na URL.

P0: home e 9 rotas: mp4-para-mp3, mov-para-mp4, png-para-jpg, jpg-para-webp, heic-para-jpg, pdf-para-jpg, comprimir/video, cortar/video, cortar/audio. Prefixos `/converter/`, `/comprimir/`, `/cortar/`. Indexar somente páginas funcionais; demonstração fica noindex para não duplicar o domínio de produção. Conteúdo descreve limitações reais e não cria centenas de páginas vazias.

P0 inclui `compatível`, `equilibrado`, `menor arquivo`. P1 social presets centralizados com `id`, `version`, `reviewedAt`, `sources`, `aspect`, `fit`, `maxDimensions`, `fpsPolicy`, `container`, `videoCodec`, `audioCodec`, `targetPolicy`. Planejar TikTok/Reels/Stories/Shorts (vertical), Feed (quadrado/retrato), YouTube (horizontal), WhatsApp/Discord/Telegram (compatibilidade+tamanho), Facebook/X (perfil configurável). Essas são propostas de uso, não limites oficiais verificados nesta investigação. Antes de publicar marca/limite, consultar documentação oficial da plataforma; sem inventar maxBytes globais que variam por conta/plano/API.

AdSlot: footer após conteúdo, rail de 300×250 apenas quando sobrar espaço fora do editor, pós-conclusão separado visualmente do download. Mobile usa área abaixo do resultado/conteúdo. Reservar min-height quando placements forem habilitados antes do paint; slot vazio não deve criar painel falso de anúncio. Nunca inserir publicidade sobre controles ou perto da ação de baixar. Sem SDK P0. Na monetização, editor em origem dedicada sem scripts terceiros e ads em página/origem de marketing; isolamento só por rota não isola storage nem scripts da origem. Escolher essa separação antes de ativar anúncios.

Privacidade local refere-se aos bytes do arquivo, não a ausência de toda conexão HTTP do site. Download de motores é normal; telemetria não inclui nome, hash, conteúdo, thumbnails, tokens ou URLs de artefatos. P0 só métricas operacionais agregadas do backend. Não usar session replay.

COOP/COEP não são necessários para o MVP sem WASM multithread. P2, se multithread justificar, usar origem de editor isolada com `COOP: same-origin`, `COEP: require-corp`, assets same-origin/CORP/CORS corretos e `crossOriginIsolated` verificado. Não aplicar headers globais cegamente no monorepo; não usar hack de Service Worker para obter isolamento. [COOP/COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy).

Pages serve demonstração estática em `/teste1/file360/`; produção comercial deve ir para domínio próprio em host que aceite o uso e os headers. O Pages possui restrições para negócios/SaaS; não projetar monetização dependente dessa hospedagem. [Limites oficiais](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## G. Design system — “mesa de trabalho clara”

| Item | Especificação |
|---|---|
| Fundo | #F5F5F2 |
| Superfície | #FFFFFF; área de preview #ECEEEB |
| Texto | #202723; secundário #59645D |
| Ação principal | #176343, texto branco; hover #124D34 |
| Bordas | #D9DED8; focus #176343 com outline 2 px + offset 2 px |
| Erro/aviso | #A32C2C / #855000, texto + ícone pontual + mensagem |
| Tipografia | system-ui/-apple-system/Segoe UI; sem fonte remota no MVP |
| Escala | 12 legenda, 14 auxiliar, 16 corpo/input, 20 painel, 28 título editor, 40 home desktop/30 mobile |
| Números | tabular-nums para tempo, tamanho e progresso |
| Espaçamento | 4, 8, 12, 16, 24, 32, 48 |
| Grid | max-width 1280; 12 colunas; gutter 24 desktop/16 mobile; margens 32/16 |
| Editor desktop | preview flexível + painel 320 px, gap 24; timeline ocupa largura útil |
| Breakpoints | <768 coluna; 768–1099 parâmetros abaixo/lateral adaptativa; ≥1100 painel lateral |
| Raios | 6 controles; 10 painéis; pills só para status |
| Sombras | nenhuma nos painéis base; dropdown/dialog 0 8px 24px rgb(0 0 0 / .10) |
| Botões | 40 px desktop, ≥44 toque; primário sólido, secundário neutro, destrutivo textual |
| Select | nativo inicialmente, label sempre visível |
| Slider | trilho 4 px, thumb 16 visual/alvo 44; input numérico equivalente |
| Timeline | 88–120 px; ruler 24, thumbs 48–64, handles com alvos 44; seleção verde translúcida |
| Waveform | 96 px desktop/72 mobile; canvas + equivalente semântico em campos/controles |
| Dropzone | 240 px desktop/180 mobile, borda 1 px tracejada, hover sem saltos |
| Progresso | trilho 6 px, fase+porcentagem quando conhecida; indeterminado real caso contrário |
| Tooltip | ajuda adicional, nunca informação essencial; teclado/toque acessíveis |
| Dialog | focus trap, Escape quando aplicável, retorno de foco, CTA explícita |
| Movimento | 120–180 ms; reduzir/desligar com prefers-reduced-motion |

Sem gradiente de marca, sem hero gigante, sem cards repetidos de categorias. Hierarquia nasce de alinhamento, escala e espaços. Bordas sutis delimitam editor, não cada frase. Acessibilidade WCAG AA: verificar contraste real, navegação por teclado, nomes/descrições, foco e anúncios aria-live sem narrar cada frame/percentual. Cor sozinha não transmite estado. Dark mode P2.

Wireframe desktop:

```text
FILE360                                      Privacidade   Ajuda
arquivo.mov  ·  84 MB  ·  01:42           Processamento local
Converter   Cortar   Comprimir   Extrair áudio
┌──────────────────────────────────┐  Saída
│                                  │  MP4 · Compatível
│             PREVIEW              │  Tamanho / Qualidade
│                                  │  Mais opções
└──────────────────────────────────┘  Resumo do processamento
| miniaturas + seleção + playhead  |  [ Processar arquivo ]
Início [00:12.000] Fim [00:38.500]
```

## H. Componentes principais

| Componente | Responsabilidade |
|---|---|
| AppShell/ToolPage | HTML indexável, navegação e layout; sem engine |
| FileDropzone/FilePicker | entrada acessível, sem envio automático |
| AssetList/FileSummary | nomes/tamanhos/probe e remoção |
| Workspace/OperationBar | edição da intenção de processamento |
| VideoEditor/AudioEditor | preview e seleção; sem argumentos FFmpeg |
| TrimTimeline/Waveform | visualização temporal + eventos de seleção |
| TimeRangeFields | fonte acessível de in/out, validação e precisão |
| ImageRecipePanel | formato, lado maior, qualidade, fundo |
| PdfPageGrid/PageRangeField | seleção virtualizada, ranges e ordem |
| OutputSettings/PresetPicker | políticas de saída, detalhes recolhidos |
| PipelineSummary | resumo humano da receita normalizada |
| ProcessingModeBadge/ServerConsentDialog | procedência e fronteira de privacidade |
| JobProgress/CancelAction | fase, progresso real, cancelar |
| BatchResults | sucesso/falha individual e ZIP dos sucessos |
| ResultPanel/DownloadButton | artefatos reais e download repetível |
| ErrorNotice | mensagem, recuperação disponível e código |
| AdSlot | reserva futura sem SDK |

## I. Código e contratos

```text
file360/
  docs/ARQUITETURA.md, PROMPT-SOL.md
  package.json, pnpm-workspace.yaml, pnpm-lock.yaml
  apps/web/
    src/app/{page.tsx,layout.tsx,converter/[slug]/page.tsx,
             comprimir/[kind]/page.tsx,cortar/[kind]/page.tsx}
    src/components/ui/        # button, dialog, field, progress, tooltip
    src/features/{workspace,media,images,pdf,batch,download}/
    src/runtime/              # planner, capabilities, job-reducer, stores
    src/engines/              # local-media, local-image, local-pdf, server
    src/workers/              # media/image/pdf entry points + protocol
    src/config/               # tool-catalog, presets, limits, deployment
    src/styles/               # tokens.css, globals.css
    public/engines/            # assets fixados, licença/hashes, lazy
    next.config.ts
  apps/processor/src/
    server.ts, routes/, jobs/, security/, runner/, cleanup/
  packages/contracts/src/     # schemas compartilhados; sem APIs React/Node
  tests/{unit,integration,e2e,fixtures}/
  scripts/{stage-pages,generate-fixtures,verify-artifacts}/
  infra/{Containerfile.media,processor.service,janitor.service,
         janitor.timer,Caddyfile.example,env.example}
```

Criar arquivos conforme a sequência de implementação, não scaffolding vazio para todas as ferramentas futuras. Nada de árvore genérica de herança `UniversalFileEngine` com 30 métodos que a maioria dos adapters não implementa.

```ts
type Operation =
  | { kind: 'trim'; inUs: number; outUs: number }
  | { kind: 'mute' }
  | { kind: 'resize'; maxWidth: number; maxHeight: number; fit: 'contain' }
  | { kind: 'encode'; profileId: string; quality: 'high'|'balanced'|'small' }
  | { kind: 'targetSize'; bytes: number }
  | { kind: 'extractAudio'; profileId: string }
  | { kind: 'imageRecipe'; format: 'jpeg'|'png'|'webp'; maxEdge: number; quality?: number; background: string }
  | { kind: 'pdfMerge'; assetIds: string[] }
  | { kind: 'pdfExtract'; pages: number[] }
  | { kind: 'pdfRender'; pages: number[]; dpi: number; format: 'jpeg'|'png' }
  | { kind: 'imagesToPdf'; assetIds: string[] };

type JobStatus = 'idle'|'inspecting'|'ready'|'awaitingConsent'|'preparing'
  |'uploading'|'queued'|'processing'|'finalizing'|'done'|'failed'
  |'cancelling'|'cancelled'|'expired';

interface ExecutionPlan {
  schemaVersion: 1;
  engineId: string;
  location: 'local'|'temporary-server';
  inputIds: string[];
  operations: Operation[];
  policyVersion: string;
  expected: { mime: string; maxOutputBytes: number; durationUs?: number };
  warnings: string[];
}
interface EngineAdapter {
  id: string;
  assess(request: PlanRequest, caps: Capabilities): SupportResult;
  run(plan: ExecutionPlan, io: EngineIO, signal: AbortSignal,
      emit: (event: JobEvent) => void): Promise<Artifact[]>;
  dispose(): Promise<void>;
}
```

Tipos referenciais (`PlanRequest`, `EngineIO`, etc.) devem ser definidos no código do MVP conforme necessidade. Arquitetura não é código pronto para compilar. Schemas Zod versionados validam entrada e saída em ambas as fronteiras. Assets possuem id, File/Blob referência, bytes e probe; artefato contém id, nome seguro, MIME verificado, bytes, metadata e handle de leitura. File/Blob vive em store fora de React; não serializar bytes no estado/JSON nem cloná-los desnecessariamente entre workers. Transferables cedem propriedade de ArrayBuffer; não destacar buffer ainda usado pelo preview.

Planner valida compatibilidade sem mudar semântica: trim → mute/áudio → geometry → encode. Compressão/targetSize alteram parâmetros de encode; converter é seleção de perfil, não segunda passagem de encode por definição. Conflitos explícitos (mute + extractAudio, duas seleções contraditórias) geram erro. Receita/inputs ficam congelados ao executar; alterações criam novo plano. MVP apresenta controles integrados e resumo, não um editor visual de workflow.

Job tem id, revision, plan, engine, timestamps, phase, progress com total opcional, outputIds e erro normalizado. Eventos atrasados após cancelar ou de generation antiga são ignorados. `done` exige artefato fechado e validado. Progresso de encode não chega a 100% enquanto finalização não terminar; não fabricar cronômetro. Para PDF sem progresso granular, usar fases; batch usa itens concluídos e atual.

Cancelamento local: AbortSignal + cancel da biblioteca; se worker não responder em 2 s, terminate e recriar depois. Não compartilhar um worker terminável entre jobs independentes. Descartar buffers/output parcial. Remoto: DELETE + stop por container id do próprio job, SIGTERM e kill em até 5 s; só cancelar HTTP/polling não basta.

## J. Roadmap por valor, custo e risco

| Fase | Entrega | Valor / SEO | Complexidade e risco | Infra e monetização |
|---|---|---|---|---|
| MVP / P0 | Imagens batch+HEIC; 4 PDF; mídia core; backend efêmero; 9 páginas | Alto, tarefas frequentes e buscáveis | Médio/alto em mídia; limitar variantes | VM limitada, publicidade desligada |
| V1 / P1 | Merge mídia, frame stepping validado, crop/speed/fades; presets sociais; PDF senha/reordenar; ZIP/TAR/GZIP; AVIF | Alto em criadores e busca longa | Médio/alto; priorizar homologação | qpdf/Sharp seletivos; estudar ads após isolamento |
| V1.5 / P2 | Office best effort, 7Z/RAR, PDF com perda, mídia batch, OPFS/stream sinks, WASM opcional pequeno, dark | Valor específico; SEO depende de confiabilidade | Alto por segurança/fidelidade/memória | Mais CPU/disco; limites/custos antes de ampliar |
| V2 / P3 | 4K/grandes arquivos/retomada, API comercial, recursos pagos sem anúncios, conversões avançadas | Expansão validada por demanda | Alto; operação distribuída só com necessidade | Auth/billing/storage se proposta futura exigir |

Batch áudio P2 inicialmente até 10 itens sequenciais; vídeo até 3 curtos, sem processar todos em paralelo. Revisar limites com uso real; não multiplicar fila gratuita por lote. A arquitetura permite, mas não expõe no MVP.

Indicadores agregados: sucesso por perfil/motor, tempo por minuto de mídia, taxa fallback, falha mobile, custo CPU/GB por job e bytes baixados. Não captar nomes/conteúdo. Não estimar receita de ads sem dados. Primeiro custo fixo de VM+egress; capacidade aproximada por tempo médio medido. Uma fila com 1 worker e jobs de 2 minutos tem ordem de grandeza de 30 jobs/h, não SLA. Se fila/custo crescer, revisar limites antes de comprar infraestrutura distribuída.

## K. Riscos e respostas

| Risco | Resposta / gate |
|---|---|
| Safari mata aba | limites conservadores, frames liberados, dispositivo real, fallback explícito |
| Encoder reporta suporte mas falha | pequeno teste, erro recuperável, manter original/plano |
| Container aceito com codec inesperado | probe por faixa, allowlist, nunca suporte por extensão apenas |
| Fonte HDR perde aparência | transcode local desligado; tone-map server homologado ou rejeição |
| Corte VFR/B-frames | PTS em ordem de apresentação e fixture com frame IDs |
| MP3/AAC padding | tolerâncias declaradas, teste áudio decodificado e A/V sync |
| alvo impraticável | recomendar resolução/alvo, verificar bytes, não truncar |
| HEIC parser/licença | binário atualizado e auditado, limites, notices e obrigações do binário |
| PDF malicioso/formulário/assinatura | worker, libs atualizadas, recusa de casos fora de contrato |
| ZIP bomb/path traversal | limites de expansão em runtime e extração confinada futura |
| MIME/filename/comando | sniff+probe, IDs internos, schemas, args sem shell |
| Job de terceiro acessível | token 256 bits por job, hash, tickets curtos, testes cruzados |
| Disco ou CPU gratuitos abusados | quotas globais, 1 ativo, fila 3, rate limits e orçamento |
| Cleanup falha | timer independente, startup sweep, alerta, interromper admissão se disco/atraso |
| download interrompido | ticket renovável, Range, lease limitada, resultado até TTL |
| publicidade observa arquivo | sem SDK; origem isolada antes de ativar |
| licença FFmpeg/Ghostscript/HEIC | SBOM, build flags, notices/source e licença por componente; gate de distribuição |
| Pages substitui outros apps | staging aditivo, basePath e smoke tests das rotas irmãs |

A licença do wrapper não determina a do binário. FFmpeg com x264 pode ser GPL; libheif e codecs possuem termos próprios; Ghostscript AGPL/comercial. Não foi emitido parecer jurídico. Decisão técnica é minimizar dependências e documentar composição/obrigações antes de redistribuir WASM ou disponibilizar componentes sujeitos a condições de rede.

## L. MVP final fechado

INCLUI:

- Home e workspace pt-BR responsivos; sem conta; fluxo até download real.
- JPG/PNG/WebP → JPG/PNG/WebP; AVIF somente entrada se decode aprovado; HEIC decode nativo/WASM dentro dos limites; imagem estática GIF somente; resize proporcional, qualidade JPEG/WebP, retirada de EXIF/GPS/XMP por reencode, lote 100 e ZIP.
- PDF estático não criptografado: unir documentos, extrair/dividir seleção, imagens→PDF, PDF→JPG/PNG; previews e ZIP quando múltiplos resultados.
- Vídeo um arquivo: converter para MP4 H.264/AAC ou WebM VP9/Opus, cortar um intervalo, três níveis de compressão, tamanho-alvo remoto, remover áudio, resize até 1080p, extrair MP3/WAV/M4A. Pipeline combina trim+mute+resize+compress+encode; extractAudio é saída alternativa.
- Áudio um arquivo: converter MP3/WAV/M4A e manter intervalo; waveform/numeric range.
- Backend FFmpeg completo para o escopo e limites, autorização de upload, status/cancelamento/cleanup/tickets. Fontes P0 por matriz e fixtures; perfis não homologados retornam erro claro.
- 9 páginas SEO, design tokens, AdSlot sem SDK, testes e documentação de instalação.

EXCLUI: UI frame-perfect/step de frame, corte rápido sem reencode, merge de mídia, crop/aspect/social presets, GIF animado, AVIF encode, PNG quantization, senhas/compressão PDF, Office, extração ZIP/RAR/7Z, batch mídia, ffmpeg.wasm, OPFS, login/billing/analytics de sessão.

O build estático funciona sem backend: só oferece recursos locais disponíveis; informa indisponibilidade dos remotos. Isso é modo local de demonstração. Conclusão do MVP híbrido requer testar backend real e integração; mocks não comprovam essa entrega. Sem servidor provisionado, entregar runnable backend e indicar implantação pendente, sem afirmar que o lançamento completo ocorreu.

## M. Aceitação e testes

1. Repositório: diff só em `file360/` nesta arquitetura; implementação admite hub/workflow apenas para integração aditiva. Smoke tests dos apps existentes e comparação de arquivos-fonte irmãos inalterados.
2. Segurança local: interceptar rede em teste e demonstrar ausência de bytes/nome/hash do arquivo antes de consentimento. Engines podem baixar assets, arquivo nunca acompanha request local. Nenhum SDK terceiro no editor.
3. Home: meta de orçamento ≤200 KiB gzip de JS inicial e ≤500 KiB transferidos totais sem motores; reportar números reais do build. Nenhum WASM/PDF.js/Mediabunny solicitado antes de ferramenta/arquivo exigir. CI falha se import pesado vazar para shell.
4. Core Web Vitals produção p75: LCP ≤2,5 s, INP ≤200 ms, CLS ≤0,1; staging mira CLS ≤0,05 e Lighthouse mobile ≥90 como smoke, não prova de INP real. [Web Vitals](https://web.dev/articles/vitals).
5. Imagens: 100 JPGs fixture de 1–2 MP → WebP, lado maior 1200, quality 82; 100 saídas com assinatura WebP, nomes únicos e dimensões certas; EXIF/GPS removidos; uma falha não perde 99 sucessos. Respeitar 250 MiB input/100 MiB output e não decodificar 100 simultaneamente.
6. HEIC: fixtures iPhone orientação/alpha/perfil; prova decode real no Safari e fallback Chrome; 48 MP fora do limite recusado com explicação. Sem ficar preso na preparação.
7. PDF: corpus estático com tamanhos/orientações diferentes; contagem/ordem/rotação/aparência corretas, faixa selecionada exata; 30 exports sequenciais; senha/assinatura/forms fora do escopo retornam erro útil. PDF→imagem medido por dimensões e comparação visual tolerante.
8. Vídeo: fixtures CFR com contador de frames, VFR, B-frames, rotação, áudio ausente, HEVC SDR e arquivo corrompido. Corte preciso preserva primeiro/último frame selecionado segundo PTS; tolerância da borda no máximo um intervalo de frame da fonte; output pode começar em t=0. `video.currentTime` não é oráculo.
9. Áudio: WAV PCM corte por amostra com deslocamento ≤1 sample quando mesma taxa; MP3/M4A duração decodificada com tolerância ≤50 ms, sem corte audível extra; A/V sync ≤50 ms no começo e fim das fixtures.
10. Compressão: alvo 50 MB produz arquivo íntegro ≤50.000.000 bytes ou estado explícito alvo não atingido após retry limitado. Verificar duration, tracks e decode completo curto. Nunca tratar arquivo truncado como sucesso.
11. Cancelamento: local libera worker/recursos até 2 s; servidor para processo/container até 5 s e remove parciais após término. Cancelar em upload/fila/finalização; eventos tardios não mudam para done.
12. Backend: token de um job não acessa outro; oversized streams sem Content-Length também bloqueados; timeout, fila lotada, saída crescente, disco cheio, restart, DELETE repetido, tentativa SSRF/path traversal/injeção testados. Recursos limitados no SO comprovados no Linux alvo.
13. Cleanup: relógio controlável em testes; expiry torna resultado inacessível; varredura remove arquivos em até 60 s com host operacional; matar API e confirmar timer; reiniciar host e limpar antes de servir; upload abandonado deixa zero órfãos após coleta.
14. Downloads: Desktop/iPhone/Android; nomes com acentos/emoji/duplicados, ZIP íntegro, re-download e Range; nenhum resultado desaparece no primeiro GET; lease respeita hard TTL.
15. Navegadores: Playwright Chromium/Firefox/WebKit + Safari macOS e iPhone físico + Chrome Android físico. Registrar versões/OS/modelo, dimensões, tempos e falhas. Mínimo de produto Safari/iOS 17.4; suporte local é capability-gated, não garantido por versão. Homologar versões atual/anterior efetivamente disponíveis na data do teste.
16. Acessibilidade: teclado completo, foco, zoom 200%, leitor de tela no fluxo básico, axe sem violações críticas, 360/390/768/1280 px. Time inputs substituem drag, progresso não inunda aria-live.

Fixtures pequenas sintéticas, licenciadas, com manifest de origem/SHA256/metadados esperados; gerar arquivos enormes/bombs controladas durante testes isolados em vez de versionar gigabytes. Unit: schemas, ranges, planner, presets, orçamento de tamanho, filename e reducer. Integration: engines reais, ffprobe/decodificação, assinatura de imagem, PDF e ZIP. E2E: fluxo real e privacidade; testes mock apenas para falhas determinísticas de UI. Testes visuais e contadores de frame verificam resultado, não apenas existência de download.

### Gates antes de implementação ampla

1. Validar worker bundling/basePath Next e export estático em subpasta com um arquivo pequeno.
2. Provar conversão H.264/AAC e corte VFR usando Mediabunny, checando tracks e cancelamento; registrar suporte em navegador disponível e pendências físicas.
3. Provar HEIC nativo/fallback e PDF renderer/editor separados.
4. Provar um job FFmpeg isolado com timeout e limpeza mesmo com API parada.
5. Só então montar os demais fluxos. Se um motor local falhar, manter caminho remoto real; não fingir sucesso nem substituir conversão por renomear extensão.

## N. Handoff

O prompt autocontido para execução está em [PROMPT-SOL.md](PROMPT-SOL.md). A implementação é trabalho seguinte; este documento não instala dependências, não modifica aplicações existentes e não inicia serviços.

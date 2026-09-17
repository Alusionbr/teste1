# File360 — expansão de ferramentas rápidas

Planejamento de 17/09/2026. Base inspecionada: 873f8f2. Este documento orienta a expansão local e prevalece sobre propostas de backend do plano ARQUITETURA.md para estas entregas. Não representa funcionalidades já implementadas.

## Direção de produto

Público: pessoas que precisam resolver uma tarefa de arquivo no celular em poucos passos; criadores são a segunda camada. Não presumir que todos os celulares deixam de oferecer a mesma função. O diferencial é reunir tarefas, compatibilidade e processamento em lote numa experiência acessível, sem instalação obrigatória.

Fluxo: selecionar arquivo → escolher objetivo → prévia e até três controles principais → processar → baixar ou compartilhar. Controles adicionais ficam em Ajustes. Manter acesso pelas categorias existentes e acrescentar busca local por intenção e sinônimos. Não trocar a home por uma grade enorme de ferramentas.

Restrições: Next.js estático, React e TypeScript existentes; nenhuma conta, banco, servidor de processamento, upload, anúncio externo ou API paga. Bibliotecas locais sob demanda. Arquivos e nomes não entram em telemetria. Preservar os outros aplicativos do monorepo.

## Base existente e dívida antes da expansão

Existem conversão de imagens, resize, recorte central por proporção, rotação, espelhamento, lotes; operações PDF por seleção numérica; conversão/corte de mídia, áudio extraído e GIF; ZIP/GZIP. Não reconstruir esses motores.

Os testes registrados comprovam uma conversão curta real e gates de código; não comprovam operação estável com 500 MB em iPhone. O teto atual é política de admissão, não garantia de memória. OPFS reduz memória da saída, mas não limita sozinho decoder, resolução ou filas.

Antes de ampliar recursos de mídia, revisar: fallback de OPFS que pode manter orçamento ampliado em memória; encerramento/abort do writer antes de remover parciais; limpeza sem apagar resultado ainda ativo ou restaurado do bfcache; cancelamento perto da finalização; faixas de áudio descartadas; mensagens de limite do GIF coerentes com a inspeção geral. Documentar o que foi medido. Não aumentar novamente os números como substituto de teste.

## Entregas em ordem

### P0 / pacote 1 — base confiável e resultado compartilhável

Esforço recomendado ao Sol: alto nas correções de recursos, médio na interface.

- Revisar os pontos de mídia acima; criar testes direcionados para as falhas confirmadas.
- Criar catálogo central de ações: id, nome leigo, sinônimos, categoria, tipos de entrada, configuração inicial e condição de disponibilidade. Usar o catálogo para atalhos e rotas SEO, reutilizando os motores.
- Mostrar objetivos como Reduzir tamanho, Juntar em PDF, Tirar o som, Criar GIF. Não listar ações incompatíveis como se funcionassem.
- No resultado: renomear com sanitização, baixar e Compartilhar quando navigator.canShare({files}) aprovar. A chamada share deve partir de um clique; cancelamento da folha de compartilhamento não é erro de conversão. Baixar permanece disponível.
- Permitir Ajustar novamente mantendo o arquivo original e as opções na sessão. Uma nova execução invalida explicitamente o resultado anterior; liberar recursos na hora correta.

Aceitação: reusar o mesmo arquivo; editar nome com acentos; compartilhar quando disponível e baixar quando indisponível; cancelar sem perder a seleção; nenhuma chamada de rede contém arquivo ou nome; regressão de todas as saídas existentes.

### P1 / pacote 2 — imagens para tarefas do dia a dia

Esforço: médio; alto para gerenciamento de memória e editor de ocultação.

- Reduzir para até 200 KB, 500 KB, 1 MB ou tamanho personalizado. Usar JPG/WebP, no máximo oito tentativas de qualidade e três níveis de dimensão, sequenciais e canceláveis. Validar os bytes reais. Se não atingir, mostrar tamanho obtido e alternativa; nunca prometer tamanho exato. Limite alvo mínimo inicial: 50 KB. PNG preservado não recebe promessa de compressão com perdas.
- Dimensões numéricas, proporção travada, recorte livre com alças e campos equivalentes. Prévia deve refletir o resultado, inclusive orientação EXIF.
- Ocultar região de captura com retângulo opaco e exportação achatada. Remover metadados na saída e não incluir original/camadas no download. Desfoque fica como efeito estético futuro, não como proteção de informação.
- Juntar imagens verticalmente ou em grade de 2 colunas com ordem, espaçamento e fundo. Limites iniciais: 10 entradas, saída até 12 MP e maior lado até 8192 px, reduzindo proporcionalmente. Prévia reduzida, uma imagem decodificada por vez.

Aceitação: arquivos abaixo do alvo ou falha explícita; alpha tratado com fundo escolhido; imagens verticais não distorcidas; ocultação presente nos pixels baixados; lote não decodificado todo simultaneamente; desfazer disponível antes de exportar.

### P1 / pacote 3 — documentos e comprovantes

Esforço: médio para miniaturas; alto para coordenadas e alteração de PDF.

- Organizar PDF com miniaturas: selecionar, excluir, girar e mover. Oferecer botões Mover antes/depois e seleção numérica além do gesto de arrastar. Renderizar somente miniaturas necessárias, com cache limitado.
- Melhorar imagens → PDF: A4 ou tamanho da imagem, retrato/paisagem, margem e ajuste sem cortar por padrão. Reordenar fotos de comprovantes antes de exportar.
- Adicionar texto e marcação simples a páginas. Assinatura desenhada é apenas marca visual; não chamar de assinatura digital ou autenticada. Informar quando alterar um PDF assinado pode invalidar assinaturas existentes; não afirmar detecção perfeita.
- Não oferecer apagamento seguro de texto PDF por retângulo sobreposto. Redação segura de PDF exige implementação separada que remova conteúdo, anexos e texto recuperável.

Aceitação: sequência de páginas e rotação corretas; prévia/exportação consistentes em páginas com CropBox e rotações; PDFs com senha ou recursos não suportados recebem explicação; preservar texto vetorial quando a operação não exigir rasterização. Não disponibilizar compressão genérica de PDF nesta entrega.

### P2 / pacote 4 — edição rápida de vídeo e áudio

Esforço: alto.

- Salvar um frame do vídeo em JPG/PNG com seek concluído antes da captura. Mostrar o instante e chamar a captura de aproximada até existir seleção por PTS homologada.
- Presets de enquadramento: vertical 9:16, quadrado 1:1, horizontal 16:9. Oferecer Preencher (recorta) e Encaixar (adiciona fundo), com ponto focal e prévia. Não alterar proporção por esticamento.
- Girar/espelhar vídeo; volume e fades curtos de áudio. Reusar a conversão existente, validar suporte do motor e sincronismo; nenhuma função pode fingir sucesso apenas mudando nome/extensão.
- Waveform simplificada produzida por análise incremental e limitada; início/fim numéricos continuam disponíveis. Sem decodificar áudio longo inteiro só para a prévia.
- Corte + enquadramento + áudio + conversão em uma execução final. GIF continua com perfil próprio e sem áudio.

Aceitação: fixtures com rotação, áudio presente/ausente, VFR e codec incompatível; reprodução do resultado completo curto; sincronismo comparado; cancelamento libera recursos; teste de captura sem frame preto durante seek.

### P2 / pacote 5 — utilidades complementares

Esforço: médio, exceto parsers/arquivos compactados em alto.

- Renomear lotes com prefixo, numeração e prévia; preservar extensões e evitar colisões; baixar em ZIP dentro dos limites existentes.
- Extrair apenas itens escolhidos do ZIP; validar bytes reais expandidos, nomes e número de entradas.
- Criar QR estático de texto/link localmente; sem rastreadores e sem serviço externo de QR.
- Ajustes de texto: espaços/quebras de linha/maiúsculas e exportação TXT. Não transformar isso em editor Office.

## Expansão futura

V1.5 para criadores: marca d'água em lote, capas extraídas de vídeo, receitas reutilizáveis de configurações (sem persistir arquivos), montagem de áudios e vídeos curtos, exportação de versões por proporção, lotes de mídia sequenciais. Presets centralizados e datados; rótulo Plataforma não promete aceitação eterna por redes sociais.

V2 local experimental: OCR em fotos/documentos e remoção de fundo com modelos locais, somente após medir download, memória, tempo e qualidade em aparelhos reais; perspectiva manual de documento; otimização AVIF; anotação/legendas manuais. Separar ferramentas experimentais da lista principal.

V2 opcional com infraestrutura futura: conversão Office com fidelidade limitada, codecs fora do suporte local, documentos grandes e OCR pesado. Depende de nova decisão de custo e privacidade; não implementar agora. Não prometer serviço externo ilimitado e gratuito.

## Arquitetura incremental

Manter components/studios, src/engines, src/lib e src/config. Introduzir somente abstrações usadas: catálogo de ações em src/config/tool-actions.ts; adaptador de compartilhamento em src/lib/share.ts; componentes reutilizáveis para resultado, seleção de páginas e coordenadas de crop. Não criar uma pasta por botão nem framework universal de plugins.

Separar parâmetros de edição do arquivo original e do artefato final. Componentes não executam comandos nem reimplementam encoders. Cada motor recebe opções validadas, AbortSignal e progresso; retorna artefatos reais ou erro estruturado. Operações de canvas usam coordenadas normalizadas e compõem transformações antes de exportar. Trabalho pesado vai para worker quando suportado; manter filas limitadas e liberar recursos explicitamente.

## Verificação e promoção

Cada pacote tem um commit funcional e relatório com testes, limitações e dispositivos efetivamente usados. Testar Chromium/Firefox/WebKit automatizados quando disponíveis; Safari de iPhone e Chrome Android reais precisam de homologação separada. Emulador de viewport não comprova memória móvel.

Fixtures: JPG com orientação/alpha, foto grande, lote com arquivo corrompido, PDF misto de orientações, captura com região marcada, vídeo vertical/rotacionado/VFR, áudio mono/estéreo, ZIP com caminhos perigosos. Não versionar arquivos pessoais nem centenas de MB de fixtures.

Executar testes pertinentes, pnpm typecheck, pnpm lint e pnpm build; medir carregamento inicial antes/depois para garantir que motores novos não vazem para a home. Rever basePath /teste1/file360. Testes reais incluem baixar/reabrir saída, tamanho/assinatura/dimensões/ordem, cancelar e reprocessar. Reportar testes indisponíveis como pendentes.

## Configuração do Sol

Médio é a recomendação padrão de trabalho para pacotes bem especificados. Alto para mídia, concorrência/cancelamento, OPFS, segurança de arquivos, coordenadas PDF e bugs difíceis. Leve para textos, pequenos ajustes visuais, catálogo/presets já definidos e documentação. Essa distribuição é recomendação de engenharia, não garantia de qualidade ou de economia. Fonte do modelo: https://developers.openai.com/api/docs/models/gpt-5.6-sol .

## PROMPT DE IMPLEMENTAÇÃO — GPT-5.6 SOL

Você implementará a expansão do File360, ferramenta web gratuita de processamento local de arquivos para usuários comuns e criadores, sem instalação. Repositório GitHub Alusionbr/teste1; projeto file360/. Leia AGENTS.md aplicável e confira branch, estado de trabalho e implementação atual antes de editar. Não altere aplicativos irmãos.

Use este documento EXPANSAO-MOBILE-SOL.md como especificação. O escopo da execução inicial é exclusivamente P0/pacote 1: confiabilidade dos recursos de mídia existentes, catálogo de ações, compartilhamento detectado por capacidade, renomear resultado e Ajustar novamente preservando original/opções na sessão. Os demais pacotes são backlog e não devem ser implementados nessa execução. O planejamento antigo de backend não autoriza adicionar servidores agora.

Stack: Next.js com exportação estática, React, TypeScript; engines existentes Mediabunny, gifenc, pdf-lib/PDF.js, imagens e ZIP. Sem login, banco, upload, billing, tracking ou API paga. Preserve layout e tokens existentes, pt-BR, teclado, foco, touch e largura mínima de 360 px. Carregue dependências pesadas somente quando necessárias.

Ordem: (1) localizar fluxos em src/engines/media.ts, src/lib/opfs.ts, components/ResultPanel.tsx, components/File360App.tsx e components/studios; (2) confirmar e corrigir falhas de fallback, cleanup e cancelamento descritas neste plano com testes direcionados; (3) implementar catálogo central sem duplicar motores; (4) implementar compartilhar/renomear/ajustar novamente; (5) validar fluxos e documentação. Não aumentar limites de mídia sem evidência nova.

Criar src/config/tool-actions.ts e src/lib/share.ts se ainda inexistentes, e testes úteis para validação/roteamento/lifecycle. Reaproveitar demais arquivos; adicionar componentes apenas quando houver responsabilidade clara. Não implementar funcionalidades fictícias ou mockar o motor para declarar sucesso.

Concluir somente após testes pertinentes, typecheck, lint, build e revisão do diff. Verificar conversão real curta, cancelamento, fallback sem OPFS, falha de quota e reprocessamento do mesmo arquivo; confirmar download e compartilhar quando o dispositivo suportar. Documentar exatamente quais navegadores/dispositivos foram usados e quais testes ficaram pendentes. Atualizar README e este plano com estado de entrega, sem confundir funcionalidades planejadas com publicadas. Entregar resumo de mudanças, evidências e riscos remanescentes. Uma rodada futura recebe o próximo pacote explicitamente.

Fontes de capacidades: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share ; https://pdf-lib.js.org/ . Compatibilidade precisa ser detectada em execução.

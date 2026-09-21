# File360 — plano de melhorias após o P0

Revisão de produto e engenharia em 21/09/2026. Este plano considera o File360 publicado no commit `f360d9f` e o pacote de imagens P1 que está parcialmente implementado no diretório de trabalho. O projeto continua totalmente local, sem login, banco, upload ou servidor de processamento.

## Diagnóstico atual

O núcleo publicado já resolve imagens, PDF, vídeo, áudio, GIF, ZIP e GZIP. O principal risco agora é ampliar a lista de ferramentas sem terminar a experiência, a validação e a compatibilidade móvel das funções existentes.

O pacote de imagens em desenvolvimento já contém compressão por tamanho desejado, dimensões numéricas, recorte, ocultação e montagem. Os testes unitários, TypeScript e build passam, mas o lint falha no ciclo de vida da URL de prévia. A prévia ainda usa a imagem original e não representa todas as transformações finais. Recorte e ocultação também precisam ser verificados contra a área realmente visível da imagem, não apenas contra o contêiner HTML.

Decisão: nenhuma nova família de ferramentas deve ser publicada antes de concluir o Gate 0 abaixo.

## Prioridades

| Ordem | Pacote | Valor principal | Esforço Sol | Condição para publicar |
|---|---|---|---|---|
| Gate 0 | Concluir editor de imagens | Evitar publicar edição inconsistente | Alto | Todos os gates e teste real móvel/desktop |
| P1-A | Descoberta por intenção | Usuário encontra a tarefa sem conhecer formato | Médio | Busca acessível e catálogo único |
| P1-B | PDF para comprovantes | Necessidade comum em celular | Alto | Miniaturas, ordem e exportação consistentes |
| P2-A | Vídeo para redes sociais | Alto valor para criadores | Alto | Pipeline único e sincronismo homologado |
| P2-B | Áudio rápido | Corte, volume e fades sem instalação | Alto | Waveform limitada e saída reproduzível |
| P3 | Utilidades locais | Amplia cobertura com baixo custo | Médio | Segurança e limites por ferramenta |

## Gate 0 — concluir o pacote de imagens

### Correções obrigatórias

1. Remover o `setState` síncrono do efeito da URL de prévia. Usar uma URL derivada e revogá-la somente quando o arquivo mudar ou o componente desmontar.
2. Criar uma única transformação geométrica, usada pela prévia e pela exportação. A prévia deve refletir orientação EXIF, rotação, espelhamento, recorte, fundo e ocultações.
3. Calcular gestos usando os limites reais da imagem renderizada. Faixas vazias de `object-fit: contain` não podem alterar coordenadas.
4. Impedir distorção acidental. Com proporção travada, largura e altura seguem o recorte e a rotação. Com proporção livre, explicar que a imagem será deformada.
5. Evitar ampliação por padrão. Permitir upscale somente por escolha explícita e informar dimensões originais e finais.
6. Melhorar a compressão por alvo: testar qualidade de forma monotônica dentro de cada patamar de dimensão, conservar o menor resultado observado e declarar quando o alvo não for atingido. Continuar com no máximo oito codificações totais e três patamares.
7. Ocultação: exportar pixels opacos achatados, remover metadados, oferecer desfazer e limpar tudo. Não chamar desfoque de proteção.
8. Montagem: decodificação sequencial, ordem visível, sem deformação, fundo configurável, máximo de 10 imagens, 12 MP e 8192 px.
9. Tratar cancelamento durante codificação e montagem sem converter cancelamento em erro por arquivo.

### Verificação

- JPG com EXIF rotacionado, PNG transparente, imagem vertical, imagem pequena, foto próxima de 24 MP e arquivo corrompido.
- Resultado abaixo de 200 KB, 500 KB e 1 MB quando tecnicamente alcançável; quando não, mostrar os bytes do menor resultado.
- Comparar visualmente prévia e download para recorte, rotação e ocultação.
- Reabrir o arquivo baixado e verificar assinatura, dimensões e pixels ocultos.
- Testar mouse, toque e teclado em 360 px, desktop Chromium e pelo menos um aparelho real iPhone/Safari ou Android/Chrome.
- Gates: testes, TypeScript, ESLint, build estático, `git diff --check` e ausência de regressão nas rotas existentes.

### Arquivos principais

- `components/studios/ImageStudio.tsx`
- `src/engines/images.ts`
- `src/lib/image-tools.ts`
- `src/config/tool-actions.ts`
- `app/globals.css`

## P1-A — encontrar a ferramenta pela intenção

Adicionar uma busca local curta acima da seleção de categorias. Ela consulta `name`, `synonyms`, categoria e formatos do catálogo central. Exemplos: “foto menor”, “tirar som”, “juntar comprovantes”, “vídeo para gif”.

Regras:

- mostrar no máximo seis resultados ordenados por correspondência;
- permitir teclado, toque e leitor de tela;
- selecionar uma ação apenas configura o estúdio existente;
- não criar uma página ou componente duplicado por sinônimo;
- esconder ações incompatíveis depois que há arquivo selecionado;
- oferecer recentes apenas em memória da sessão, sem persistir nomes ou arquivos;
- nenhuma dependência de busca externa.

Aceitação: o usuário chega à configuração correta com uma busca e um clique; zero biblioteca pesada é carregada na home; catálogo continua sendo a única fonte das rotas SEO.

Arquivos prováveis: `components/File360App.tsx`, novo componente pequeno `components/ActionSearch.tsx`, `src/config/tool-actions.ts` e testes de ranking puros.

## P1-B — PDF e comprovantes

1. Organizador com miniaturas sob demanda, seleção, excluir, girar e mover antes/depois.
2. Imagens para PDF com A4 ou tamanho da imagem, retrato/paisagem, margem e encaixe sem corte como padrão.
3. Reordenar fotografias antes da exportação e mostrar a ordem final.
4. Adicionar texto e marcação visual simples. Rotular assinatura desenhada como marca visual, nunca como assinatura digital.
5. Avisar sobre PDFs protegidos, formulários e assinaturas que podem perder comportamento.

Não incluir nesta fase: compressão genérica, senha, redação segura ou conversão Office.

Aceitação: ordem, rotação, CropBox e dimensões são verificadas em corpus de PDFs mistos; páginas não visíveis não permanecem renderizadas indefinidamente; operações que não precisam rasterizar preservam texto vetorial.

## P2-A — vídeo para criadores

Implementar como opções do pipeline atual, em uma única exportação:

- capturar frame em JPG/PNG após seek concluído;
- enquadramentos 9:16, 1:1, 4:5 e 16:9;
- modos Preencher e Encaixar, com fundo e ponto focal;
- girar e espelhar;
- presets centralizados para vertical, feed e horizontal, sem espalhar limites de plataformas no código;
- exportar versões múltiplas somente em fila sequencial;
- compressão por tamanho desejado apenas depois de medir bitrate e integridade do resultado.

Presets devem conter `id`, `version`, `reviewedAt`, proporção, dimensões, FPS, container e codecs. Marcas como TikTok ou Instagram só entram depois de revisar fontes oficiais na data da publicação.

Aceitação: fixtures CFR, VFR, rotação, áudio ausente e codec incompatível; sincronismo de áudio/vídeo dentro da tolerância definida; nenhum frame preto na captura; cancelamento libera recursos.

## P2-B — áudio rápido

- waveform real simplificada, criada incrementalmente e com quantidade limitada de pontos;
- corte por início/fim numérico continua como fonte de verdade;
- volume, fade in e fade out curtos;
- estéreo para mono e sample rate somente quando o encoder suportar;
- dividir em trechos e juntar poucos áudios em fila sequencial;
- mensagens diferentes para codec incompatível, falta de memória e arquivo corrompido.

Não decodificar áudio longo inteiro apenas para desenhar a waveform. Não prometer precisão de amostra para MP3/AAC.

## P3 — utilidades de alto uso e baixo custo

1. Renomear lotes com prefixo, sequência, prévia e proteção contra colisões.
2. Escolher itens antes de extrair ZIP, mantendo limites contra zip bombs e caminhos perigosos.
3. QR estático local para texto e links, sem rastreamento.
4. Limpeza de texto e exportação TXT: espaços, linhas vazias, maiúsculas/minúsculas.
5. Favicon ICO multirresolução somente com encoder dedicado e testes de assinatura.

SVG, AVIF de saída, TIFF, 7Z e RAR continuam adiados até justificar bundle, compatibilidade e manutenção.

## Melhorias transversais

### Desempenho

- manter a home sem motores pesados;
- registrar tamanho dos chunks da home e de cada estúdio no CI;
- processar lotes sequencialmente e liberar `ImageBitmap`, canvas, URLs e arquivos OPFS;
- mover loops pesados para worker apenas depois de medir bloqueio real da interface;
- não adicionar Service Worker enquanto não houver um caso de cache/offline mensurável.

### Compatibilidade móvel

Criar uma matriz de homologação versionada com aparelho, sistema, navegador, arquivo, duração, pico aproximado de memória, resultado e falha. Viewport emulado não conta como teste de memória ou codecs.

Perfis sugeridos:

- básico: 100 MB/5 min para mídia;
- ampliado: apenas quando OPFS e quota forem confirmados;
- imagem: limites atuais até existir evidência real para mudar;
- modo econômico opcional futuro para aparelhos com pouca memória.

### Segurança e privacidade

- validar assinatura além do MIME quando houver parser sensível;
- nunca inserir SVG/HTML de usuário no DOM;
- preservar limites de pixels, bytes, entradas e saída expandida;
- nenhuma telemetria com nome, conteúdo, thumbnail, hash ou URL do arquivo;
- Supabase não melhora o processamento local nesta fase. Só reavaliar para métricas agregadas, flags ou backend temporário depois de existir necessidade mensurável.

### SEO e monetização

- publicar página SEO somente para ferramenta funcional e testada;
- gerar páginas pelo catálogo, com canonical e sitemap do deployment;
- não criar centenas de combinações vazias;
- reservar `AdSlot` somente fora do editor e do download, sem carregar SDK de anúncios agora;
- medir Core Web Vitals antes de ativar publicidade.

## Sequência de execução recomendada

1. Sol alto: concluir Gate 0 e corrigir todos os gates.
2. Astra: revisão de coordenadas, memória, privacidade e UX; homologação em navegador.
3. Sol médio: P1-A busca por intenção e testes de ranking.
4. Sol alto: P1-B PDF/comprovantes.
5. Astra: decisão de presets e limites após testes reais.
6. Sol alto: P2-A e P2-B em pacotes separados.
7. Sol médio: utilidades P3, uma por commit funcional.

Cada pacote deve terminar com commit próprio, relatório de validação e atualização do README. Não iniciar o pacote seguinte com lint, testes ou homologação pendentes.

## Critério para considerar o File360 pronto para público geral

- tarefas mais comuns aparecem por intenção e por categoria;
- nenhuma ferramenta exibida é apenas demonstrativa;
- toda saída mostra formato, tamanho real e dimensões/duração;
- cancelamento e reprocessamento preservam a seleção correta;
- falhas indicam uma ação concreta;
- downloads reabrem corretamente;
- experiência funcional em 360 px, teclado e leitor de tela;
- limites exibidos correspondem ao perfil real do navegador;
- home continua rápida e sem carregar os motores antes da necessidade;
- documentação distingue claramente publicado, em homologação e planejado.


import type { FileCategory } from "@/src/types";

export type ToolPage = {
  slug: string;
  title: string;
  heading: string;
  description: string;
  tool: Exclude<FileCategory, "unknown">;
  format?: string;
  operation?: string;
};

export const converterPages: ToolPage[] = [
  { slug: "mov-para-mp4", title: "Converter MOV para MP4 online", heading: "MOV para MP4, direto no navegador.", description: "Converta vídeos MOV para MP4 sem enviar o arquivo para um servidor. Compatibilidade depende dos codecs disponíveis no seu dispositivo.", tool: "media", format: "mp4" },
  { slug: "mp4-para-mp3", title: "Converter MP4 para MP3 online", heading: "Extraia o áudio do MP4.", description: "Transforme um vídeo MP4 em MP3 localmente, com corte preciso por tempo e sem cadastro.", tool: "media", format: "mp3" },
  { slug: "heic-para-jpg", title: "Converter HEIC para JPG online", heading: "HEIC para JPG, sem upload.", description: "Abra fotos de iPhone e gere JPG compatível. O decoder HEIC só é carregado quando necessário.", tool: "image", format: "jpeg" },
  { slug: "jpg-para-webp", title: "Converter JPG para WebP online", heading: "JPG para WebP em lote.", description: "Reduza fotos para a web, ajuste o tamanho máximo e processe até 100 imagens no próprio dispositivo.", tool: "image", format: "webp" },
  { slug: "png-para-jpg", title: "Converter PNG para JPG online", heading: "PNG para JPG em segundos.", description: "Converta PNG para JPG com fundo branco, tamanho e qualidade ajustáveis, sem enviar imagens.", tool: "image", format: "jpeg" },
  { slug: "imagem-para-pdf", title: "Converter imagem para PDF online", heading: "Imagens em um único PDF.", description: "Organize JPG, PNG, WebP ou HEIC e crie um PDF na ordem escolhida.", tool: "pdf", operation: "to-pdf" },
  { slug: "pdf-para-jpg", title: "Converter PDF para JPG online", heading: "PDF para imagens JPG.", description: "Escolha páginas e exporte JPG em alta definição, uma página por vez para controlar a memória.", tool: "pdf", operation: "images", format: "jpeg" },
];

export const actionPages: Record<string, ToolPage[]> = {
  comprimir: [
    { slug: "imagem", title: "Comprimir imagem online", heading: "Imagens menores, visual preservado.", description: "Ajuste tamanho e qualidade e processe lotes localmente.", tool: "image", operation: "compress", format: "webp" },
    { slug: "video", title: "Comprimir vídeo online", heading: "Comprima vídeo no dispositivo.", description: "Reduza resolução e qualidade com os codecs disponíveis no navegador.", tool: "media", operation: "compress", format: "mp4" },
  ],
  cortar: [
    { slug: "video", title: "Cortar vídeo online", heading: "Corte vídeo por tempo.", description: "Defina início e fim e gere um novo vídeo localmente.", tool: "media", operation: "trim", format: "mp4" },
    { slug: "audio", title: "Cortar áudio online", heading: "Corte áudio com precisão.", description: "Escolha o trecho, o formato de saída e processe sem upload.", tool: "media", operation: "trim", format: "mp3" },
  ],
};

export function findToolPage(pages: ToolPage[], slug: string) {
  return pages.find((page) => page.slug === slug);
}


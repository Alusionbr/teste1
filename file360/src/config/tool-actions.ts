import type { FileCategory } from "@/src/types";

export type ToolActionConfig = {
  format?: string;
  operation?: string;
  removeAudio?: boolean;
};

export type ToolActionAvailability = {
  minFiles?: number;
  maxFiles?: number;
  requires?: "image" | "pdf" | "video" | "audio" | "archive";
};

export type ToolActionRoute = {
  group: "converter" | "comprimir" | "cortar";
  slug: string;
  title: string;
  heading: string;
  description: string;
};

export type ToolAction = {
  id: string;
  name: string;
  synonyms: string[];
  category: Exclude<FileCategory, "unknown">;
  inputTypes: string[];
  initialConfig: ToolActionConfig;
  availability: ToolActionAvailability;
  route?: ToolActionRoute;
  featured?: boolean;
};

export const TOOL_ACTIONS: readonly ToolAction[] = [
  {
    id: "reduce-image",
    name: "Reduzir tamanho",
    synonyms: ["comprimir foto", "diminuir imagem", "imagem menor"],
    category: "image",
    inputTypes: ["image/*", ".heic", ".heif"],
    initialConfig: { format: "webp", operation: "compress" },
    availability: { minFiles: 1, requires: "image" },
    featured: true,
    route: {
      group: "comprimir",
      slug: "imagem",
      title: "Comprimir imagem online",
      heading: "Imagens menores, visual preservado.",
      description: "Ajuste tamanho e qualidade e processe lotes localmente.",
    },
  },
  {
    id: "images-to-pdf",
    name: "Juntar em PDF",
    synonyms: ["fotos em pdf", "criar pdf", "unir imagens"],
    category: "pdf",
    inputTypes: ["image/*", ".heic", ".heif"],
    initialConfig: { operation: "to-pdf" },
    availability: { minFiles: 1, requires: "image" },
    featured: true,
    route: {
      group: "converter",
      slug: "imagem-para-pdf",
      title: "Converter imagem para PDF online",
      heading: "Imagens em um único PDF.",
      description: "Organize JPG, PNG, WebP ou HEIC e crie um PDF na ordem escolhida.",
    },
  },
  {
    id: "remove-video-audio",
    name: "Tirar o som",
    synonyms: ["remover áudio", "vídeo sem som", "silenciar vídeo"],
    category: "media",
    inputTypes: ["video/*", ".mkv", ".mov", ".m4v", ".avi"],
    initialConfig: { format: "mp4", operation: "remove-audio", removeAudio: true },
    availability: { minFiles: 1, maxFiles: 1, requires: "video" },
    featured: true,
  },
  {
    id: "video-to-gif",
    name: "Criar GIF",
    synonyms: ["vídeo para gif", "gif animado", "fazer gif"],
    category: "media",
    inputTypes: ["video/*", ".mkv", ".mov", ".m4v", ".avi"],
    initialConfig: { format: "gif", operation: "gif" },
    availability: { minFiles: 1, maxFiles: 1, requires: "video" },
    featured: true,
    route: {
      group: "converter",
      slug: "video-para-gif",
      title: "Converter vídeo para GIF online",
      heading: "Vídeo para GIF, sem upload.",
      description: "Escolha um trecho curto, ajuste tamanho, FPS e cores e crie um GIF animado no navegador.",
    },
  },
  {
    id: "mov-to-mp4",
    name: "Converter para MP4",
    synonyms: ["mov para mp4", "vídeo compatível"],
    category: "media",
    inputTypes: ["video/*", ".mov"],
    initialConfig: { format: "mp4" },
    availability: { minFiles: 1, maxFiles: 1, requires: "video" },
    route: {
      group: "converter", slug: "mov-para-mp4", title: "Converter MOV para MP4 online",
      heading: "MOV para MP4, direto no navegador.",
      description: "Converta vídeos MOV para MP4 sem enviar o arquivo para um servidor. Compatibilidade depende dos codecs disponíveis no seu dispositivo.",
    },
  },
  {
    id: "video-to-mp3",
    name: "Extrair áudio",
    synonyms: ["mp4 para mp3", "tirar áudio", "salvar som"],
    category: "media",
    inputTypes: ["video/*"],
    initialConfig: { format: "mp3" },
    availability: { minFiles: 1, maxFiles: 1, requires: "video" },
    route: {
      group: "converter", slug: "mp4-para-mp3", title: "Converter MP4 para MP3 online",
      heading: "Extraia o áudio do MP4.", description: "Transforme um vídeo MP4 em MP3 localmente, com corte preciso por tempo e sem cadastro.",
    },
  },
  {
    id: "heic-to-jpg",
    name: "HEIC para JPG",
    synonyms: ["foto de iphone", "converter heic"],
    category: "image",
    inputTypes: [".heic", ".heif"],
    initialConfig: { format: "jpeg" },
    availability: { minFiles: 1, requires: "image" },
    route: {
      group: "converter", slug: "heic-para-jpg", title: "Converter HEIC para JPG online",
      heading: "HEIC para JPG, sem upload.", description: "Abra fotos de iPhone e gere JPG compatível. O decoder HEIC só é carregado quando necessário.",
    },
  },
  {
    id: "jpg-to-webp",
    name: "JPG para WebP",
    synonyms: ["converter jpg", "imagem para webp"],
    category: "image",
    inputTypes: ["image/jpeg", ".jpg", ".jpeg"],
    initialConfig: { format: "webp" },
    availability: { minFiles: 1, requires: "image" },
    route: {
      group: "converter", slug: "jpg-para-webp", title: "Converter JPG para WebP online",
      heading: "JPG para WebP em lote.", description: "Reduza fotos para a web, ajuste o tamanho máximo e processe até 100 imagens no próprio dispositivo.",
    },
  },
  {
    id: "png-to-jpg",
    name: "PNG para JPG",
    synonyms: ["converter png", "imagem para jpg"],
    category: "image",
    inputTypes: ["image/png", ".png"],
    initialConfig: { format: "jpeg" },
    availability: { minFiles: 1, requires: "image" },
    route: {
      group: "converter", slug: "png-para-jpg", title: "Converter PNG para JPG online",
      heading: "PNG para JPG em segundos.", description: "Converta PNG para JPG com fundo branco, tamanho e qualidade ajustáveis, sem enviar imagens.",
    },
  },
  {
    id: "pdf-to-jpg",
    name: "PDF para imagens",
    synonyms: ["pdf para jpg", "extrair páginas"],
    category: "pdf",
    inputTypes: ["application/pdf", ".pdf"],
    initialConfig: { operation: "images", format: "jpeg" },
    availability: { minFiles: 1, maxFiles: 1, requires: "pdf" },
    route: {
      group: "converter", slug: "pdf-para-jpg", title: "Converter PDF para JPG online",
      heading: "PDF para imagens JPG.", description: "Escolha páginas e exporte JPG em alta definição, uma página por vez para controlar a memória.",
    },
  },
  {
    id: "compress-video",
    name: "Reduzir vídeo",
    synonyms: ["comprimir vídeo", "vídeo menor"],
    category: "media",
    inputTypes: ["video/*"],
    initialConfig: { operation: "compress", format: "mp4" },
    availability: { minFiles: 1, maxFiles: 1, requires: "video" },
    route: {
      group: "comprimir", slug: "video", title: "Comprimir vídeo online",
      heading: "Comprima vídeo no dispositivo.", description: "Reduza resolução e qualidade com os codecs disponíveis no navegador.",
    },
  },
  {
    id: "trim-video",
    name: "Cortar vídeo",
    synonyms: ["aparar vídeo", "recortar duração"],
    category: "media",
    inputTypes: ["video/*"],
    initialConfig: { operation: "trim", format: "mp4" },
    availability: { minFiles: 1, maxFiles: 1, requires: "video" },
    route: {
      group: "cortar", slug: "video", title: "Cortar vídeo online",
      heading: "Corte vídeo por tempo.", description: "Defina início e fim e gere um novo vídeo localmente.",
    },
  },
  {
    id: "trim-audio",
    name: "Cortar áudio",
    synonyms: ["aparar áudio", "recortar som"],
    category: "media",
    inputTypes: ["audio/*"],
    initialConfig: { operation: "trim", format: "mp3" },
    availability: { minFiles: 1, maxFiles: 1, requires: "audio" },
    route: {
      group: "cortar", slug: "audio", title: "Cortar áudio online",
      heading: "Corte áudio com precisão.", description: "Escolha o trecho, o formato de saída e processe sem upload.",
    },
  },
] as const;

function matchesRequirement(file: Pick<File, "name" | "type">, requirement: NonNullable<ToolActionAvailability["requires"]>): boolean {
  if (requirement === "image") return file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
  if (requirement === "pdf") return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (requirement === "video") return file.type.startsWith("video/") || /\.(mkv|mov|m4v|avi|mp4|webm|ogv)$/i.test(file.name);
  if (requirement === "audio") return file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|flac|ogg|opus)$/i.test(file.name);
  return /\.(zip|gz|gzip)$/i.test(file.name);
}

export function isToolActionAvailable(action: ToolAction, files: readonly Pick<File, "name" | "type">[]): boolean {
  const { minFiles = 0, maxFiles, requires } = action.availability;
  if (files.length < minFiles || (maxFiles !== undefined && files.length > maxFiles)) return false;
  return !requires || files.every((file) => matchesRequirement(file, requires));
}

export function findToolAction(id: string | undefined): ToolAction | undefined {
  return TOOL_ACTIONS.find((action) => action.id === id);
}


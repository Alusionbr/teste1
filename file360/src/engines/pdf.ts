import { degrees, PDFDocument } from "pdf-lib";
import { artifactFromBlob } from "@/src/lib/download";
import { baseName, LIMITS, safeFilename } from "@/src/lib/files";
import { imageForPdf } from "@/src/engines/images";
import type { Artifact, ProgressUpdate } from "@/src/types";

async function loadPdf(file: File): Promise<PDFDocument> {
  if (file.size > LIMITS.pdfBytes) throw new Error("O PDF excede o limite local de 25 MB.");
  try {
    const document = await PDFDocument.load(await file.arrayBuffer());
    if (document.getPageCount() > LIMITS.pdfPages) throw new Error("O PDF excede o limite local de 100 páginas.");
    return document;
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(error.message)) {
      throw new Error("PDF protegido por senha ainda não pode ser processado localmente.");
    }
    throw error;
  }
}

export async function inspectPdf(file: File): Promise<{ pages: number }> {
  const document = await loadPdf(file);
  return { pages: document.getPageCount() };
}

export async function mergePdfs(files: File[], onProgress?: (update: ProgressUpdate) => void): Promise<Artifact> {
  if (files.reduce((sum, file) => sum + file.size, 0) > LIMITS.pdfBytes) {
    throw new Error("Os PDFs somados excedem o limite local de 25 MB.");
  }
  const output = await PDFDocument.create();
  for (let index = 0; index < files.length; index += 1) {
    const source = await loadPdf(files[index]);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
    onProgress?.({ value: (index + 1) / files.length, label: `Adicionando ${files[index].name}` });
  }
  const bytes = await output.save({ useObjectStreams: true });
  return artifactFromBlob("file360-unido.pdf", new Blob([bytes as BlobPart], { type: "application/pdf" }), `${output.getPageCount()} páginas`);
}

export async function extractPdfPages(file: File, pageIndexes: number[], rotate = 0): Promise<Artifact> {
  const source = await loadPdf(file);
  if (!pageIndexes.length) throw new Error("Selecione pelo menos uma página.");
  if (pageIndexes.some((index) => index < 0 || index >= source.getPageCount())) throw new Error("A seleção contém uma página inexistente.");
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, pageIndexes);
  pages.forEach((page) => {
    if (rotate) page.setRotation(degrees((page.getRotation().angle + rotate) % 360));
    output.addPage(page);
  });
  const bytes = await output.save({ useObjectStreams: true });
  const name = `${safeFilename(baseName(file.name))}-paginas.pdf`;
  return artifactFromBlob(name, new Blob([bytes as BlobPart], { type: "application/pdf" }), `${pages.length} páginas`);
}

export async function splitPdfPages(file: File, pageIndexes: number[]): Promise<Artifact[]> {
  const source = await loadPdf(file);
  const result: Artifact[] = [];
  for (const pageIndex of pageIndexes) {
    if (pageIndex < 0 || pageIndex >= source.getPageCount()) throw new Error("A seleção contém uma página inexistente.");
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [pageIndex]);
    output.addPage(page);
    const bytes = await output.save({ useObjectStreams: true });
    result.push(
      artifactFromBlob(
        `${safeFilename(baseName(file.name))}-pagina-${pageIndex + 1}.pdf`,
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `Página ${pageIndex + 1}`,
      ),
    );
  }
  return result;
}

export async function imagesToPdf(files: File[], onProgress?: (update: ProgressUpdate) => void): Promise<Artifact> {
  if (files.length > LIMITS.pdfPages) throw new Error("Use no máximo 100 imagens por PDF.");
  if (files.reduce((sum, file) => sum + file.size, 0) > LIMITS.pdfBytes) {
    throw new Error("As imagens somadas excedem o limite local de 25 MB.");
  }
  const document = await PDFDocument.create();
  for (let index = 0; index < files.length; index += 1) {
    const input = await imageForPdf(files[index]);
    const image = input.mime === "image/png" ? await document.embedPng(input.bytes) : await document.embedJpg(input.bytes);
    const maxWidth = 595.28;
    const maxHeight = 841.89;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    const page = document.addPage([Math.max(width, 1), Math.max(height, 1)]);
    page.drawImage(image, { x: 0, y: 0, width, height });
    onProgress?.({ value: (index + 1) / files.length, label: `Adicionando ${files[index].name}` });
  }
  const bytes = await document.save({ useObjectStreams: true });
  return artifactFromBlob("file360-imagens.pdf", new Blob([bytes as BlobPart], { type: "application/pdf" }), `${files.length} páginas`);
}

export async function pdfToImages(
  file: File,
  pageIndexes: number[],
  format: "jpeg" | "png",
  dpi: number,
  signal: AbortSignal,
  onProgress?: (update: ProgressUpdate) => void,
): Promise<Artifact[]> {
  if (pageIndexes.length > 30) throw new Error("Exporte no máximo 30 páginas por vez.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdfDocument = await loadingTask.promise;
  try {
    const artifacts: Artifact[] = [];
    for (let index = 0; index < pageIndexes.length; index += 1) {
      if (signal.aborted) throw new DOMException("Processamento cancelado.", "AbortError");
      const pageNumber = pageIndexes[index] + 1;
      if (pageNumber < 1 || pageNumber > pdfDocument.numPages) throw new Error(`A página ${pageNumber} não existe.`);
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: dpi / 72 });
      if (viewport.width * viewport.height > 8_000_000) throw new Error(`A página ${pageNumber} ultrapassa 8 megapixels nessa resolução.`);
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: format === "png" });
      if (!context) throw new Error("Canvas 2D indisponível.");
      if (format === "jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      const renderTask = page.render({ canvas, canvasContext: context, viewport });
      if (signal.aborted) renderTask.cancel();
      await renderTask.promise;
      const mime = format === "jpeg" ? "image/jpeg" : "image/png";
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value: Blob | null) => (value ? resolve(value) : reject(new Error("Falha ao exportar página."))), mime, 0.9),
      );
      artifacts.push(
        artifactFromBlob(
          `${safeFilename(baseName(file.name))}-pagina-${pageNumber}.${format === "jpeg" ? "jpg" : "png"}`,
          blob,
          `${canvas.width} × ${canvas.height}`,
        ),
      );
      page.cleanup();
      canvas.width = 1;
      canvas.height = 1;
      onProgress?.({ value: (index + 1) / pageIndexes.length, label: `Exportando página ${pageNumber}` });
    }
    return artifacts;
  } finally {
    await loadingTask.destroy();
  }
}

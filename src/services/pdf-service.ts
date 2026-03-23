import type { LoadedPdf } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

let currentDocument: pdfjsLib.PDFDocumentProxy | null = null;

export async function loadPdf(file: File): Promise<LoadedPdf> {
  const arrayBuffer = await file.arrayBuffer();
  const originalBytes = new Uint8Array(arrayBuffer);

  const doc = await pdfjsLib.getDocument({ data: originalBytes.slice() }).promise;
  currentDocument = doc;

  return {
    pageCount: doc.numPages,
    originalBytes,
  };
}

export async function renderPage(
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<{ width: number; height: number; pageHeight: number }> {
  if (!currentDocument) {
    throw new Error('No PDF loaded');
  }

  // pdf.js pages are 1-indexed
  const page = await currentDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot get canvas 2D context');
  }

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return {
    width: viewport.width,
    height: viewport.height,
    pageHeight: page.getViewport({ scale: 1 }).height,
  };
}

export function getDocument(): pdfjsLib.PDFDocumentProxy | null {
  return currentDocument;
}

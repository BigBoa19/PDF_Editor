import { PDFDocument, rgb, LineCapStyle, StandardFonts } from 'pdf-lib';
import type { Annotation, DrawAnnotation, TextAnnotation, ImageAnnotation } from '../types';

export async function exportPdf(
  originalBytes: Uint8Array,
  annotations: ReadonlyMap<number, ReadonlyArray<Annotation>>,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const [pageIndex, pageAnnotations] of annotations) {
    const page = pages[pageIndex];
    if (!page) continue;

    for (const annotation of pageAnnotations) {
      switch (annotation.type) {
        case 'draw':
          drawStroke(page, annotation);
          break;
        case 'text':
          drawText(page, annotation, helveticaFont);
          break;
        case 'image':
          await drawImage(page, annotation, pdfDoc);
          break;
      }
    }
  }

  return pdfDoc.save();
}

function drawStroke(
  page: ReturnType<PDFDocument['getPages']>[number],
  annotation: DrawAnnotation,
): void {
  const { points, strokeColor, strokeWidth } = annotation;
  if (points.length < 2) return;

  const color = hexToRgb(strokeColor);

  // Draw line segments between consecutive points
  // Points are already in PDF-space (origin bottom-left, Y up)
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];

    page.drawLine({
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      thickness: strokeWidth,
      color,
      lineCap: LineCapStyle.Round,
    });
  }
}

function drawText(
  page: ReturnType<PDFDocument['getPages']>[number],
  annotation: TextAnnotation,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
): void {
  const { x, y, text, fontSize, color } = annotation;
  const pdfColor = hexToRgb(color);

  const lines = text.split('\n');
  const lineHeight = fontSize * 1.2;

  for (let i = 0; i < lines.length; i++) {
    // PDF y goes up, so subtract for each subsequent line
    page.drawText(lines[i], {
      x,
      y: y - i * lineHeight,
      size: fontSize,
      font,
      color: pdfColor,
    });
  }
}

async function drawImage(
  page: ReturnType<PDFDocument['getPages']>[number],
  annotation: ImageAnnotation,
  pdfDoc: PDFDocument,
): Promise<void> {
  const { x, y, width, height, dataUrl } = annotation;

  // Extract base64 data and determine format
  const isPng = dataUrl.startsWith('data:image/png');
  const base64 = dataUrl.split(',')[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const embeddedImage = isPng
    ? await pdfDoc.embedPng(bytes)
    : await pdfDoc.embedJpg(bytes);

  // y is the click point (top of image in screen), but in PDF-space y goes up
  // so we need to draw from y - height (bottom-left corner of image)
  page.drawImage(embeddedImage, {
    x,
    y: y - height,
    width,
    height,
  });
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

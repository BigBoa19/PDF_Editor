import type { Annotation, DrawAnnotation, TextAnnotation, ImageAnnotation } from '../types';
import { pdfToScreen } from '../utils/coordinates';

const imageCache = new Map<string, HTMLImageElement>();

export function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: ReadonlyArray<Annotation>,
  pageHeight: number,
  scale: number,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const annotation of annotations) {
    switch (annotation.type) {
      case 'draw':
        renderDraw(ctx, annotation, pageHeight, scale);
        break;
      case 'text':
        renderText(ctx, annotation, pageHeight, scale);
        break;
      case 'image':
        renderImage(ctx, annotation, pageHeight, scale);
        break;
    }
  }
}

function renderDraw(
  ctx: CanvasRenderingContext2D,
  annotation: DrawAnnotation,
  pageHeight: number,
  scale: number,
): void {
  const { points, strokeColor, strokeWidth } = annotation;
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const first = pdfToScreen(points[0].x, points[0].y, pageHeight, scale);
  ctx.moveTo(first.x, first.y);

  // Quadratic Bezier smoothing between midpoints
  for (let i = 1; i < points.length - 1; i++) {
    const current = pdfToScreen(points[i].x, points[i].y, pageHeight, scale);
    const next = pdfToScreen(points[i + 1].x, points[i + 1].y, pageHeight, scale);
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }

  // Line to the last point
  const last = pdfToScreen(
    points[points.length - 1].x,
    points[points.length - 1].y,
    pageHeight,
    scale,
  );
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function renderText(
  ctx: CanvasRenderingContext2D,
  annotation: TextAnnotation,
  pageHeight: number,
  scale: number,
): void {
  const { x, y, text, fontSize, fontFamily, color } = annotation;
  const screen = pdfToScreen(x, y, pageHeight, scale);
  const scaledFontSize = fontSize * scale;

  ctx.font = `${scaledFontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], screen.x, screen.y + i * scaledFontSize * 1.2);
  }
}

function renderImage(
  ctx: CanvasRenderingContext2D,
  annotation: ImageAnnotation,
  pageHeight: number,
  scale: number,
): void {
  const { x, y, width, height, dataUrl } = annotation;
  const screen = pdfToScreen(x, y, pageHeight, scale);
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  let img = imageCache.get(dataUrl);
  if (img?.complete) {
    ctx.drawImage(img, screen.x, screen.y, scaledWidth, scaledHeight);
    return;
  }

  // Load image asynchronously and re-draw when ready
  img = new Image();
  img.src = dataUrl;
  imageCache.set(dataUrl, img);
  img.onload = () => {
    ctx.drawImage(img!, screen.x, screen.y, scaledWidth, scaledHeight);
  };
}

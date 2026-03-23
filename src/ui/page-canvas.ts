import { createElement } from '../utils/dom';
import { renderPage } from '../services/pdf-service';

export interface PageCanvasElements {
  readonly container: HTMLElement;
  readonly pdfCanvas: HTMLCanvasElement;
  readonly annotationCanvas: HTMLCanvasElement;
  readonly pageIndex: number;
  pageHeight: number;
  scale: number;
}

export function createPageCanvas(pageIndex: number): PageCanvasElements {
  const container = createElement('div', 'page-canvas');
  container.dataset.page = String(pageIndex);

  const pdfCanvas = createElement('canvas', 'page-canvas__pdf');
  const annotationCanvas = createElement('canvas', 'page-canvas__annotation');

  container.appendChild(pdfCanvas);
  container.appendChild(annotationCanvas);

  return {
    container,
    pdfCanvas,
    annotationCanvas,
    pageIndex,
    pageHeight: 0,
    scale: 1,
  };
}

export async function renderPageCanvas(
  page: PageCanvasElements,
  scale: number,
): Promise<void> {
  const { width, height, pageHeight } = await renderPage(page.pageIndex, page.pdfCanvas, scale);

  page.annotationCanvas.width = width;
  page.annotationCanvas.height = height;
  page.pageHeight = pageHeight;
  page.scale = scale;
}

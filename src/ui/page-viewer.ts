import { createElement } from '../utils/dom';
import { createPageCanvas, renderPageCanvas, type PageCanvasElements } from './page-canvas';

const DEFAULT_SCALE = 1.5;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;
const ZOOM_STEP = 0.25;

export interface PageViewer {
  readonly container: HTMLElement;
  readonly pages: PageCanvasElements[];
  scale: number;
}

export function createPageViewer(): PageViewer {
  const container = createElement('div', 'page-viewer');

  const emptyState = createElement('div', 'page-viewer__empty');
  emptyState.innerHTML = `
    <div class="page-viewer__empty-icon">📄</div>
    <div>Open a PDF to get started</div>
  `;
  container.appendChild(emptyState);

  return { container, pages: [], scale: DEFAULT_SCALE };
}

export async function loadPages(viewer: PageViewer, pageCount: number): Promise<void> {
  viewer.container.innerHTML = '';
  viewer.pages.length = 0;
  viewer.scale = DEFAULT_SCALE;

  for (let i = 0; i < pageCount; i++) {
    const page = createPageCanvas(i);
    viewer.pages.push(page);
    viewer.container.appendChild(page.container);
    await renderPageCanvas(page, viewer.scale);
  }
}

export async function zoomIn(viewer: PageViewer): Promise<number> {
  const newScale = Math.min(MAX_SCALE, viewer.scale + ZOOM_STEP);
  if (newScale !== viewer.scale) {
    await rerenderAllPages(viewer, newScale);
  }
  return viewer.scale;
}

export async function zoomOut(viewer: PageViewer): Promise<number> {
  const newScale = Math.max(MIN_SCALE, viewer.scale - ZOOM_STEP);
  if (newScale !== viewer.scale) {
    await rerenderAllPages(viewer, newScale);
  }
  return viewer.scale;
}

export function getZoomPercent(viewer: PageViewer): number {
  // DEFAULT_SCALE of 1.5 = 100% display
  return (viewer.scale / DEFAULT_SCALE) * 100;
}

async function rerenderAllPages(viewer: PageViewer, newScale: number): Promise<void> {
  viewer.scale = newScale;
  for (const page of viewer.pages) {
    await renderPageCanvas(page, newScale);
  }
}

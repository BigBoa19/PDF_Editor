import type { ToolType } from '../types';
import { createElement } from '../utils/dom';

export interface ToolbarCallbacks {
  onOpenFile: (file: File) => void;
  onToolSelect: (tool: ToolType) => void;
  onExport: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function createToolbar(callbacks: ToolbarCallbacks): HTMLElement {
  const toolbar = createElement('div', 'toolbar');

  const title = createElement('span', 'toolbar__title');
  title.textContent = 'PDFLite';
  toolbar.appendChild(title);

  toolbar.appendChild(createDivider());

  // Open button + hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      callbacks.onOpenFile(file);
      fileInput.value = '';
    }
  });

  const openBtn = createButton('Open PDF', () => fileInput.click());
  toolbar.appendChild(fileInput);
  toolbar.appendChild(openBtn);

  toolbar.appendChild(createDivider());

  // Tool buttons
  const selectBtn = createButton('Select', () => callbacks.onToolSelect('select'));
  selectBtn.dataset.tool = 'select';
  selectBtn.disabled = true;

  const drawBtn = createButton('Draw', () => callbacks.onToolSelect('draw'));
  drawBtn.dataset.tool = 'draw';
  drawBtn.disabled = true;

  const textBtn = createButton('Text', () => callbacks.onToolSelect('text'));
  textBtn.dataset.tool = 'text';
  textBtn.disabled = true;

  const imageBtn = createButton('Image', () => callbacks.onToolSelect('image'));
  imageBtn.dataset.tool = 'image';
  imageBtn.disabled = true;

  toolbar.appendChild(selectBtn);
  toolbar.appendChild(drawBtn);
  toolbar.appendChild(textBtn);
  toolbar.appendChild(imageBtn);

  // Spacer
  const spacer = createElement('div', 'toolbar__spacer');
  toolbar.appendChild(spacer);

  // Zoom controls
  const zoomOutBtn = createButton('\u2212', () => callbacks.onZoomOut());
  zoomOutBtn.dataset.action = 'zoom-out';
  zoomOutBtn.disabled = true;
  zoomOutBtn.title = 'Zoom Out';
  toolbar.appendChild(zoomOutBtn);

  const zoomLabel = createElement('span', 'toolbar__zoom-label');
  zoomLabel.dataset.action = 'zoom-label';
  zoomLabel.textContent = '100%';
  toolbar.appendChild(zoomLabel);

  const zoomInBtn = createButton('+', () => callbacks.onZoomIn());
  zoomInBtn.dataset.action = 'zoom-in';
  zoomInBtn.disabled = true;
  zoomInBtn.title = 'Zoom In';
  toolbar.appendChild(zoomInBtn);

  toolbar.appendChild(createDivider());

  // Export button
  const exportBtn = createButton('Export', () => callbacks.onExport());
  exportBtn.dataset.action = 'export';
  exportBtn.disabled = true;
  toolbar.appendChild(exportBtn);

  return toolbar;
}

export function updateToolbarState(
  toolbar: HTMLElement,
  activeTool: ToolType,
  pdfLoaded: boolean,
): void {
  const toolButtons = toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]');
  for (const btn of toolButtons) {
    btn.disabled = !pdfLoaded;
    btn.classList.toggle('toolbar__btn--active', btn.dataset.tool === activeTool);
  }

  const actionButtons = toolbar.querySelectorAll<HTMLButtonElement>('[data-action]');
  for (const btn of actionButtons) {
    btn.disabled = !pdfLoaded;
  }
}

export function updateZoomLabel(toolbar: HTMLElement, zoomPercent: number): void {
  const label = toolbar.querySelector<HTMLSpanElement>('[data-action="zoom-label"]');
  if (label) {
    label.textContent = `${Math.round(zoomPercent)}%`;
  }
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = createElement('button', 'toolbar__btn') as HTMLButtonElement;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function createDivider(): HTMLElement {
  return createElement('div', 'toolbar__divider');
}

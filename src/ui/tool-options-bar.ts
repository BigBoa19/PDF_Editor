import type { ToolType } from '../types';
import { createElement } from '../utils/dom';

export interface ToolOptionsCallbacks {
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onTextColorChange: (color: string) => void;
  onTextFontSizeChange: (size: number) => void;
}

export interface ToolOptionsBar {
  readonly element: HTMLElement;
  readonly drawOptions: HTMLElement;
  readonly textOptions: HTMLElement;
}

export function createToolOptionsBar(callbacks: ToolOptionsCallbacks): ToolOptionsBar {
  const bar = createElement('div', 'tool-options');

  // Draw options group
  const drawOptions = createElement('div', 'tool-options__group');
  drawOptions.dataset.tool = 'draw';

  const colorLabel = createElement('label');
  colorLabel.textContent = 'Color ';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = '#000000';
  colorInput.addEventListener('input', () => {
    callbacks.onStrokeColorChange(colorInput.value);
  });
  colorLabel.appendChild(colorInput);
  drawOptions.appendChild(colorLabel);

  const widthLabel = createElement('label');
  widthLabel.textContent = 'Width ';
  const widthSelect = createElement('select');
  const widths = [
    { label: 'Thin', value: '1' },
    { label: 'Medium', value: '2' },
    { label: 'Thick', value: '4' },
  ];
  for (const w of widths) {
    const option = document.createElement('option');
    option.value = w.value;
    option.textContent = w.label;
    if (w.value === '2') option.selected = true;
    widthSelect.appendChild(option);
  }
  widthSelect.addEventListener('change', () => {
    callbacks.onStrokeWidthChange(Number(widthSelect.value));
  });
  widthLabel.appendChild(widthSelect);
  drawOptions.appendChild(widthLabel);
  bar.appendChild(drawOptions);

  // Text options group
  const textOptions = createElement('div', 'tool-options__group');
  textOptions.dataset.tool = 'text';

  const textColorLabel = createElement('label');
  textColorLabel.textContent = 'Color ';
  const textColorInput = document.createElement('input');
  textColorInput.type = 'color';
  textColorInput.value = '#000000';
  textColorInput.addEventListener('input', () => {
    callbacks.onTextColorChange(textColorInput.value);
  });
  textColorLabel.appendChild(textColorInput);
  textOptions.appendChild(textColorLabel);

  const sizeLabel = createElement('label');
  sizeLabel.textContent = 'Size ';
  const sizeSelect = createElement('select');
  const sizes = [
    { label: '12', value: '12' },
    { label: '16', value: '16' },
    { label: '20', value: '20' },
    { label: '24', value: '24' },
    { label: '32', value: '32' },
  ];
  for (const s of sizes) {
    const option = document.createElement('option');
    option.value = s.value;
    option.textContent = s.label;
    if (s.value === '16') option.selected = true;
    sizeSelect.appendChild(option);
  }
  sizeSelect.addEventListener('change', () => {
    callbacks.onTextFontSizeChange(Number(sizeSelect.value));
  });
  sizeLabel.appendChild(sizeSelect);
  textOptions.appendChild(sizeLabel);
  bar.appendChild(textOptions);

  return { element: bar, drawOptions, textOptions };
}

export function updateToolOptionsVisibility(optionsBar: ToolOptionsBar, activeTool: ToolType): void {
  const hasOptions = activeTool === 'draw' || activeTool === 'text';
  optionsBar.element.classList.toggle('tool-options--visible', hasOptions);
  optionsBar.drawOptions.style.display = activeTool === 'draw' ? 'contents' : 'none';
  optionsBar.textOptions.style.display = activeTool === 'text' ? 'contents' : 'none';
}

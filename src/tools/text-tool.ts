import type { TextAnnotation } from '../types';
import { AnnotationStore } from '../store/annotation-store';
import { screenToPdf } from '../utils/coordinates';

export interface TextToolOptions {
  fontSize: number;
  color: string;
}

export class TextTool {
  private readonly store: AnnotationStore;
  private activeTextarea: HTMLTextAreaElement | null = null;
  private readonly options: TextToolOptions = {
    fontSize: 16,
    color: '#000000',
  };

  constructor(store: AnnotationStore) {
    this.store = store;
  }

  getOptions(): Readonly<TextToolOptions> {
    return this.options;
  }

  setFontSize(size: number): void {
    this.options.fontSize = size;
  }

  setColor(color: string): void {
    this.options.color = color;
  }

  onClick(
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    pageIndex: number,
    pageHeight: number,
    scale: number,
    rerenderPage: () => void,
  ): void {
    // Don't open a new textarea if one is already active
    if (this.activeTextarea) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const pdfPoint = screenToPdf(screenX, screenY, pageHeight, scale);

    const container = canvas.parentElement;
    if (!container) return;

    const textarea = document.createElement('textarea');
    textarea.className = 'text-tool__input';
    textarea.style.left = `${screenX}px`;
    textarea.style.top = `${screenY}px`;
    textarea.style.fontSize = `${this.options.fontSize * scale}px`;
    textarea.style.color = this.options.color;
    textarea.style.fontFamily = 'Helvetica, Arial, sans-serif';

    this.activeTextarea = textarea;
    container.appendChild(textarea);
    textarea.focus();

    const commit = () => {
      const text = textarea.value.trim();
      if (text) {
        const annotation: TextAnnotation = {
          id: crypto.randomUUID(),
          type: 'text',
          pageIndex,
          x: pdfPoint.x,
          y: pdfPoint.y,
          text,
          fontSize: this.options.fontSize,
          fontFamily: 'Helvetica',
          color: this.options.color,
        };
        this.store.add(pageIndex, annotation);
        rerenderPage();
      }
      cleanup();
    };

    const cancel = () => {
      cleanup();
    };

    const cleanup = () => {
      textarea.removeEventListener('blur', commit);
      textarea.removeEventListener('keydown', onKeyDown);
      textarea.remove();
      this.activeTextarea = null;
    };

    const onKeyDown = (ke: KeyboardEvent) => {
      if (ke.key === 'Enter' && !ke.shiftKey) {
        ke.preventDefault();
        commit();
      } else if (ke.key === 'Escape') {
        ke.preventDefault();
        cancel();
      }
    };

    textarea.addEventListener('keydown', onKeyDown);
    textarea.addEventListener('blur', commit);
  }

  hasActiveInput(): boolean {
    return this.activeTextarea !== null;
  }
}

import type { ImageAnnotation } from '../types';
import { AnnotationStore } from '../store/annotation-store';
import { screenToPdf } from '../utils/coordinates';

const MAX_IMAGE_WIDTH_PT = 200;

export class ImageTool {
  private readonly store: AnnotationStore;
  private fileInput: HTMLInputElement | null = null;

  constructor(store: AnnotationStore) {
    this.store = store;
  }

  onClick(
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    pageIndex: number,
    pageHeight: number,
    scale: number,
    rerenderPage: () => void,
  ): void {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const pdfPoint = screenToPdf(screenX, screenY, pageHeight, scale);

    // Prevent multiple file pickers
    if (this.fileInput) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    this.fileInput = input;

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      this.fileInput = null;
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        // Load image to get natural dimensions
        const img = new Image();
        img.onload = () => {
          const aspect = img.naturalHeight / img.naturalWidth;
          const width = Math.min(MAX_IMAGE_WIDTH_PT, img.naturalWidth);
          const height = width * aspect;

          const annotation: ImageAnnotation = {
            id: crypto.randomUUID(),
            type: 'image',
            pageIndex,
            x: pdfPoint.x,
            y: pdfPoint.y,
            width,
            height,
            dataUrl,
          };

          this.store.add(pageIndex, annotation);
          rerenderPage();
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });

    // Also clear reference if user cancels the picker
    input.addEventListener('cancel', () => {
      this.fileInput = null;
    });

    input.click();
  }
}

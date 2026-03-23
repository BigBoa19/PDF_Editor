import type { Annotation, ImageAnnotation, TextAnnotation, DrawAnnotation } from '../types';
import { AnnotationStore } from '../store/annotation-store';
import { pdfToScreen } from '../utils/coordinates';

type SelectableAnnotation = ImageAnnotation | TextAnnotation | DrawAnnotation;

export class SelectTool {
  private readonly store: AnnotationStore;
  private selected: SelectableAnnotation | null = null;
  private overlay: HTMLDivElement | null = null;
  private editing = false;
  private dragState: {
    type: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origWidth: number;
    origHeight: number;
  } | null = null;

  private pageHeight = 0;
  private scale = 1;
  private pageIndex = -1;

  constructor(store: AnnotationStore) {
    this.store = store;
  }

  getSelected(): SelectableAnnotation | null {
    return this.selected;
  }

  trySelect(
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    pageIndex: number,
    pageHeight: number,
    scale: number,
  ): boolean {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const annotations = this.store.getForPage(pageIndex);
    // Check in reverse order (topmost first)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      const bounds = this.getBounds(ann, pageHeight, scale);
      if (!bounds) continue;

      if (
        screenX >= bounds.x &&
        screenX <= bounds.x + bounds.w &&
        screenY >= bounds.y &&
        screenY <= bounds.y + bounds.h
      ) {
        this.select(ann, canvas, pageIndex, pageHeight, scale, bounds);
        return true;
      }
    }

    this.deselect();
    return false;
  }

  hitTest(
    screenX: number,
    screenY: number,
    pageIndex: number,
    pageHeight: number,
    scale: number,
  ): boolean {
    const annotations = this.store.getForPage(pageIndex);
    for (let i = annotations.length - 1; i >= 0; i--) {
      const bounds = this.getBounds(annotations[i], pageHeight, scale);
      if (!bounds) continue;
      if (
        screenX >= bounds.x &&
        screenX <= bounds.x + bounds.w &&
        screenY >= bounds.y &&
        screenY <= bounds.y + bounds.h
      ) {
        return true;
      }
    }
    return false;
  }

  deselect(): void {
    this.selected = null;
    this.overlay?.remove();
    this.overlay = null;
    this.dragState = null;
    this.editing = false;
  }

  isEditing(): boolean {
    return this.editing;
  }

  private getBounds(
    ann: Annotation,
    pageHeight: number,
    scale: number,
  ): { x: number; y: number; w: number; h: number } | null {
    if (ann.type === 'image') {
      const topLeft = pdfToScreen(ann.x, ann.y, pageHeight, scale);
      return { x: topLeft.x, y: topLeft.y, w: ann.width * scale, h: ann.height * scale };
    }

    if (ann.type === 'text') {
      const topLeft = pdfToScreen(ann.x, ann.y, pageHeight, scale);
      const scaledFontSize = ann.fontSize * scale;
      const lines = ann.text.split('\n');
      const lineHeight = scaledFontSize * 1.2;
      const h = lines.length * lineHeight;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let maxWidth = 0;
      if (ctx) {
        ctx.font = `${scaledFontSize}px ${ann.fontFamily}`;
        for (const line of lines) {
          maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
        }
      } else {
        maxWidth = scaledFontSize * ann.text.length * 0.6;
      }

      return { x: topLeft.x, y: topLeft.y, w: maxWidth, h };
    }

    if (ann.type === 'draw') {
      return this.getDrawBounds(ann, pageHeight, scale);
    }

    return null;
  }

  private getDrawBounds(
    ann: DrawAnnotation,
    pageHeight: number,
    scale: number,
  ): { x: number; y: number; w: number; h: number } | null {
    const { points, strokeWidth } = ann;
    if (points.length < 2) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      const screen = pdfToScreen(p.x, p.y, pageHeight, scale);
      minX = Math.min(minX, screen.x);
      minY = Math.min(minY, screen.y);
      maxX = Math.max(maxX, screen.x);
      maxY = Math.max(maxY, screen.y);
    }

    // Pad by stroke width
    const pad = strokeWidth * scale;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;

    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  private select(
    annotation: SelectableAnnotation,
    canvas: HTMLCanvasElement,
    pageIndex: number,
    pageHeight: number,
    scale: number,
    bounds: { x: number; y: number; w: number; h: number },
  ): void {
    this.deselect();
    this.selected = annotation;
    this.pageHeight = pageHeight;
    this.scale = scale;
    this.pageIndex = pageIndex;

    const container = canvas.parentElement;
    if (!container) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'select-handle';
    this.positionOverlay(bounds);

    // Corner resize handle (bottom-right) — only for images
    if (annotation.type === 'image') {
      const handle = document.createElement('div');
      handle.className = 'select-handle__corner';
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.startResize(e);
      });
      this.overlay.appendChild(handle);
    }

    // Move on drag of the overlay body
    this.overlay.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      const target = e.target as HTMLElement;
      if (target.classList.contains('select-handle__corner')) return;
      this.startMove(e);
    });

    // Double-click to edit text
    if (annotation.type === 'text') {
      this.overlay.addEventListener('dblclick', () => {
        if (this.selected?.type === 'text') {
          this.startEditText(this.selected, container);
        }
      });
    }

    // Delete on keydown
    this.overlay.tabIndex = 0;
    this.overlay.addEventListener('keydown', (e) => {
      if (this.editing) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (this.selected) {
          this.store.remove(this.pageIndex, this.selected.id);
          this.deselect();
        }
      }
    });

    container.appendChild(this.overlay);
    this.overlay.focus();
  }

  private startEditText(annotation: TextAnnotation, container: HTMLElement): void {
    if (!this.overlay) return;
    this.editing = true;

    const bounds = this.getBounds(annotation, this.pageHeight, this.scale);
    if (!bounds) return;

    const scaledFontSize = annotation.fontSize * this.scale;

    const textarea = document.createElement('textarea');
    textarea.className = 'text-tool__input';
    textarea.value = annotation.text;
    textarea.style.left = `${bounds.x}px`;
    textarea.style.top = `${bounds.y}px`;
    textarea.style.fontSize = `${scaledFontSize}px`;
    textarea.style.color = annotation.color;
    textarea.style.fontFamily = `${annotation.fontFamily}, Arial, sans-serif`;
    textarea.style.minWidth = `${bounds.w + 20}px`;

    // Hide the select overlay while editing
    this.overlay.style.display = 'none';

    container.appendChild(textarea);
    textarea.focus();
    textarea.selectionStart = textarea.value.length;

    const commit = () => {
      const newText = textarea.value.trim();
      if (newText && newText !== annotation.text) {
        const updated: TextAnnotation = { ...annotation, text: newText };
        this.store.update(this.pageIndex, updated);
        this.selected = updated;
      } else if (!newText) {
        this.store.remove(this.pageIndex, annotation.id);
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
      this.editing = false;
      this.deselect();
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

  private positionOverlay(bounds?: { x: number; y: number; w: number; h: number }): void {
    if (!this.overlay || !this.selected) return;

    if (!bounds) {
      bounds = this.getBounds(this.selected, this.pageHeight, this.scale)!;
      if (!bounds) return;
    }

    this.overlay.style.left = `${bounds.x}px`;
    this.overlay.style.top = `${bounds.y}px`;
    this.overlay.style.width = `${bounds.w}px`;
    this.overlay.style.height = `${bounds.h}px`;
  }

  private startMove(e: PointerEvent): void {
    if (!this.selected) return;
    e.preventDefault();

    const el = this.overlay!;
    el.setPointerCapture(e.pointerId);

    const origAnnotation = this.selected;

    this.dragState = {
      type: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origX: 0,
      origY: 0,
      origWidth: 0,
      origHeight: 0,
    };

    const onMove = (me: PointerEvent) => {
      if (!this.dragState || !this.selected) return;
      const dx = (me.clientX - this.dragState.startX) / this.scale;
      const dy = (me.clientY - this.dragState.startY) / this.scale;

      // Apply delta to the annotation depending on type
      if (origAnnotation.type === 'draw') {
        // Offset all points
        const movedPoints = origAnnotation.points.map((p) => ({
          x: p.x + dx,
          y: p.y - dy, // PDF-space: y increases up, screen dy is down
        }));
        this.selected = { ...origAnnotation, points: movedPoints };
      } else {
        const newX = origAnnotation.x + dx;
        const newY = origAnnotation.y - dy;
        this.selected = { ...origAnnotation, x: newX, y: newY } as SelectableAnnotation;
      }
      this.positionOverlay();
    };

    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      if (this.selected && this.dragState) {
        this.store.update(this.pageIndex, this.selected);
      }
      this.dragState = null;
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }

  private startResize(e: PointerEvent): void {
    if (!this.selected || this.selected.type !== 'image') return;
    e.preventDefault();

    const handle = e.target as HTMLElement;
    handle.setPointerCapture(e.pointerId);

    const img = this.selected;
    const aspect = img.height / img.width;

    this.dragState = {
      type: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origX: img.x,
      origY: img.y,
      origWidth: img.width,
      origHeight: img.height,
    };

    const onMove = (me: PointerEvent) => {
      if (!this.dragState || !this.selected || this.selected.type !== 'image') return;
      const dx = (me.clientX - this.dragState.startX) / this.scale;

      const newWidth = Math.max(20, this.dragState.origWidth + dx);
      const newHeight = newWidth * aspect;

      this.selected = { ...this.selected, width: newWidth, height: newHeight };
      this.positionOverlay();
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      if (this.selected && this.dragState) {
        this.store.update(this.pageIndex, this.selected);
      }
      this.dragState = null;
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }
}

import type { DrawAnnotation } from '../types';
import { AnnotationStore } from '../store/annotation-store';
import { renderAnnotations } from '../ui/annotation-renderer';
import { screenToPdf } from '../utils/coordinates';

export interface DrawToolOptions {
  strokeColor: string;
  strokeWidth: number;
}

export class DrawTool {
  private activePointerId: number | null = null;
  private currentPoints: { x: number; y: number }[] = [];
  private readonly options: DrawToolOptions = {
    strokeColor: '#000000',
    strokeWidth: 2,
  };

  private readonly store: AnnotationStore;

  constructor(store: AnnotationStore) {
    this.store = store;
  }

  getOptions(): Readonly<DrawToolOptions> {
    return this.options;
  }

  setStrokeColor(color: string): void {
    this.options.strokeColor = color;
  }

  setStrokeWidth(width: number): void {
    this.options.strokeWidth = width;
  }

  onPointerDown(
    e: PointerEvent,
    canvas: HTMLCanvasElement,
    _pageIndex: number,
    pageHeight: number,
    scale: number,
  ): void {
    if (this.activePointerId !== null) return;

    this.activePointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const point = screenToPdf(screenX, screenY, pageHeight, scale);

    this.currentPoints = [point];
  }

  onPointerMove(
    e: PointerEvent,
    canvas: HTMLCanvasElement,
    pageIndex: number,
    pageHeight: number,
    scale: number,
  ): void {
    if (e.pointerId !== this.activePointerId) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const point = screenToPdf(screenX, screenY, pageHeight, scale);
    this.currentPoints.push(point);

    // Real-time feedback: re-render existing annotations + in-progress stroke
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const existingAnnotations = this.store.getForPage(pageIndex);
    renderAnnotations(ctx, existingAnnotations, pageHeight, scale);

    // Draw in-progress stroke on top
    this.drawInProgressStroke(ctx, pageHeight, scale);
  }

  onPointerUp(
    e: PointerEvent,
    _canvas: HTMLCanvasElement,
    pageIndex: number,
    _pageHeight: number,
    _scale: number,
    rerenderPage: () => void,
  ): void {
    if (e.pointerId !== this.activePointerId) return;

    this.activePointerId = null;

    if (this.currentPoints.length < 2) {
      this.currentPoints = [];
      return;
    }

    const annotation: DrawAnnotation = {
      id: crypto.randomUUID(),
      type: 'draw',
      pageIndex,
      points: [...this.currentPoints],
      strokeColor: this.options.strokeColor,
      strokeWidth: this.options.strokeWidth,
    };

    this.currentPoints = [];
    this.store.add(pageIndex, annotation);
    rerenderPage();
  }

  private drawInProgressStroke(
    ctx: CanvasRenderingContext2D,
    pageHeight: number,
    scale: number,
  ): void {
    const points = this.currentPoints;
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = this.options.strokeColor;
    ctx.lineWidth = this.options.strokeWidth * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const toScreen = (p: { x: number; y: number }) => ({
      x: p.x * scale,
      y: (pageHeight - p.y) * scale,
    });

    const first = toScreen(points[0]);
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < points.length - 1; i++) {
      const current = toScreen(points[i]);
      const next = toScreen(points[i + 1]);
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }

    const last = toScreen(points[points.length - 1]);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

import type { LoadedPdf, ToolType } from './types';
import { AnnotationStore } from './store/annotation-store';
import { ToolManager } from './tools/tool-manager';
import { DrawTool } from './tools/draw-tool';
import { TextTool } from './tools/text-tool';
import { ImageTool } from './tools/image-tool';
import { SelectTool } from './tools/select-tool';
import { createToolbar, updateToolbarState, updateZoomLabel } from './ui/toolbar';
import { createToolOptionsBar, updateToolOptionsVisibility } from './ui/tool-options-bar';
import { createPageViewer, loadPages, zoomIn, zoomOut, getZoomPercent, type PageViewer } from './ui/page-viewer';
import { renderAnnotations } from './ui/annotation-renderer';
import { loadPdf } from './services/pdf-service';
import { exportPdf, downloadPdf } from './services/export-service';
import { qs } from './utils/dom';
import type { PageCanvasElements } from './ui/page-canvas';

const CURSOR_MAP: Record<string, string> = {
  select: 'default',
  draw: 'crosshair',
  text: 'text',
  image: 'crosshair',
};

export function initApp(): void {
  const appEl = qs<HTMLDivElement>('#app');
  const store = new AnnotationStore();
  const toolManager = new ToolManager();
  const drawTool = new DrawTool(store);
  const textTool = new TextTool(store);
  const imageTool = new ImageTool(store);
  const selectTool = new SelectTool(store);

  let pdf: LoadedPdf | null = null;
  let originalFilename = 'document';

  const viewer = createPageViewer();

  const toolbar = createToolbar({
    onOpenFile: async (file: File) => {
      try {
        pdf = await loadPdf(file);
        originalFilename = file.name.replace(/\.pdf$/i, '');
        store.clear();
        selectTool.deselect();
        toolManager.setActiveTool('select');
        await loadPages(viewer, pdf.pageCount);
        updateToolbarState(toolbar, toolManager.getActiveTool(), true);
        updateZoomLabel(toolbar, getZoomPercent(viewer));
        attachPageListeners(viewer, toolManager, drawTool, textTool, imageTool, selectTool, store);
        updateAllCursors(viewer, toolManager);
      } catch (err) {
        console.error('Failed to load PDF:', err);
        alert('Failed to load PDF. Please try a different file.');
      }
    },

    onToolSelect: (tool: ToolType) => {
      const current = toolManager.getActiveTool();
      selectTool.deselect();
      toolManager.setActiveTool(current === tool ? null : tool);
    },

    onExport: async () => {
      if (!pdf) return;
      try {
        selectTool.deselect();
        const bytes = await exportPdf(pdf.originalBytes, store.getAll());
        downloadPdf(bytes, `${originalFilename}-edited.pdf`);
      } catch (err) {
        console.error('Failed to export PDF:', err);
        alert('Failed to export PDF. Please try again.');
      }
    },

    onZoomIn: async () => {
      if (!pdf) return;
      selectTool.deselect();
      await zoomIn(viewer);
      updateZoomLabel(toolbar, getZoomPercent(viewer));
      rerenderAllOverlays(viewer, store);
    },

    onZoomOut: async () => {
      if (!pdf) return;
      selectTool.deselect();
      await zoomOut(viewer);
      updateZoomLabel(toolbar, getZoomPercent(viewer));
      rerenderAllOverlays(viewer, store);
    },
  });

  const toolOptionsBar = createToolOptionsBar({
    onStrokeColorChange: (color) => drawTool.setStrokeColor(color),
    onStrokeWidthChange: (width) => drawTool.setStrokeWidth(width),
    onTextColorChange: (color) => textTool.setColor(color),
    onTextFontSizeChange: (size) => textTool.setFontSize(size),
  });

  toolManager.onToolChange((tool) => {
    updateToolbarState(toolbar, tool, pdf !== null);
    updateToolOptionsVisibility(toolOptionsBar, tool);
    updateAllCursors(viewer, toolManager);
  });

  // Re-render overlays when store changes (covers undo/redo)
  store.onChange((pageIndex) => {
    const page = viewer.pages[pageIndex];
    if (page) {
      rerenderOverlay(page, store);
    }
  });

  // Keyboard shortcuts for undo/redo
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLTextAreaElement) return;

    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      selectTool.deselect();
      store.undo();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      selectTool.deselect();
      store.redo();
    }
  });

  appEl.appendChild(toolbar);
  appEl.appendChild(toolOptionsBar.element);
  appEl.appendChild(viewer.container);
}

function updateAllCursors(viewer: PageViewer, toolManager: ToolManager): void {
  const tool = toolManager.getActiveTool();
  const cursor = tool ? (CURSOR_MAP[tool] ?? 'default') : 'default';
  for (const page of viewer.pages) {
    page.annotationCanvas.dataset.cursor = cursor;
  }
}

function rerenderOverlay(page: PageCanvasElements, store: AnnotationStore): void {
  const ctx = page.annotationCanvas.getContext('2d');
  if (!ctx) return;
  const annotations = store.getForPage(page.pageIndex);
  renderAnnotations(ctx, annotations, page.pageHeight, page.scale);
}

function rerenderAllOverlays(viewer: PageViewer, store: AnnotationStore): void {
  for (const page of viewer.pages) {
    rerenderOverlay(page, store);
  }
}

function attachPageListeners(
  viewer: PageViewer,
  toolManager: ToolManager,
  drawTool: DrawTool,
  textTool: TextTool,
  imageTool: ImageTool,
  selectTool: SelectTool,
  store: AnnotationStore,
): void {
  for (const page of viewer.pages) {
    const canvas = page.annotationCanvas;
    const rerender = () => rerenderOverlay(page, store);

    canvas.addEventListener('pointerdown', (e) => {
      if (toolManager.isActive('draw')) {
        drawTool.onPointerDown(e, canvas, page.pageIndex, page.pageHeight, page.scale);
      }
    });

    canvas.addEventListener('click', (e) => {
      if (toolManager.isActive('select')) {
        selectTool.trySelect(e, canvas, page.pageIndex, page.pageHeight, page.scale);
      } else if (toolManager.isActive('text') && !textTool.hasActiveInput()) {
        textTool.onClick(e, canvas, page.pageIndex, page.pageHeight, page.scale, rerender);
      } else if (toolManager.isActive('image')) {
        imageTool.onClick(e, canvas, page.pageIndex, page.pageHeight, page.scale, rerender);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (toolManager.isActive('draw')) {
        drawTool.onPointerMove(e, canvas, page.pageIndex, page.pageHeight, page.scale);
      } else if (toolManager.isActive('select')) {
        // Change cursor to pointer when hovering over a selectable annotation
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const hovering = selectTool.hitTest(screenX, screenY, page.pageIndex, page.pageHeight, page.scale);
        canvas.dataset.cursor = hovering ? 'pointer' : 'default';
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (toolManager.isActive('draw')) {
        drawTool.onPointerUp(e, canvas, page.pageIndex, page.pageHeight, page.scale, rerender);
      }
    });
  }
}

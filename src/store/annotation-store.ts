import type { Annotation } from '../types';

interface HistoryEntry {
  readonly action: 'add' | 'remove' | 'update';
  readonly pageIndex: number;
  readonly annotation: Annotation;
  readonly previousAnnotation?: Annotation;
}

const MAX_HISTORY = 50;

export class AnnotationStore {
  private readonly pages: Map<number, ReadonlyArray<Annotation>> = new Map();
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];
  private readonly changeListeners: Array<(pageIndex: number) => void> = [];

  add(pageIndex: number, annotation: Annotation): void {
    const existing = this.pages.get(pageIndex) ?? [];
    this.pages.set(pageIndex, [...existing, annotation]);
    this.pushHistory({ action: 'add', pageIndex, annotation });
    this.notifyChange(pageIndex);
  }

  remove(pageIndex: number, id: string): void {
    const existing = this.pages.get(pageIndex) ?? [];
    const annotation = existing.find((a) => a.id === id);
    if (!annotation) return;
    this.pages.set(pageIndex, existing.filter((a) => a.id !== id));
    this.pushHistory({ action: 'remove', pageIndex, annotation });
    this.notifyChange(pageIndex);
  }

  update(pageIndex: number, updated: Annotation): void {
    const existing = this.pages.get(pageIndex) ?? [];
    const previous = existing.find((a) => a.id === updated.id);
    if (!previous) return;
    this.pages.set(pageIndex, existing.map((a) => (a.id === updated.id ? updated : a)));
    this.pushHistory({ action: 'update', pageIndex, annotation: updated, previousAnnotation: previous });
    this.notifyChange(pageIndex);
  }

  getForPage(pageIndex: number): ReadonlyArray<Annotation> {
    return this.pages.get(pageIndex) ?? [];
  }

  getAll(): ReadonlyMap<number, ReadonlyArray<Annotation>> {
    return this.pages;
  }

  clear(): void {
    this.pages.clear();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  undo(): void {
    const entry = this.undoStack.pop();
    if (!entry) return;

    const existing = this.pages.get(entry.pageIndex) ?? [];

    switch (entry.action) {
      case 'add':
        this.pages.set(entry.pageIndex, existing.filter((a) => a.id !== entry.annotation.id));
        break;
      case 'remove':
        this.pages.set(entry.pageIndex, [...existing, entry.annotation]);
        break;
      case 'update':
        if (entry.previousAnnotation) {
          this.pages.set(entry.pageIndex, existing.map((a) =>
            a.id === entry.annotation.id ? entry.previousAnnotation! : a,
          ));
        }
        break;
    }

    this.redoStack.push(entry);
    this.notifyChange(entry.pageIndex);
  }

  redo(): void {
    const entry = this.redoStack.pop();
    if (!entry) return;

    const existing = this.pages.get(entry.pageIndex) ?? [];

    switch (entry.action) {
      case 'add':
        this.pages.set(entry.pageIndex, [...existing, entry.annotation]);
        break;
      case 'remove':
        this.pages.set(entry.pageIndex, existing.filter((a) => a.id !== entry.annotation.id));
        break;
      case 'update':
        this.pages.set(entry.pageIndex, existing.map((a) =>
          a.id === entry.annotation.id ? entry.annotation : a,
        ));
        break;
    }

    this.undoStack.push(entry);
    this.notifyChange(entry.pageIndex);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  onChange(listener: (pageIndex: number) => void): void {
    this.changeListeners.push(listener);
  }

  private pushHistory(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  private notifyChange(pageIndex: number): void {
    for (const listener of this.changeListeners) {
      listener(pageIndex);
    }
  }
}

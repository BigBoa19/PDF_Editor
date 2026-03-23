export type ToolType = 'select' | 'text' | 'image' | 'draw' | null;

export interface TextAnnotation {
  readonly id: string;
  readonly type: 'text';
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly color: string;
}

export interface ImageAnnotation {
  readonly id: string;
  readonly type: 'image';
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly dataUrl: string;
}

export interface DrawAnnotation {
  readonly id: string;
  readonly type: 'draw';
  readonly pageIndex: number;
  readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  readonly strokeColor: string;
  readonly strokeWidth: number;
}

export type Annotation = TextAnnotation | ImageAnnotation | DrawAnnotation;

export interface LoadedPdf {
  readonly pageCount: number;
  readonly originalBytes: Uint8Array;
}

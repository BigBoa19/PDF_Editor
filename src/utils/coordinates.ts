/**
 * Convert screen-space (canvas pixels, origin top-left) to PDF-space (points, origin bottom-left).
 */
export function screenToPdf(
  screenX: number,
  screenY: number,
  pageHeight: number,
  scale: number,
): { x: number; y: number } {
  return {
    x: screenX / scale,
    y: pageHeight - screenY / scale,
  };
}

/**
 * Convert PDF-space (points, origin bottom-left) to screen-space (canvas pixels, origin top-left).
 */
export function pdfToScreen(
  pdfX: number,
  pdfY: number,
  pageHeight: number,
  scale: number,
): { x: number; y: number } {
  return {
    x: pdfX * scale,
    y: (pageHeight - pdfY) * scale,
  };
}

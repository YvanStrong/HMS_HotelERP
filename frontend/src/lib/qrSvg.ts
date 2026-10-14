/**
 * Inline QR SVG so receipts do not wait on api.qrserver.com (often ~5s in print).
 */
// qr.js ships without types; it is already a dependency of react-qr-code.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("qr.js/lib/QRCode") as new (typeNumber: number, errorCorrectLevel: number) => {
  addData: (data: string, mode?: string) => void;
  make: () => void;
  modules: boolean[][];
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ErrorCorrectLevel = require("qr.js/lib/ErrorCorrectLevel") as { L: number };

export function qrSvgMarkup(value: string, sizePx = 160): string {
  const text = value.trim();
  if (!text) return "";
  try {
    const qr = new QRCode(-1, ErrorCorrectLevel.L);
    qr.addData(text);
    qr.make();
    const cells = qr.modules;
    if (!cells?.length) return "";
    const n = cells.length;
    const paths: string[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (cells[r][c]) paths.push(`M${c} ${r}h1v1h-1z`);
      }
    }
    return `<svg class="qr-svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${n}" height="${n}" fill="#fff"/><path fill="#000" d="${paths.join("")}"/></svg>`;
  } catch {
    return "";
  }
}

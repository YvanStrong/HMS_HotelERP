export type CsvProductRow = {
  rowNumber: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  unit: string;
  errors: string[];
  warnings: string[];
};

function parseCsvLine(line: string): string[] {
  return (
    line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? []
  );
}

export function parseProductsCsv(content: string): { headers: string[]; rows: CsvProductRow[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows: CsvProductRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const [name, sku, barcode, cost, sell, stock, unit] = cols;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name?.trim()) {
      errors.push('Name is required');
    }
    const costPrice = Number(cost);
    const sellPrice = Number(sell);
    const stockQty = Number(stock);
    if (cost && !Number.isFinite(costPrice)) errors.push('Invalid cost price');
    if (sell && !Number.isFinite(sellPrice)) errors.push('Invalid sell price');
    if (stock && !Number.isFinite(stockQty)) errors.push('Invalid stock quantity');
    if (sellPrice > 0 && costPrice > sellPrice) warnings.push('Cost exceeds sell price');

    rows.push({
      rowNumber: i + 1,
      name: name?.trim() ?? '',
      sku: sku?.trim() || null,
      barcode: barcode?.trim() || null,
      costPrice: Number.isFinite(costPrice) ? costPrice : 0,
      sellPrice: Number.isFinite(sellPrice) ? sellPrice : 0,
      stockQty: Number.isFinite(stockQty) ? stockQty : 0,
      unit: unit?.trim() || 'pcs',
      errors,
      warnings,
    });
  }

  return { headers, rows };
}

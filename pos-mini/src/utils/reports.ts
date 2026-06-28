import { endOfDay, startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { getDb } from '../db/database';

export type DateRangePreset = 'today' | 'week' | 'month' | 'custom';

export type ReportDateRange = {
  preset: DateRangePreset;
  startIso: string;
  endIso: string;
};

export function getPresetRange(preset: Exclude<DateRangePreset, 'custom'>): ReportDateRange {
  const now = new Date();
  let start: Date;
  const end = endOfDay(now);

  switch (preset) {
    case 'today':
      start = startOfDay(now);
      break;
    case 'week':
      start = startOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'month':
      start = startOfMonth(now);
      break;
  }

  return { preset, startIso: start.toISOString(), endIso: end.toISOString() };
}

export function getCustomRange(start: Date, end: Date): ReportDateRange {
  return {
    preset: 'custom',
    startIso: startOfDay(start).toISOString(),
    endIso: endOfDay(end).toISOString(),
  };
}

export type SalesReportData = {
  total: number;
  count: number;
  avgTransaction: number;
};

export type TopProduct = {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
};

export type DailyChartPoint = {
  label: string;
  value: number;
};

export async function getSalesReport(range: ReportDateRange): Promise<SalesReportData> {
  const db = getDb();
  const row = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
     FROM sales WHERE status = 'completed' AND created_at >= ? AND created_at <= ?`,
    [range.startIso, range.endIso],
  );
  const total = row?.total ?? 0;
  const count = row?.count ?? 0;
  return { total, count, avgTransaction: count > 0 ? total / count : 0 };
}

export async function getPurchasesReport(range: ReportDateRange): Promise<SalesReportData> {
  const db = getDb();
  const row = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
     FROM purchases WHERE status = 'completed' AND created_at >= ? AND created_at <= ?`,
    [range.startIso, range.endIso],
  );
  const total = row?.total ?? 0;
  const count = row?.count ?? 0;
  return { total, count, avgTransaction: count > 0 ? total / count : 0 };
}

export async function getExpensesTotal(range: ReportDateRange): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
     WHERE date >= ? AND date <= ?`,
    [range.startIso.slice(0, 10), range.endIso.slice(0, 10)],
  );
  return row?.total ?? 0;
}

export async function getProfitReport(range: ReportDateRange): Promise<{
  sales: number;
  cogs: number;
  grossProfit: number;
  purchases: number;
  expenses: number;
  profit: number;
}> {
  const [salesData, purchasesData, expenses, cogs] = await Promise.all([
    getSalesReport(range),
    getPurchasesReport(range),
    getExpensesTotal(range),
    getCogsForRange(range),
  ]);
  const sales = salesData.total;
  const grossProfit = sales - cogs;
  const purchases = purchasesData.total;
  const profit = grossProfit - expenses;
  return { sales, cogs, grossProfit, purchases, expenses, profit };
}

export async function getTopProducts(range: ReportDateRange, limit = 10): Promise<TopProduct[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    product_id: string;
    product_name: string;
    quantity: number;
    revenue: number;
  }>(
    `SELECT si.product_id, si.product_name,
            SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'completed' AND s.created_at >= ? AND s.created_at <= ?
     GROUP BY si.product_id, si.product_name
     ORDER BY revenue DESC LIMIT ?`,
    [range.startIso, range.endIso, limit],
  );
  return rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    quantity: r.quantity,
    revenue: r.revenue,
  }));
}

export async function getDailySalesChart(range: ReportDateRange): Promise<DailyChartPoint[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ day: string; total: number }>(
    `SELECT date(created_at) AS day, COALESCE(SUM(total), 0) AS total
     FROM sales WHERE status = 'completed' AND created_at >= ? AND created_at <= ?
     GROUP BY date(created_at) ORDER BY day ASC`,
    [range.startIso, range.endIso],
  );
  return rows.map((r) => ({
    label: r.day.slice(5),
    value: r.total,
  }));
}

export async function getCogsForRange(range: ReportDateRange): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ cogs: number }>(
    `SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) AS cogs
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'completed' AND s.created_at >= ? AND s.created_at <= ?`,
    [range.startIso, range.endIso],
  );
  return row?.cogs ?? 0;
}

export type PaymentBreakdown = { method: string; total: number };

export async function getPaymentMethodBreakdown(range: ReportDateRange): Promise<PaymentBreakdown[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ payment_method: string; total: number }>(
    `SELECT payment_method, COALESCE(SUM(total), 0) AS total
     FROM sales WHERE status = 'completed' AND created_at >= ? AND created_at <= ?
     GROUP BY payment_method ORDER BY total DESC`,
    [range.startIso, range.endIso],
  );
  return rows.map((r) => ({ method: r.payment_method, total: r.total }));
}

export async function getSalesByHourChart(range: ReportDateRange): Promise<DailyChartPoint[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ hour: string; total: number }>(
    `SELECT printf('%02d', CAST(strftime('%H', created_at) AS INTEGER)) AS hour,
            COALESCE(SUM(total), 0) AS total
     FROM sales WHERE status = 'completed' AND created_at >= ? AND created_at <= ?
     GROUP BY strftime('%H', created_at) ORDER BY hour ASC`,
    [range.startIso, range.endIso],
  );
  return rows.map((r) => ({ label: `${r.hour}h`, value: r.total }));
}

export async function getCustomersWithDebtPaginated(
  query: { limit?: number; offset?: number } = {},
): Promise<{ items: { id: string; name: string; totalDebt: number }[]; total: number; hasMore: boolean }> {
  const db = getDb();
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM customers WHERE total_debt > 0',
  );
  const total = countRow?.count ?? 0;
  const rows = await db.getAllAsync<{ id: string; name: string; total_debt: number }>(
    'SELECT id, name, total_debt FROM customers WHERE total_debt > 0 ORDER BY total_debt DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );
  return {
    items: rows.map((r) => ({ id: r.id, name: r.name, totalDebt: r.total_debt })),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function getUnpaidPurchasesPaginated(
  query: { limit?: number; offset?: number } = {},
): Promise<{
  items: { id: string; poNumber: string; supplierName: string | null; balance: number }[];
  total: number;
  hasMore: boolean;
}> {
  const db = getDb();
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM purchases WHERE total > amount_paid',
  );
  const total = countRow?.count ?? 0;
  const rows = await db.getAllAsync<{
    id: string;
    po_number: string;
    supplier_name: string | null;
    total: number;
    amount_paid: number;
  }>(
    `SELECT p.id, p.po_number, s.name AS supplier_name, p.total, p.amount_paid
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.total > p.amount_paid ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      poNumber: r.po_number,
      supplierName: r.supplier_name,
      balance: r.total - r.amount_paid,
    })),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function getPurchaseCount(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM purchases');
  return row?.count ?? 0;
}

export async function getRefundCount(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM refunds');
  return row?.count ?? 0;
}

export async function getCustomersWithDebt(): Promise<
  { id: string; name: string; totalDebt: number }[]
> {
  const db = getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; total_debt: number }>(
    'SELECT id, name, total_debt FROM customers WHERE total_debt > 0 ORDER BY total_debt DESC',
  );
  return rows.map((r) => ({ id: r.id, name: r.name, totalDebt: r.total_debt }));
}

export async function getUnpaidPurchases(): Promise<
  { id: string; poNumber: string; supplierName: string | null; balance: number }[]
> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string;
    po_number: string;
    supplier_name: string | null;
    total: number;
    amount_paid: number;
  }>(
    `SELECT p.id, p.po_number, s.name AS supplier_name, p.total, p.amount_paid
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.total > p.amount_paid ORDER BY p.created_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    poNumber: r.po_number,
    supplierName: r.supplier_name,
    balance: r.total - r.amount_paid,
  }));
}

export function getLast7DaysRange(): ReportDateRange {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(new Date(), 6));
  return { preset: 'custom', startIso: start.toISOString(), endIso: end.toISOString() };
}

export type StockValuationReport = {
  productCount: number;
  totalUnits: number;
  costValue: number;
  retailValue: number;
  potentialProfit: number;
  byCategory: { category: string; products: number; units: number; costValue: number; retailValue: number }[];
};

export async function getStockValuationReport(): Promise<StockValuationReport> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    category_name: string | null;
    stock_qty: number;
    cost_price: number;
    sell_price: number;
  }>(
    `SELECT c.name AS category_name, p.stock_qty, p.cost_price, p.sell_price
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1 AND p.track_stock = 1`,
  );

  let totalUnits = 0;
  let costValue = 0;
  let retailValue = 0;
  const catMap = new Map<string, { products: number; units: number; costValue: number; retailValue: number }>();

  for (const r of rows) {
    const cat = r.category_name ?? 'Uncategorized';
    const units = r.stock_qty;
    const cost = units * r.cost_price;
    const retail = units * r.sell_price;
    totalUnits += units;
    costValue += cost;
    retailValue += retail;
    const entry = catMap.get(cat) ?? { products: 0, units: 0, costValue: 0, retailValue: 0 };
    entry.products += 1;
    entry.units += units;
    entry.costValue += cost;
    entry.retailValue += retail;
    catMap.set(cat, entry);
  }

  return {
    productCount: rows.length,
    totalUnits,
    costValue,
    retailValue,
    potentialProfit: retailValue - costValue,
    byCategory: [...catMap.entries()].map(([category, v]) => ({ category, ...v })),
  };
}

export type TaxReportData = {
  grossSales: number;
  taxCollected: number;
  netSales: number;
  saleCount: number;
  daily: { date: string; count: number; gross: number; tax: number; net: number }[];
};

export async function getRefundsReport(range: ReportDateRange): Promise<SalesReportData> {
  const db = getDb();
  const row = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
     FROM refunds WHERE status = 'completed' AND created_at >= ? AND created_at <= ?`,
    [range.startIso, range.endIso],
  );
  const total = row?.total ?? 0;
  const count = row?.count ?? 0;
  return { total, count, avgTransaction: count > 0 ? total / count : 0 };
}

export type ExpenseReportRow = {
  category: string;
  total: number;
  count: number;
};

export async function getExpensesReport(range: ReportDateRange): Promise<{
  total: number;
  count: number;
  byCategory: ExpenseReportRow[];
}> {
  const db = getDb();
  const start = range.startIso.slice(0, 10);
  const end = range.endIso.slice(0, 10);
  const summary = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses
     WHERE date >= ? AND date <= ?`,
    [start, end],
  );
  const byCategory = await db.getAllAsync<{ category: string; total: number; count: number }>(
    `SELECT category, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses
     WHERE date >= ? AND date <= ? GROUP BY category ORDER BY total DESC`,
    [start, end],
  );
  return {
    total: summary?.total ?? 0,
    count: summary?.count ?? 0,
    byCategory: byCategory.map((r) => ({ category: r.category, total: r.total, count: r.count })),
  };
}

export async function getTaxReport(range: ReportDateRange): Promise<TaxReportData> {
  const db = getDb();
  const summary = await db.getFirstAsync<{ gross: number; tax: number; count: number }>(
    `SELECT COALESCE(SUM(total), 0) AS gross, COALESCE(SUM(tax_amount), 0) AS tax, COUNT(*) AS count
     FROM sales WHERE status = 'completed' AND created_at >= ? AND created_at <= ?`,
    [range.startIso, range.endIso],
  );
  const gross = summary?.gross ?? 0;
  const tax = summary?.tax ?? 0;
  const dailyRows = await db.getAllAsync<{ day: string; count: number; gross: number; tax: number }>(
    `SELECT date(created_at) AS day, COUNT(*) AS count,
            COALESCE(SUM(total), 0) AS gross, COALESCE(SUM(tax_amount), 0) AS tax
     FROM sales WHERE status = 'completed' AND created_at >= ? AND created_at <= ?
     GROUP BY date(created_at) ORDER BY day DESC`,
    [range.startIso, range.endIso],
  );
  return {
    grossSales: gross,
    taxCollected: tax,
    netSales: gross - tax,
    saleCount: summary?.count ?? 0,
    daily: dailyRows.map((r) => ({
      date: r.day,
      count: r.count,
      gross: r.gross,
      tax: r.tax,
      net: r.gross - r.tax,
    })),
  };
}

import type { CreateProductInput, Product, UpdateProductInput } from '../types';
import type { ListQuery, PaginatedResult } from '../types/pagination';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';
import { buildWhere, clampLimit, clampOffset, likePattern } from './queryHelpers';
import { normalizeProductTaxClass, taxRateForClass } from '../constants/productTax';
import { normalizeProductUnit } from '../constants/productUnits';

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  min_stock: number;
  unit: string;
  tax_class: string | null;
  is_taxable: number | null;
  tax_rate: number | null;
  tax_inclusive: number | null;
  image_uri: string | null;
  expiry_date: string | null;
  batch_lot: string | null;
  track_stock: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
};

function mapProduct(row: ProductRow): Product {
  const taxClass = normalizeProductTaxClass(row.tax_class);
  const isTaxable = row.is_taxable === 1 || taxClass === 'B';
  const taxRate = row.tax_rate ?? taxRateForClass(taxClass);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.category_id,
    costPrice: row.cost_price,
    sellPrice: row.sell_price,
    stockQty: row.stock_qty,
    minStock: row.min_stock,
    unit: row.unit,
    taxClass,
    isTaxable,
    taxRate: isTaxable ? (taxRate || taxRateForClass('B')) : 0,
    taxInclusive: row.tax_inclusive === 1,
    imageUri: row.image_uri,
    expiryDate: row.expiry_date ?? null,
    batchLot: row.batch_lot ?? null,
    trackStock: row.track_stock === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    categoryName: row.category_name ?? undefined,
  };
}

function taxFieldsFromInput(taxClass: string | undefined, existing?: Product) {
  const resolved = normalizeProductTaxClass(taxClass ?? existing?.taxClass);
  const isTaxable = resolved === 'B';
  return {
    taxClass: resolved,
    isTaxable,
    taxRate: taxRateForClass(resolved),
    taxInclusive: existing?.taxInclusive ?? false,
  };
}

const SELECT_PRODUCT = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

export type ProductListFilters = {
  activeOnly?: boolean;
  trackStockOnly?: boolean;
  lowStockOnly?: boolean;
  outOfStockOnly?: boolean;
  categoryId?: string | null;
};

export async function listProductsPaginated(
  query: ListQuery & ProductListFilters = {},
): Promise<PaginatedResult<Product>> {
  const db = getDb();
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const activeOnly = query.activeOnly !== false;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (activeOnly) conditions.push('p.is_active = 1');
  if (query.trackStockOnly) conditions.push('p.track_stock = 1');
  if (query.lowStockOnly) conditions.push('p.track_stock = 1 AND p.stock_qty <= p.min_stock AND p.stock_qty > 0');
  if (query.outOfStockOnly) conditions.push('p.track_stock = 1 AND p.stock_qty <= 0');
  if (query.categoryId) {
    conditions.push('p.category_id = ?');
    params.push(query.categoryId);
  }

  if (query.search?.trim()) {
    conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
    const like = likePattern(query.search);
    params.push(like, like, like);
  }

  const where = buildWhere(conditions);
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM products p ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const rows = await db.getAllAsync<ProductRow>(
    `${SELECT_PRODUCT} ${where} ORDER BY p.name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: rows.map(mapProduct),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function listProducts(activeOnly = true): Promise<Product[]> {
  return (await listProductsPaginated({ activeOnly, limit: 500 })).items;
}

export async function searchProducts(query: string): Promise<Product[]> {
  return (await listProductsPaginated({ search: query, activeOnly: true, limit: 100 })).items;
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = getDb();
  const row = await db.getFirstAsync<ProductRow>(`${SELECT_PRODUCT} WHERE p.id = ?`, [id]);
  return row ? mapProduct(row) : null;
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const db = getDb();
  const row = await db.getFirstAsync<ProductRow>(
    `${SELECT_PRODUCT} WHERE p.barcode = ? AND p.is_active = 1`,
    [barcode],
  );
  return row ? mapProduct(row) : null;
}

export async function findProductByScaleCode(productCode: string): Promise<Product | null> {
  const db = getDb();
  const like = `${productCode}%`;
  const row = await db.getFirstAsync<ProductRow>(
    `${SELECT_PRODUCT} WHERE p.is_active = 1 AND (p.barcode LIKE ? OR p.sku LIKE ?) LIMIT 1`,
    [like, like],
  );
  return row ? mapProduct(row) : null;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  const tax = taxFieldsFromInput(input.taxClass);
  await db.runAsync(
    `INSERT INTO products (
      id, name, description, sku, barcode, category_id, cost_price, sell_price, stock_qty,
      min_stock, unit, tax_class, is_taxable, tax_rate, tax_inclusive, image_uri, expiry_date, batch_lot,
      track_stock, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.description ?? null,
      input.sku ?? null,
      input.barcode ?? null,
      input.categoryId ?? null,
      input.costPrice,
      input.sellPrice,
      input.stockQty,
      input.minStock,
      normalizeProductUnit(input.unit),
      tax.taxClass,
      tax.isTaxable ? 1 : 0,
      input.taxRate ?? tax.taxRate,
      (input.taxInclusive ?? tax.taxInclusive) ? 1 : 0,
      input.imageUri ?? null,
      input.expiryDate ?? null,
      input.batchLot ?? null,
      input.trackStock ? 1 : 0,
      input.isActive ? 1 : 0,
      now,
      now,
    ],
  );
  const created = await getProductById(id);
  if (!created) throw new Error('Failed to create product');
  return created;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const db = getDb();
  const existing = await getProductById(id);
  if (!existing) throw new Error('Product not found');
  const now = nowIso();
  const tax = taxFieldsFromInput(input.taxClass, existing);

  await db.runAsync(
    `UPDATE products SET
      name = ?, description = ?, sku = ?, barcode = ?, category_id = ?, cost_price = ?, sell_price = ?,
      stock_qty = ?, min_stock = ?, unit = ?, tax_class = ?, is_taxable = ?, tax_rate = ?, tax_inclusive = ?,
      image_uri = ?, expiry_date = ?, batch_lot = ?, track_stock = ?, is_active = ?, updated_at = ?
    WHERE id = ?`,
    [
      input.name ?? existing.name,
      input.description !== undefined ? input.description : existing.description,
      input.sku !== undefined ? input.sku : existing.sku,
      input.barcode !== undefined ? input.barcode : existing.barcode,
      input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      input.costPrice ?? existing.costPrice,
      input.sellPrice ?? existing.sellPrice,
      input.stockQty ?? existing.stockQty,
      input.minStock ?? existing.minStock,
      input.unit !== undefined ? normalizeProductUnit(input.unit) : existing.unit,
      tax.taxClass,
      (input.isTaxable ?? tax.isTaxable) ? 1 : 0,
      input.taxRate ?? tax.taxRate,
      (input.taxInclusive ?? existing.taxInclusive) ? 1 : 0,
      input.imageUri !== undefined ? input.imageUri : existing.imageUri,
      input.expiryDate !== undefined ? input.expiryDate : existing.expiryDate,
      input.batchLot !== undefined ? input.batchLot : existing.batchLot,
      (input.trackStock ?? existing.trackStock) ? 1 : 0,
      (input.isActive ?? existing.isActive) ? 1 : 0,
      now,
      id,
    ],
  );
  const updated = await getProductById(id);
  if (!updated) throw new Error('Failed to update product');
  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?', [nowIso(), id]);
}

export async function countProducts(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM products WHERE is_active = 1',
  );
  return row?.count ?? 0;
}

export async function countLowStock(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM products
     WHERE is_active = 1 AND track_stock = 1 AND stock_qty <= min_stock AND stock_qty > 0`,
  );
  return row?.count ?? 0;
}

export async function countOutOfStock(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM products
     WHERE is_active = 1 AND track_stock = 1 AND stock_qty <= 0`,
  );
  return row?.count ?? 0;
}

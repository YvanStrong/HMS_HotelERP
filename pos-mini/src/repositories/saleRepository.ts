import type { CreateSaleInput, Sale, SaleItem, SalePayment, SaleRefundStatus } from '../types';
import type { ListQuery, PaginatedResult } from '../types/pagination';
import { getDb } from '../db/database';
import { generateId, nowIso, todayStartIso } from '../utils/ids';
import { getNextNumber, recordStockMovement } from './helpers';
import { buildWhere, clampLimit, clampOffset, likePattern } from './queryHelpers';
import { getCurrentStaffId, getRequireShift, setLastSaleId } from './metaRepository';
import { getOpenShift } from './shiftRepository';
import { getBusinessSettings } from './settingsRepository';
import { businessTypeHasFeature } from '../constants/businessTypes';
import { expandBundleForStock } from './bundleRepository';
import type { SelectedModifier } from '../types';

type SaleRow = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  staff_id: string | null;
  shift_id: string | null;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  tax_amount: number;
  tip_amount: number;
  service_charge: number;
  total: number;
  amount_paid: number;
  change_amount: number;
  payment_method: string;
  status: string;
  notes: string | null;
  table_id: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  sold_qty?: number;
  refunded_qty?: number;
};

type SaleItemRow = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_name: string | null;
  modifiers_json: string | null;
  unit_price: number;
  cost_price: number;
  quantity: number;
  line_total: number;
  discount_amount: number;
};

type SalePaymentRow = {
  id: string;
  sale_id: string;
  payment_method: string;
  amount: number;
  created_at: string;
};

function resolveRefundStatus(soldQty: number, refundedQty: number): SaleRefundStatus {
  if (refundedQty <= 0) return 'none';
  if (soldQty > 0 && refundedQty >= soldQty) return 'refunded';
  return 'partial';
}

function mapSale(row: SaleRow): Sale {
  const soldQty = row.sold_qty ?? 0;
  const refundedQty = row.refunded_qty ?? 0;
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    staffId: row.staff_id,
    shiftId: row.shift_id,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    discountPercent: row.discount_percent,
    taxAmount: row.tax_amount,
    tipAmount: row.tip_amount ?? 0,
    serviceCharge: row.service_charge ?? 0,
    total: row.total,
    amountPaid: row.amount_paid,
    changeAmount: row.change_amount,
    paymentMethod: row.payment_method as Sale['paymentMethod'],
    status: row.status as Sale['status'],
    refundStatus: resolveRefundStatus(soldQty, refundedQty),
    notes: row.notes,
    tableId: row.table_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSaleItem(row: SaleItemRow): SaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    productName: row.product_name,
    variantId: row.variant_id,
    variantName: row.variant_name,
    modifiersJson: row.modifiers_json,
    unitPrice: row.unit_price,
    costPrice: row.cost_price,
    quantity: row.quantity,
    lineTotal: row.line_total,
    discountAmount: row.discount_amount,
  };
}

function mapSalePayment(row: SalePaymentRow): SalePayment {
  return {
    id: row.id,
    saleId: row.sale_id,
    paymentMethod: row.payment_method as SalePayment['paymentMethod'],
    amount: row.amount,
    createdAt: row.created_at,
  };
}

const SELECT_SALE = `
  SELECT s.*, c.name AS customer_name,
    COALESCE((
      SELECT SUM(si.quantity) FROM sale_items si WHERE si.sale_id = s.id
    ), 0) AS sold_qty,
    COALESCE((
      SELECT SUM(ri.quantity)
      FROM refunds r
      JOIN refund_items ri ON ri.refund_id = r.id
      WHERE r.sale_id = s.id AND r.status = 'completed'
    ), 0) AS refunded_qty
  FROM sales s
  LEFT JOIN customers c ON c.id = s.customer_id
`;

export type SaleListFilters = {
  paymentMethod?: string;
  status?: string;
  customerId?: string;
};

export async function listSalesPaginated(
  query: ListQuery & SaleListFilters = {},
): Promise<PaginatedResult<Sale>> {
  const db = getDb();
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.search?.trim()) {
    conditions.push('(s.invoice_number LIKE ? OR c.name LIKE ?)');
    const like = likePattern(query.search);
    params.push(like, like);
  }
  if (query.paymentMethod) {
    conditions.push('s.payment_method = ?');
    params.push(query.paymentMethod);
  }
  if (query.status) {
    conditions.push('s.status = ?');
    params.push(query.status);
  }
  if (query.customerId) {
    conditions.push('s.customer_id = ?');
    params.push(query.customerId);
  } else if (query.status !== 'pending') {
    conditions.push("s.status <> 'pending'");
  }

  const where = buildWhere(conditions);
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sales s LEFT JOIN customers c ON c.id = s.customer_id ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const rows = await db.getAllAsync<SaleRow>(
    `${SELECT_SALE} ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: rows.map(mapSale),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function listSales(limit = 100): Promise<Sale[]> {
  return (await listSalesPaginated({ limit })).items;
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const db = getDb();
  const row = await db.getFirstAsync<SaleRow>(`${SELECT_SALE} WHERE s.id = ?`, [id]);
  return row ? mapSale(row) : null;
}

export async function getSaleByInvoiceNumber(invoiceNumber: string): Promise<Sale | null> {
  const db = getDb();
  const row = await db.getFirstAsync<SaleRow>(
    `${SELECT_SALE} WHERE s.invoice_number = ?`,
    [invoiceNumber.trim()],
  );
  return row ? mapSale(row) : null;
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<SaleItemRow>(
    'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY product_name ASC',
    [saleId],
  );
  return rows.map(mapSaleItem);
}

export async function getSalePayments(saleId: string): Promise<SalePayment[]> {
  const db = getDb();
  const rows = await db.getAllAsync<SalePaymentRow>(
    'SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY created_at ASC',
    [saleId],
  );
  return rows.map(mapSalePayment);
}

export async function getSaleWithItems(id: string): Promise<Sale | null> {
  const sale = await getSaleById(id);
  if (!sale) return null;
  sale.items = await getSaleItems(id);
  return sale;
}

export async function getPendingSaleByTableId(tableId: string): Promise<Sale | null> {
  const db = getDb();
  const row = await db.getFirstAsync<SaleRow>(
    `${SELECT_SALE} WHERE s.table_id = ? AND s.status = 'pending' LIMIT 1`,
    [tableId],
  );
  if (!row) return null;
  const sale = mapSale(row);
  sale.items = await getSaleItems(sale.id);
  return sale;
}

export async function savePendingTableSale(
  tableId: string,
  input: Omit<CreateSaleInput, 'amountPaid' | 'changeAmount' | 'paymentMethod'>,
): Promise<Sale> {
  const existing = await getPendingSaleByTableId(tableId);
  return createSale({
    ...input,
    tableId,
    existingSaleId: existing?.id ?? null,
    status: 'pending',
    paymentMethod: 'cash',
    amountPaid: 0,
    changeAmount: 0,
  });
}

export async function createSale(input: CreateSaleInput & { status?: Sale['status'] }): Promise<Sale> {
  const db = getDb();
  const saleStatus = input.status ?? 'completed';
  const isCompleting = saleStatus === 'completed';

  if (isCompleting) {
    const requireShift = await getRequireShift();
    const openShift = await getOpenShift();
    if (requireShift && !openShift) {
      throw new Error('NO_OPEN_SHIFT');
    }
  }

  const staffId = input.staffId ?? (await getCurrentStaffId());
  const shiftId = input.shiftId ?? (isCompleting ? (await getOpenShift())?.id ?? null : null);

  const id = input.existingSaleId ?? generateId();
  const now = nowIso();
  let invoiceNumber: string;
  if (input.existingSaleId) {
    const existing = await getSaleById(input.existingSaleId);
    if (isCompleting && existing?.invoiceNumber.startsWith('OPEN-')) {
      invoiceNumber = await getNextNumber('INV-');
    } else {
      invoiceNumber = existing?.invoiceNumber ?? (await getNextNumber('INV-'));
    }
  } else if (input.tableId && !isCompleting) {
    invoiceNumber = `OPEN-${input.tableId.slice(0, 8)}`;
  } else {
    invoiceNumber = await getNextNumber('INV-');
  }

  const isSplit = Boolean(input.payments && input.payments.length > 1);
  const paymentMethod = isSplit ? 'split' : input.paymentMethod;
  const kitchenItems: {
    productId: string;
    productName: string;
    categoryId: string | null;
    variantName?: string | null;
    quantity: number;
    modifiers: SelectedModifier[];
  }[] = [];
  let shouldPrintKitchen = false;

  await db.withTransactionAsync(async () => {
    if (input.existingSaleId) {
      await db.runAsync('DELETE FROM sale_items WHERE sale_id = ?', [id]);
      await db.runAsync('DELETE FROM sale_payments WHERE sale_id = ?', [id]);
      await db.runAsync(
        `UPDATE sales SET
          invoice_number = ?, customer_id = ?, staff_id = ?, shift_id = ?, subtotal = ?, discount_amount = ?,
          discount_percent = ?, tax_amount = ?, tip_amount = ?, service_charge = ?, total = ?,
          amount_paid = ?, change_amount = ?, payment_method = ?, status = ?, notes = ?, table_id = ?, updated_at = ?
         WHERE id = ?`,
        [
          invoiceNumber,
          input.customerId ?? null,
          staffId,
          shiftId,
          input.subtotal,
          input.discountAmount,
          input.discountPercent,
          input.taxAmount,
          input.tipAmount ?? 0,
          input.serviceCharge ?? 0,
          input.total,
          input.amountPaid,
          input.changeAmount,
          paymentMethod,
          saleStatus,
          input.notes ?? null,
          input.tableId ?? null,
          now,
          id,
        ],
      );
    } else {
      await db.runAsync(
        `INSERT INTO sales (
          id, invoice_number, customer_id, staff_id, shift_id, subtotal, discount_amount, discount_percent,
          tax_amount, tip_amount, service_charge, total, amount_paid, change_amount, payment_method, status, notes,
          table_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          invoiceNumber,
          input.customerId ?? null,
          staffId,
          shiftId,
          input.subtotal,
          input.discountAmount,
          input.discountPercent,
          input.taxAmount,
          input.tipAmount ?? 0,
          input.serviceCharge ?? 0,
          input.total,
          input.amountPaid,
          input.changeAmount,
          paymentMethod,
          saleStatus,
          input.notes ?? null,
          input.tableId ?? null,
          now,
          now,
        ],
      );
    }

    if (isCompleting && input.payments?.length) {
      for (const p of input.payments) {
        await db.runAsync(
          `INSERT INTO sale_payments (id, sale_id, payment_method, amount, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [generateId(), id, p.paymentMethod, p.amount, now],
        );
      }
    }

    for (const item of input.items) {
      const itemId = generateId();
      const modifiersJson = item.modifiersJson ?? null;
      let modifiers: SelectedModifier[] = [];
      if (modifiersJson) {
        try {
          modifiers = JSON.parse(modifiersJson) as SelectedModifier[];
        } catch {
          modifiers = [];
        }
      }

      await db.runAsync(
        `INSERT INTO sale_items (
          id, sale_id, product_id, product_name, variant_id, variant_name, modifiers_json,
          unit_price, cost_price, quantity, line_total, discount_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          id,
          item.productId,
          item.productName,
          item.variantId ?? null,
          item.variantName ?? null,
          modifiersJson,
          item.unitPrice,
          item.costPrice,
          item.quantity,
          item.lineTotal,
          item.discountAmount,
        ],
      );

      const product = await db.getFirstAsync<{ track_stock: number; category_id: string | null }>(
        'SELECT track_stock, category_id FROM products WHERE id = ?',
        [item.productId],
      );

      kitchenItems.push({
        productId: item.productId,
        productName: item.productName,
        categoryId: product?.category_id ?? null,
        variantName: item.variantName,
        quantity: item.quantity,
        modifiers,
      });

      const bundleLines = await expandBundleForStock(item.productId, item.quantity);
      if (bundleLines.length > 0 && isCompleting) {
        for (const child of bundleLines) {
          await recordStockMovement(db, {
            productId: child.productId,
            movementType: 'sale',
            referenceType: 'sale',
            referenceId: id,
            quantityChange: -child.quantity,
            notes: `Bundle component for ${item.productName}`,
          });
        }
      } else if (product?.track_stock === 1 && isCompleting) {
        if (item.variantId) {
          await db.runAsync(
            'UPDATE product_variants SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?',
            [item.quantity, item.variantId],
          );
        }
        await recordStockMovement(db, {
          productId: item.productId,
          movementType: 'sale',
          referenceType: 'sale',
          referenceId: id,
          quantityChange: -item.quantity,
          notes: `Sale ${invoiceNumber}${item.variantName ? ` (${item.variantName})` : ''}`,
        });
      }
    }

    if (isCompleting) {
      const settings = await getBusinessSettings();
      const kitchenEnabled = businessTypeHasFeature(settings?.businessType, 'kitchen');

      if (kitchenEnabled && kitchenItems.length > 0) {
        shouldPrintKitchen = true;
        const ticketId = generateId();
        await db.runAsync(
          `INSERT INTO kitchen_tickets (id, sale_id, invoice_number, status, items_json, notes, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
          [
            ticketId,
            id,
            invoiceNumber,
            JSON.stringify(kitchenItems),
            input.notes ?? null,
            now,
            now,
          ],
        );
      }
    }

    if (isCompleting) {
      const creditAmount =
        isSplit && input.payments
          ? input.payments.filter((p) => p.paymentMethod === 'credit').reduce((s, p) => s + p.amount, 0)
          : paymentMethod === 'credit'
            ? input.total
            : 0;

      if (creditAmount > 0 && input.customerId) {
        await db.runAsync(
          `INSERT INTO debts (id, customer_id, sale_id, amount, type, notes, created_at)
           VALUES (?, ?, ?, ?, 'debt', ?, ?)`,
          [generateId(), input.customerId, id, creditAmount, `Sale ${invoiceNumber}`, now],
        );
        await db.runAsync(
          'UPDATE customers SET total_debt = total_debt + ?, updated_at = ? WHERE id = ?',
          [creditAmount, now, input.customerId],
        );
      }
    }

    if (input.tableId) {
      const tableStatus = isCompleting ? 'available' : 'occupied';
      await db.runAsync('UPDATE pos_tables SET status = ?, updated_at = ? WHERE id = ?', [
        tableStatus,
        now,
        input.tableId,
      ]);
    }
  });

  const created = await getSaleWithItems(id);
  if (!created) throw new Error('Failed to create sale');
  if (isCompleting) await setLastSaleId(id);

  if (shouldPrintKitchen && kitchenItems.length > 0) {
    const { printKitchenTicketsForSale } = await import('../printing/PrinterService');
    void printKitchenTicketsForSale(invoiceNumber, kitchenItems, input.notes ?? null).catch(() => undefined);
  }

  return created;
}

export async function getTodaySalesStats(): Promise<{ total: number; count: number }> {
  const db = getDb();
  const start = todayStartIso();
  const row = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
     FROM sales WHERE status = 'completed' AND created_at >= ?`,
    [start],
  );
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}

export async function voidSale(id: string): Promise<void> {
  const db = getDb();
  const sale = await getSaleWithItems(id);
  if (!sale || sale.status === 'voided') return;

  await db.withTransactionAsync(async () => {
    const now = nowIso();
    await db.runAsync("UPDATE sales SET status = 'voided', updated_at = ? WHERE id = ?", [now, id]);

    for (const item of sale.items ?? []) {
      const product = await db.getFirstAsync<{ track_stock: number }>(
        'SELECT track_stock FROM products WHERE id = ?',
        [item.productId],
      );
      if (product?.track_stock === 1) {
        await recordStockMovement(db, {
          productId: item.productId,
          movementType: 'return',
          referenceType: 'sale_void',
          referenceId: id,
          quantityChange: item.quantity,
          notes: `Void sale ${sale.invoiceNumber}`,
        });
      }
    }

    if (sale.paymentMethod === 'credit' && sale.customerId) {
      await db.runAsync(
        `INSERT INTO debts (id, customer_id, sale_id, amount, type, notes, created_at)
         VALUES (?, ?, ?, ?, 'payment', ?, ?)`,
        [
          generateId(),
          sale.customerId,
          id,
          sale.total,
          `Void sale ${sale.invoiceNumber}`,
          now,
        ],
      );
      await db.runAsync(
        'UPDATE customers SET total_debt = MAX(0, total_debt - ?), updated_at = ? WHERE id = ?',
        [sale.total, now, sale.customerId],
      );
    } else if (sale.paymentMethod === 'split' && sale.customerId) {
      const payments = await getSalePayments(id);
      const creditPaid = payments
        .filter((p) => p.paymentMethod === 'credit')
        .reduce((s, p) => s + p.amount, 0);
      if (creditPaid > 0) {
        await db.runAsync(
          `INSERT INTO debts (id, customer_id, sale_id, amount, type, notes, created_at)
           VALUES (?, ?, ?, ?, 'payment', ?, ?)`,
          [
            generateId(),
            sale.customerId,
            id,
            creditPaid,
            `Void sale ${sale.invoiceNumber}`,
            now,
          ],
        );
        await db.runAsync(
          'UPDATE customers SET total_debt = MAX(0, total_debt - ?), updated_at = ? WHERE id = ?',
          [creditPaid, now, sale.customerId],
        );
      }
    }
  });
}


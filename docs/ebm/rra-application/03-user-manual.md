# HotelERP CIS — User manual (EBM / VSDC)

**Software:** HotelERP CIS 1.0.0  
**Audience:** Hotel / restaurant / shop cashiers, supervisors, accountants

## 1. Sign in
Open https://kivucloud.rw/login with the staff username issued for your property.

## 2. Enable EBM (supervisor)
Settings → **EBM / VSDC**:
1. Enter taxpayer **TIN**, branch ID (default `00`), device serial, VSDC/OSDC URL  
2. Save device → **Initialize** (consumes Initialization API)  
3. Confirm SDC ID and MRC are stored  
4. Keep the property online; VSDC must be reachable for NS/NR

## 3. Normal sale (NS)
POS: add identified items (name, qty, price, tax A/B) → tender (Cash / Card / Mobile / Credit) → print.  
HotelERP sends transaction then invoice to VSDC, then stock in/out and stock master. The slip prints SDC INFORMATION + QR after ACK.

## 4. Normal refund (NR)
Invoices / POS refund: select original sale, enter reason, confirm. Amounts print negative and reference the original receipt. Only one refund per original is allowed.

## 5. Proforma (PS)
POS proforma or reservation proforma. Marked **PROFORMA** and **THIS IS NOT AN OFFICIAL RECEIPT**. Not a VAT invoice.

## 6. Copy
Reprint from Invoices. Copy must not replace the original; use it only as a duplicate.

## 7. Stock
Inventory: receive PO (purchase save to VSDC), sell (stock out), view remaining qty. Goods cannot be sold below stock; services can.

## 8. Reports
POS shifts, sales analytics, inventory, purchases, voids. Daily X/Z style summaries are taken from shift close and accounting reports.

## 9. Errors
If VSDC returns an error, the cashier sees it on EBM settings (outbox) and must not treat a pending slip as a certified original.

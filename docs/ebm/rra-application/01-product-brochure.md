# HotelERP CIS — Product brochure

**Supplier:** Kivu Cloud Solutions  
**Product / model:** HotelERP Certified Invoicing System (CIS) for VSDC  
**Version:** 1.0.0  
**Website:** https://kivucloud.rw  
**Type:** CIS for VSDC (solution-provider owned)

HotelERP is a web Certified Invoicing System for hotels, restaurants, and retail/POS in Rwanda. It connects to RRA **VSDC** (local WAR) or **OSDC** (cloud) over HTTPS REST.

## What it does
- Issues fiscal receipts for POS sales, hotel invoices, F&B, and refunds
- Sends sales, stock in/out, stock master, purchases, and item master to VSDC
- Prints 80 mm thermal (Epson) and A4 invoices with **SDC INFORMATION**, MRC, signatures, internal data, QR code, and RRA logos
- Device register / Initialize using TIN, branch ID (`bhfId`), and device serial number
- Stores signing keys encrypted; retries failed VSDC calls through a durable outbox

## Modules used with EBM
POS, inventory/stock, purchases (goods receipt), invoices/refunds, item classification (`itemCd` / UNSPSC class codes).

Production fiscalization stays off until RRA sandbox certification succeeds (`HMS_EBM_ENABLED`).

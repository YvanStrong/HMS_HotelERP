# HotelERP CIS — Programming and configuration manual

**Software:** HotelERP CIS 1.0.0  
**Audience:** Integrators / RRA evaluators

## 1. Service-mode fields (Art. 7.21)
Configured in **Settings → EBM** and hotel profile:

| Field | Where |
|---|---|
| TIN | EBM device + hotel TIN |
| MRC | Stored after Initialization (`mrcNo`) |
| Company name / address / phone | Hotel profile (printed on receipt header) |
| Date/time | Server clock (Africa/Kigali recommended) |
| Tax rates A, B, C, D | A = exempt 0%; B = 18% VAT; C/D reserved (sent as 0.00 until programmed) |

## 2. VSDC REST paths (override with `hms.ebm.paths.*`)
| Function | Default path |
|---|---|
| Initialization | `/initializer/selectInitInfo` |
| Codes | `/code/selectCodes` |
| Item classification | `/itemClass/selectItemsClass` |
| Customer | `/customers/selectCustomer` |
| Select item | `/items/selectItems` |
| Notices | `/notices/selectNotices` |
| Import items | `/imports/selectImportItems` |
| Import status update | `/imports/updateImportItems` |
| Select purchase | `/trnsPurchase/selectTrnsPurchaseSales` |
| Save item | `/saveItem` |
| Sales transaction / invoice | `/trnsSales/saveSales` |
| Purchase save | `/insertTrnsPurchase` |
| Stock in/out | `/stock/saveStockItems` |
| Stock master | `/stockMaster/saveStockMaster` |

Auth after Init: Bearer signing key + `X-SDC-ID` / `X-MRC-NO`.

## 3. Receipt → VSDC payload (sales)
Ordered outbox: **TRANSACTION → INVOICE → STOCK_IO → STOCK_MASTER**.  
Fields include `tin`, `bhfId`, `sdcId`, `mrcNo`, `invcNo`, `orgInvcNo`, `custTin`, `rcptTyCd` (S/R/P), `pmtTyCd`, taxbl/tax amounts A–D, line `itemCd` / `itemClsCd` / `taxTyCd`.

## 4. itemCd
Auto: `RW` + item type + pkg unit + qty unit + 7-digit sequence (RRA format). Classification from Item Class API.

## 5. Database / journal
PostgreSQL tables: `ebm_devices`, `ebm_outbox`, `taxable_sale_events`, `ebm_code_list`, invoices, depot sales, stock transactions. This is the electronic journal for audit.

## 6. Errors
VSDC HTTP/result codes are stored on outbox rows and shown in Settings → EBM. Operators retry failed jobs without editing the original sale.

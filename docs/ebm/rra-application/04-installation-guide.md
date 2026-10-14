# HotelERP CIS — Installation guide

**Software:** HotelERP CIS 1.0.0  
**Host:** Windows Server (current production: kivucloud.rw)

## Components
| Component | Role |
|---|---|
| Next.js UI | CIS operator screens (POS, invoices, EBM settings) |
| Spring Boot API | CIS business logic + VSDC client |
| PostgreSQL | Electronic journal, stock, items, outbox |
| Reverse proxy | HTTPS 443 → UI 3000 / API 8080 |
| VSDC WAR or OSDC | RRA-issued, same TIN as the CIS device |

## Install outline
1. Install JDK 22+, Node.js 20+, PostgreSQL  
2. Deploy `hms-backend-*.jar` and frontend production build  
3. Set `HMS_EBM_ENABLED=true` and `EBM_KEY_ENCRYPTION_SECRET` (min 16 chars)  
4. Point each property’s Settings → EBM to the taxpayer VSDC base URL  
5. Initialize device (TIN + bhfId + serial)  
6. Attach Epson 80 mm printer for POS; A4 for office invoices  
7. Verify Init returns SDC ID / MRC before going live

## Network
CIS must reach VSDC over LAN or OSDC over HTTPS. Outbound 443 required for OSDC. Time-out and retry are handled by the outbox (poll ~15 s).

## Version
The certified build is identified as **HotelERP 1.0.0** (printed on fiscal slips as CIS VER).

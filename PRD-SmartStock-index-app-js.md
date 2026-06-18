# Product Requirements Document: SmartStock Client (`index.html` + `app.js`)

## Document Overview

| Field | Value |
|-------|-------|
| **Project** | SmartStock — Lagos Retail Inventory (Client-Side MVP) |
| **Artifacts** | `index.html`, `app.js` |
| **Version** | 1.0 (as-implemented snapshot) |
| **Date** | May 23, 2026 |
| **Status** | **Implemented** — specification derived from current source code |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technical Stack](#2-technical-stack)
3. [Application Architecture](#3-application-architecture)
4. [Design System](#4-design-system)
5. [Page Structure & Sections](#5-page-structure--sections)
6. [Data Model & Persistence](#6-data-model--persistence)
7. [Feature Specifications](#7-feature-specifications)
8. [Business Rules & Analytics](#8-business-rules--analytics)
9. [DOM Element Contract](#9-dom-element-contract)
10. [JavaScript Module Map (`app.js`)](#10-javascript-module-map-appjs)
11. [User Workflows](#11-user-workflows)
12. [Browser & Dependencies](#12-browser--dependencies)
13. [Known Limitations](#13-known-limitations)
14. [Related Documents](#14-related-documents)

---

## 1. Executive Summary

SmartStock is a **single-page, client-only** retail inventory application for Lagos supermarket operations. All product data persists in **`localStorage`**; there is no backend API in this build.

The deliverable consists of two files:

| File | Responsibility |
|------|----------------|
| `index.html` | Semantic markup, embedded CSS design system, section layout, accessibility landmarks |
| `app.js` | Inventory CRUD, analytics, barcode scan/register/print, POS sync stub, KPI polling |

**Implemented capabilities:**

- Operations Command Center with **11 feature modules** (click-to-scroll navigation)
- Hero dashboard stats + rich **Add Product** form
- **Barcode scanner** (camera + manual lookup, stock ±1 from results)
- **Register by barcode** (two-step flow, duplicate prevention)
- **Barcode generator & label printer** (JsBarcode preview + `window.print()`)
- **Live inventory** with advanced query toolbar and insights panel
- **Alert ticker**, category charts, CCTV/POS integration stubs
- **8-second KPI poll** for hero stats, modules, and ticker refresh

---

## 2. Technical Stack

| Layer | Technology |
|-------|------------|
| Markup | HTML5 semantic sections |
| Styles | Embedded `<style>` in `index.html` (CSS custom properties) |
| Logic | Vanilla ES6+ JavaScript (`app.js`) |
| Persistence | `localStorage` key `smartstock_inventory_v1` |
| Barcode rendering | [JsBarcode 3.11.6](https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js) |
| Camera scan | [Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) (Chrome/Edge) |
| Fonts | Google Fonts: Familjen Grotesk (body), Oswald (display) |

---

## 3. Application Architecture

### 3.1 Initialization Flow

```
DOMContentLoaded
  → init()
      → initQueryFilters()
      → initBarcodeScanner()
      → initBarcodeRegister()
      → initBarcodePrinter()
      → initPosSync()
      → refreshAllViews()
      → setInterval(pollKPIs, 8000)
```

### 3.2 View Refresh Pipeline

`refreshAllViews()` synchronizes all UI after any data mutation:

| Function | Target |
|----------|--------|
| `renderFeatureModules()` | `#list-root` (11 module cards) |
| `renderList()` | `#inventory-list` |
| `renderInsights()` | `#insights-panel` |
| `updateHeroStats()` | `.stats-row` stat cards |
| `updateAlertTicker()` | `#alert-ticker-content` |
| `refreshPrinterAfterInventoryChange()` | `#print-product-select` options |
| `animateCharts()` | `.chart-bar` height animation |

### 3.3 State Variables (Global)

| Variable | Purpose |
|----------|---------|
| `barcodeScanActive`, `barcodeScanInterval`, `barcodeMediaStream` | Main scanner session |
| `registerScanActive`, `registerScanInterval`, `registerMediaStream` | Registration scanner |
| `lastScannedCode`, `lastScannedTime` | 2.5s debounce for duplicate scans |
| `capturedRegisterBarcode` | Locked barcode for Step 2 registration |
| `kpiPollTimer` | 8s interval handle for `pollKPIs()` |

---

## 4. Design System

### 4.1 Color Tokens (`:root`)

| Token | Hex | Usage |
|-------|-----|-------|
| `--off-black` | `#0f1108` | Dark gradients, print barcode lines |
| `--gunmetal` | `#12151a` | Page background |
| `--cassava` | `#e8eaed` | Primary text |
| `--ankara` | `#22c55e` | Success, primary green accent |
| `--ankara-dark` | `#16a34a` | Hover on green buttons |
| `--cyan` | `#22d3ee` | Brand accent, logo span, chart bars |
| `--amber` | `#f59e0b` | Warnings, ticker, expiring tags |
| `--red-ops` | `#ef4444` | Alerts, module borders |
| `--text-muted` | `#94a3b8` | Secondary copy |
| `--border` | `#2a3140` | Cards, list dividers |

Background: gunmetal with subtle dot-grid (`radial-gradient` 20px).

### 4.2 Typography

| Role | Font |
|------|------|
| Body | Familjen Grotesk |
| Display / headings | Oswald (uppercase, letter-spacing) |

### 4.3 Key UI Patterns

| Pattern | Class / Element |
|---------|-----------------|
| Sticky header | `header` with `backdrop-filter: blur(10px)` |
| Scrolling alert ticker | `.alert-ticker` + `@keyframes ticker-scroll` (40s) |
| Feature module grid | `#list-root.feature-grid` → `.feature-module` |
| Stock badges | `.stock-good` (≥ threshold), `.stock-low` (below threshold) |
| Scan highlight | `.highlight-scan` on inventory row |
| Print-only labels | `#print-sheet` visible only `@media print` |

### 4.4 Accessibility

- Skip link → `#main`
- `aria-live` on ticker, inventory list, scan results, register alerts
- `prefers-reduced-motion: reduce` collapses animations
- Keyboard: Enter on manual barcode fields; Enter on feature modules
- Landmark roles: `header`, `main`, `footer`, `nav`, `role="search"` on query toolbar

---

## 5. Page Structure & Sections

### 5.1 DOM Hierarchy (Top to Bottom)

```
<body>
  <a.skip-link>
  <header>                         → Logo + nav
  <div.alert-ticker>               → Operational alerts (marquee)
  <section.operations-hub>         → #list-root (11 modules)
  <section.hero>                   → Headline, stats, Add Product form
  <main#main>
    <section#barcode-scanner>
    <section#barcode-register>
    <section#barcode-printer>
    <div#print-sheet>              → Hidden print target
    <section#inventory>            → Query toolbar + list + insights
    <section#cctv-monitoring>       → IOVS stub
    <section#pos-sync>              → I-Class stub
    <section.how-it-works>
  </main>
  <footer>
  <script JsBarcode CDN>
  <script app.js>
</body>
```

### 5.2 Navigation (`<header>`)

| Link | Hash Target |
|------|-------------|
| Modules | `#list-root` |
| Scanner | `#barcode-scanner` |
| Register | `#barcode-register` |
| Print | `#barcode-printer` |
| Inventory | `#inventory` |
| Insights | `#insights-panel` |
| How It Works | `#how-it-works` |

---

## 6. Data Model & Persistence

### 6.1 Storage

| Key | Value |
|-----|-------|
| `smartstock_inventory_v1` | JSON array of products |
| `smartstock_pos_last_sync` | Last POS sync timestamp (string) |
| `smartstock_pos_sync` | POS status label (e.g. `Connected`) |

### 6.2 Product Schema (Enriched)

After `enrichProduct()`, each item includes:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `generateId()` → `p` + base36 timestamp + random |
| `name` | string | Required |
| `category` | string | `food`, `beverages`, `dairy`, `household` |
| `barcode` | string | Normalized; unique if non-empty |
| `sku` | string | Defaults to `barcode` or `id` |
| `price` / `sellingPrice` | number | Selling price (₦) |
| `costPrice` | number | Default ~80% of price if missing |
| `quantity` | number | ≥ 0 |
| `reorderThreshold` | number | Default **25** (`LOW_STOCK_DEFAULT`) |
| `expiryDate` | string | ISO date or empty |
| `supplier` | string | Default `—` |
| `storeBranch` | string | e.g. `lagos-main`, `ikeja`, `lekki` |
| `lastUpdated` | string | `YYYY-MM-DD` |

### 6.3 Seed Data (`INITIAL_DATA`)

Four products on first visit: Coca-Cola 50cl, Indomie Chicken, Peak Milk, Broom (Heavy Duty). Barcodes backfilled on load if missing from legacy records.

### 6.4 Constants

| Constant | Value |
|----------|-------|
| `LOW_STOCK_DEFAULT` | 25 |
| `EXPIRY_WARNING_DAYS` | 30 |
| KPI poll interval | 8000 ms |
| Scan debounce | 2500 ms |

---

## 7. Feature Specifications

### 7.1 Operations Command Center (`#list-root`)

Renders **11 clickable modules** via `renderFeatureModules()`:

| Module | `data-target` | Accent | Live stat |
|--------|---------------|--------|-----------|
| Barcode Scanner | `barcode-scanner` | cyan | Ready |
| Barcode Printer | `barcode-printer` | cyan | N tagged |
| Item Registration | `barcode-register` | red | N items |
| Expiry Alerts | `inventory` | amber | expiring count |
| Low Stock Alerts | `inventory` | amber | low stock count |
| Fast Sellers | `inventory` | green | top product name |
| Stagnant Products | `inventory` | green | stagnant count |
| Restocking Alerts | `inventory` | amber | restocking count |
| CCTV Monitoring | `cctv-monitoring` | red | Online |
| POS Sync | `pos-sync` | red | Live |
| Charts & Analytics | `insights-panel` | green | ₦Xk value |

Click or Enter scrolls smoothly to target section.

### 7.2 Hero — Stats & Add Product

**Stats** (`updateHeroStats()`):

| Card | Logic |
|------|-------|
| Total Products | `inventory.length` |
| Low Stock | `isLowStock()` count |
| Est. Daily Sales | `Σ(price × floor(qty × 0.1))` as `₦X.Xm` |

**Add Product** (`addProduct()` on `#btn-primary`):

| Field ID | Purpose |
|----------|---------|
| `input-email` | Manager email (UI only; not persisted) |
| `input-product-name` | Required name |
| `input-barcode` | Optional; duplicate check |
| `input-reg-category` | Category |
| `input-quantity` | Default 50 |
| `input-cost-price` | Cost (₦) |
| `input-selling-price` | Required price > 0 |
| `input-expiry-date` | Optional |
| `input-reorder-threshold` | Default 25 |
| `input-supplier` | Optional |

### 7.3 Barcode Scanner (`#barcode-scanner`)

| Control | ID | Behavior |
|---------|-----|----------|
| Start scan | `btn-barcode-scan` | `startBarcodeScanner()` — camera + 400ms detect loop |
| Stop | `btn-stop-scan` | `stopBarcodeScanner()` |
| Manual lookup | `btn-lookup-barcode` | `handleBarcodeLookup()` |
| Manual input | `barcode-manual-input` | Enter key triggers lookup |
| Result panel | `barcode-result-content` | Found: ±1 stock, view list; Not found: link to register |

**Camera:** `getUserMedia` environment-facing; `BarcodeDetector` formats: ean_13, ean_8, upc_a, upc_e, code_128, code_39, qr_code.

**Fallback:** If no `BarcodeDetector`, message directs user to manual entry (Chrome/Edge required for camera).

### 7.4 Register by Barcode (`#barcode-register`)

**Step 1 — Capture:**

- Camera: `btn-register-scan-start` / `btn-register-scan-stop`
- Manual: `register-barcode-input` + `btn-use-barcode`
- Display: `register-barcode-display`

**Step 2 — Details** (`register-form-panel`, enabled after valid barcode):

| Field | ID |
|-------|-----|
| Locked barcode | `reg-barcode-locked` |
| Name | `reg-product-name` |
| Category | `reg-product-category` |
| Opening stock | `reg-product-qty` |
| Price | `reg-product-price` |
| Submit | `btn-register-barcode` |

`registerProductByBarcode()` creates product, refreshes views, highlights new row, scrolls to inventory.

### 7.5 Barcode Generator & Printer (`#barcode-printer`)

| Control | ID |
|---------|-----|
| Product select | `print-product-select` |
| Name / barcode / price | `print-label-name`, `print-label-barcode`, `print-label-price` |
| Auto EAN-13 | `btn-auto-barcode` → `generateEAN13()` |
| Format | `print-barcode-format` (EAN13, CODE128) |
| Label size | `print-label-size` (small, standard, large) |
| Copies | `print-label-copies` (1–99) |
| Store name | `print-store-name` (default SmartStock) |
| Generate | `btn-generate-label` |
| Print | `btn-print-labels` |
| Print all inventory | `btn-print-all-labels` |

Preview: `#label-preview-box`, `#barcode-svg-preview`. Print builds `#print-sheet` HTML then `window.print()`.

### 7.6 Live Inventory (`#inventory`)

**Query toolbar** (`filterList()` on input/change):

| Filter | ID |
|--------|-----|
| SKU / barcode / name | `input-query-sku` |
| Category | `input-query-category` |
| Status | `input-query-status` (low, ok, expiring) |
| Date range | `input-query-range` (7, 30 days on `lastUpdated`) |
| Branch | `input-query-store` |

List: `#inventory-list`. Insights sidebar: `#insights-panel` (sticky).

Hidden legacy hooks: `#search-input`, `#category-filter` (not wired in current `app.js`).

### 7.7 Smart Insights Panel

Rendered cards:

- Low stock count
- Expiry warnings (within 30 days)
- Total inventory value (₦)
- Fastest moving (top quantity)
- Category bar chart (`#chart-bars`, animated heights)

### 7.8 Alert Ticker

`updateAlertTicker()` builds duplicated `<span>` messages for seamless CSS scroll: low stock, expiry, restock, stagnant, inventory value, POS sync status.

### 7.9 Integration Stubs

| Section | IDs | Behavior |
|---------|-----|----------|
| CCTV (IOVS) | `cctv-status`, `cctv-zones` | Static display |
| POS Sync | `btn-pos-sync`, `pos-sync-status`, `pos-last-sync` | Writes sync time to localStorage; updates ticker |

### 7.10 How It Works & Footer

Three steps: Register → Monitor → Print. Footer newsletter `input-newsletter-email` (no handler in `app.js`).

---

## 8. Business Rules & Analytics

### 8.1 Stock & Expiry

```text
isLowStock(item)     → quantity < reorderThreshold (default 25)
isExpiringSoon(item) → 0 ≤ daysUntilExpiry ≤ 30
daysUntilExpiry      → null if no expiryDate
```

### 8.2 Analytics (`getAnalytics`)

Returns: `lowStock`, `expiring`, `restocking`, `fastSellers` (top 3 by quantity), `stagnant` (qty ≥ 40 and not in top 3), `totalValue`, `sorted`.

### 8.3 Barcode Normalization

`normalizeBarcode(code)` → trim, remove whitespace.

`findProductByBarcode(code)` → exact match on normalized barcode.

### 8.4 Validation Summary

| Action | Rules |
|--------|-------|
| Add product | Name required; qty ≥ 0; price > 0; unique barcode |
| Register | Barcode captured first; name required; price > 0 |
| Stock adjust | Quantity floored at 0 |
| Print | Valid barcode required; JsBarcode must load |

---

## 9. DOM Element Contract

### 9.1 Required Hooks (Critical)

| ID | Used by |
|----|---------|
| `btn-primary` | `addProduct()` |
| `list-root` | Feature modules (not inventory list) |
| `insights-panel` | Analytics render target |
| `inventory-list` | Product rows |
| `btn-barcode-scan` | Scanner start |
| `btn-stop-scan` | Scanner stop |
| `barcode-manual-input` | Manual lookup |
| `btn-lookup-barcode` | Lookup trigger |
| `barcode-result-content` | Scan results |
| `register-form-panel` | Registration step 2 |
| `btn-register-barcode` | Submit registration |
| `print-product-select` | Label product picker |
| `print-sheet` | Print output container |
| `alert-ticker-content` | Ticker messages |

### 9.2 Full Form & Query ID List

`input-email`, `input-product-name`, `input-barcode`, `input-reg-category`, `input-quantity`, `input-cost-price`, `input-selling-price`, `input-expiry-date`, `input-reorder-threshold`, `input-supplier`, `input-query-sku`, `input-query-category`, `input-query-status`, `input-query-range`, `input-query-store`, `reg-barcode-locked`, `reg-product-name`, `reg-product-category`, `reg-product-qty`, `reg-product-price`, `register-barcode-input`, `print-label-name`, `print-label-barcode`, `print-label-price`, `print-barcode-format`, `print-label-size`, `print-label-copies`, `print-store-name`, `input-newsletter-email`.

---

## 10. JavaScript Module Map (`app.js`)

| Section | Key Functions |
|---------|---------------|
| Data | `loadData`, `saveData`, `enrichProduct`, `generateId` |
| Analytics | `getAnalytics`, `isLowStock`, `isExpiringSoon`, `daysUntilExpiry` |
| UI core | `refreshAllViews`, `renderFeatureModules`, `renderList`, `renderInsights`, `animateCharts` |
| Hero/ticker | `updateHeroStats`, `updateAlertTicker`, `pollKPIs` |
| Filters | `filterList` |
| Add product | `addProduct` |
| Scanner | `initBarcodeScanner`, `startBarcodeScanner`, `stopBarcodeScanner`, `handleBarcodeLookup`, `showBarcodeResult`, `adjustProductStock` |
| Register | `initBarcodeRegister`, `handleRegisterBarcodeCapture`, `registerProductByBarcode` |
| Printer | `initBarcodePrinter`, `generateBarcodeLabel`, `printBarcodeLabels`, `printAllInventoryLabels`, `generateEAN13` |
| POS | `initPosSync` |
| Init | `init`, `DOMContentLoaded`, `beforeunload` (stops cameras) |

**Line count:** ~1,326 lines (single file, no bundler).

---

## 11. User Workflows

### 11.1 Add Product (Hero Form)

1. Fill name, optional barcode, category, qty, prices, expiry, threshold, supplier  
2. Click **+ Add to Inventory**  
3. Product prepended; all views refresh; browser `alert` confirms  

### 11.2 Scan & Adjust Stock

1. Open Scanner → Start scan or enter barcode manually  
2. If found: use **−1** / **+1** or **View in List**  
3. If not found: **Register by Barcode** → scrolls to register section  

### 11.3 Register New SKU

1. Capture barcode (camera or type + **Use This Barcode**)  
2. Complete Step 2 form → **Register Product**  
3. Success alert in panel; inventory scroll  

### 11.4 Print Shelf Label

1. Select product or enter custom fields  
2. **Generate Label** → preview SVG barcode  
3. **Print Labels** or **Print All Inventory**  

---

## 12. Browser & Dependencies

| Capability | Requirement |
|------------|-------------|
| Core app | Any modern browser with localStorage |
| Camera barcode scan | Chrome or Edge (`BarcodeDetector`) |
| Label barcodes | Network access for JsBarcode CDN |
| Print | Browser print dialog |

**External script:**

```html
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script src="app.js"></script>
```

---

## 13. Known Limitations

| Area | Limitation |
|------|------------|
| Persistence | Browser-local only; no multi-device sync |
| Auth | No login; `input-email` not saved |
| POS/CCTV | UI stubs only |
| Daily sales stat | Simulated formula, not real POS data |
| Fast movers | Ranked by current quantity, not sales velocity |
| Newsletter | Footer subscribe button has no handler |
| Manager email | Collected in UI but not stored |

---

## 14. Related Documents

| Document | Relationship |
|----------|--------------|
| `PRD-SmartStock-Complete.md` | Earlier master PRD (partially superseded by this snapshot) |
| `PRD-Landing-Page-UI.md` | Original landing-page ID contract (evolved) |
| `PRD-Smart-Supermarket-Inventory-Management.md` | Full platform vision |
| `PRD-IoT-Object-Verification-System.md` | CCTV / IOVS blueprint |

---

## 15. Conclusion

This PRD is the **authoritative as-built specification** for the current `index.html` and `app.js` SmartStock client. Treat the **DOM IDs**, **localStorage key**, and **11-module operations hub** as the integration contract for any backend, POS, or mobile wrapper work.

---

*End of Document — Generated from source snapshot May 23, 2026*

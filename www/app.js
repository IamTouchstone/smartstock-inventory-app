// app.js - SmartStock Inventory Management (Client-side only)
const STORAGE_KEY = 'smartstock_inventory_v1';
const POS_SYNC_KEY = 'smartstock_pos_sync';
const POS_LAST_SYNC_KEY = 'smartstock_pos_last_sync';
const CCTV_EVENT_KEY = 'smartstock_cctv_event';

// Sample initial data (used only if localStorage is empty)
const INITIAL_DATA = [
    {
        id: 'p1',
        name: 'Coca-Cola 50cl',
        category: 'beverages',
        barcode: '5449000000996',
        sku: '5449000000996',
        price: 350,
        costPrice: 280,
        quantity: 124,
        reorderThreshold: 25,
        expiryDate: '2026-11-15',
        supplier: 'Coca-Cola NG',
        storeBranch: 'lagos-main',
        lastUpdated: '2026-05-22'
    },
    {
        id: 'p2',
        name: 'Indomie Chicken',
        category: 'food',
        barcode: '8901234567890',
        sku: '8901234567890',
        price: 150,
        costPrice: 120,
        quantity: 18,
        reorderThreshold: 25,
        expiryDate: '2026-08-01',
        supplier: 'Dufil Prima',
        storeBranch: 'ikeja',
        lastUpdated: '2026-05-21'
    },
    {
        id: 'p3',
        name: 'Peak Milk (Tin)',
        category: 'dairy',
        barcode: '5060123456789',
        sku: '5060123456789',
        price: 1200,
        costPrice: 980,
        quantity: 87,
        reorderThreshold: 30,
        expiryDate: '2026-07-20',
        supplier: ' FrieslandCampina',
        storeBranch: 'lagos-main',
        lastUpdated: '2026-05-22'
    },
    {
        id: 'p4',
        name: 'Broom (Heavy Duty)',
        category: 'household',
        barcode: '1234567890123',
        sku: '1234567890123',
        price: 850,
        costPrice: 600,
        quantity: 42,
        reorderThreshold: 15,
        expiryDate: '',
        supplier: 'Local Wholesale',
        storeBranch: 'lekki',
        lastUpdated: '2026-05-20'
    }
];

const LOW_STOCK_DEFAULT = 25;
const EXPIRY_WARNING_DAYS = 30;
let kpiPollTimer = null;

function enrichProduct(item) {
    const price = item.sellingPrice ?? item.price ?? 0;
    const threshold = item.reorderThreshold ?? LOW_STOCK_DEFAULT;
    return {
        ...item,
        price,
        sellingPrice: price,
        costPrice: item.costPrice ?? Math.max(1, Math.floor(price * 0.8)),
        barcode: item.barcode || '',
        sku: item.sku || item.barcode || item.id,
        reorderThreshold: threshold,
        expiryDate: item.expiryDate || '',
        supplier: item.supplier || '—',
        storeBranch: item.storeBranch || 'lagos-main'
    };
}

function daysUntilExpiry(dateStr) {
    if (!dateStr) return null;
    const exp = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function isLowStock(item) {
    return item.quantity < (item.reorderThreshold ?? LOW_STOCK_DEFAULT);
}

function isExpiringSoon(item) {
    const days = daysUntilExpiry(item.expiryDate);
    return days !== null && days >= 0 && days <= EXPIRY_WARNING_DAYS;
}

function getAnalytics(inventory) {
    const lowStock = inventory.filter(isLowStock);
    const expiring = inventory.filter(isExpiringSoon);
    const restocking = inventory.filter(p => p.quantity < (p.reorderThreshold ?? LOW_STOCK_DEFAULT));
    const sorted = [...inventory].sort((a, b) => b.quantity - a.quantity);
    const fastSellers = sorted.slice(0, 3);
    const stagnant = inventory.filter(p => p.quantity >= 40 && !fastSellers.includes(p));
    const totalValue = inventory.reduce((s, p) => s + p.price * p.quantity, 0);
    return { lowStock, expiring, restocking, fastSellers, stagnant, totalValue, sorted };
}

// Barcode scanner state
let barcodeScanActive = false;
let barcodeScanInterval = null;
let barcodeMediaStream = null;
let lastScannedCode = '';
let lastScannedTime = 0;

// Barcode registration state
let registerScanActive = false;
let registerScanInterval = null;
let registerMediaStream = null;
let capturedRegisterBarcode = '';

// Load data from localStorage
function loadData() {
    let data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
        data = INITIAL_DATA.map(enrichProduct);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
        data = JSON.parse(data);
        const barcodeById = Object.fromEntries(
            INITIAL_DATA.filter(p => p.barcode).map(p => [p.id, p.barcode])
        );
        data = data.map(item => enrichProduct({
            ...item,
            barcode: item.barcode || barcodeById[item.id] || ''
        }));
    }
    return data;
}

function normalizeBarcode(code) {
    return String(code || '').trim().replace(/\s/g, '');
}

function findProductByBarcode(code) {
    const normalized = normalizeBarcode(code);
    if (!normalized) return null;
    return loadData().find(item => normalizeBarcode(item.barcode) === normalized) || null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Save data to localStorage
function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getToday() {
    return new Date().toISOString().split('T')[0];
}

// Generate unique ID
function generateId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

// Add new product
function addProduct() {
    const nameInput = document.getElementById('input-product-name');
    const qtyInput = document.getElementById('input-quantity');
    const priceInput = document.getElementById('input-selling-price');
    const costInput = document.getElementById('input-cost-price');
    const categorySelect = document.getElementById('input-reg-category');
    const barcodeInput = document.getElementById('input-barcode');
    const expiryInput = document.getElementById('input-expiry-date');
    const thresholdInput = document.getElementById('input-reorder-threshold');
    const supplierInput = document.getElementById('input-supplier');

    const name = nameInput.value.trim();
    const quantity = parseInt(qtyInput.value) || 0;
    const price = parseInt(priceInput.value) || 0;
    const costPrice = parseInt(costInput?.value) || Math.floor(price * 0.8);
    const category = categorySelect.value;
    const barcode = normalizeBarcode(barcodeInput ? barcodeInput.value : '');
    const expiryDate = expiryInput?.value || '';
    const reorderThreshold = parseInt(thresholdInput?.value) || LOW_STOCK_DEFAULT;
    const supplier = supplierInput?.value.trim() || '';

    if (!name) {
        alert("Product name is required!");
        nameInput.focus();
        return;
    }
    if (quantity < 0 || price <= 0) {
        alert("Please enter valid quantity and price.");
        return;
    }

    const inventory = loadData();

    if (barcode && inventory.some(item => normalizeBarcode(item.barcode) === barcode)) {
        alert('A product with this barcode already exists.');
        if (barcodeInput) barcodeInput.focus();
        return;
    }

    const newProduct = enrichProduct({
        id: generateId(),
        name: name,
        category: category,
        barcode: barcode,
        sku: barcode || generateId(),
        price: price,
        costPrice: costPrice,
        quantity: quantity,
        expiryDate,
        reorderThreshold,
        supplier,
        storeBranch: document.getElementById('input-query-store')?.value || 'lagos-main',
        lastUpdated: getToday()
    });

    inventory.unshift(newProduct); // Add to top
    saveData(inventory);

    // Clear form
    nameInput.value = '';
    qtyInput.value = '50';
    priceInput.value = '';
    if (barcodeInput) barcodeInput.value = '';
    if (expiryInput) expiryInput.value = '';
    if (supplierInput) supplierInput.value = '';
    if (costInput) costInput.value = '';

    refreshAllViews();

    alert(`✅ ${name} added successfully!`);
}

function refreshAllViews() {
    renderFeatureModules();
    renderList();
    renderInsights();
    updateHeroStats();
    updateAlertTicker();
    refreshPrinterAfterInventoryChange();
    updateDataTools();
    updateOperationalStatus();
    animateCharts();
}

// Render 11 feature modules into #list-root
function renderFeatureModules() {
    const listRoot = document.getElementById('list-root');
    if (!listRoot) return;

    const inventory = loadData();
    const a = getAnalytics(inventory);

    const modules = [
        { id: 'barcode-scanner', mod: 'mod-cyan', title: 'Barcode Scanner', desc: 'Camera + manual lookup', stat: 'Ready', statClass: '' },
        { id: 'barcode-printer', mod: 'mod-cyan', title: 'Barcode Printer', desc: 'Generate & print labels', stat: inventory.filter(p => p.barcode).length + ' tagged', statClass: '' },
        { id: 'barcode-register', mod: 'mod-red', title: 'Item Registration', desc: 'Register by barcode', stat: inventory.length + ' items', statClass: '' },
        { id: 'inventory', mod: 'mod-amber', title: 'Expiry Alerts', desc: 'Within ' + EXPIRY_WARNING_DAYS + ' days', stat: a.expiring.length, statClass: a.expiring.length ? 'warn' : '' },
        { id: 'inventory', mod: 'mod-amber', title: 'Low Stock Alerts', desc: 'Below reorder threshold', stat: a.lowStock.length, statClass: a.lowStock.length ? 'alert' : '' },
        { id: 'inventory', mod: 'mod-green', title: 'Fast Sellers', desc: 'Top movers by stock', stat: a.fastSellers[0]?.name?.slice(0, 12) || '—', statClass: '' },
        { id: 'inventory', mod: 'mod-green', title: 'Stagnant Products', desc: 'High stock, slow movement', stat: a.stagnant.length, statClass: a.stagnant.length ? 'warn' : '' },
        { id: 'inventory', mod: 'mod-amber', title: 'Restocking Alerts', desc: 'Reorder recommended', stat: a.restocking.length, statClass: a.restocking.length ? 'warn' : '' },
        { id: 'cctv-monitoring', mod: 'mod-red', title: 'CCTV Monitoring', desc: 'IOVS sensor fusion', stat: 'Online', statClass: '' },
        { id: 'pos-sync', mod: 'mod-red', title: 'POS Sync', desc: 'I-Class integration', stat: 'Live', statClass: '' },
        { id: 'insights-panel', mod: 'mod-green', title: 'Charts & Analytics', desc: 'KPIs + category charts', stat: '₦' + (a.totalValue / 1000).toFixed(0) + 'k', statClass: '' }
    ];

    listRoot.innerHTML = modules.map(m => `
        <li class="feature-module ${m.mod}" data-target="${m.id}" tabindex="0" role="button" aria-label="${m.title}">
            <h4>${m.title}</h4>
            <p>${m.desc}</p>
            <div class="module-stat ${m.statClass}">${escapeHtml(String(m.stat))}</div>
        </li>
    `).join('');

    listRoot.querySelectorAll('.feature-module').forEach(el => {
        const go = () => document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: 'smooth' });
        el.addEventListener('click', go);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
}

// Render inventory list
function renderList(filteredData = null) {
    const listRoot = document.getElementById('inventory-list');
    if (!listRoot) return;
    const inventory = filteredData || loadData();

    listRoot.innerHTML = '';

    if (inventory.length === 0) {
        listRoot.innerHTML = `
            <li style="padding: 3rem 1.5rem; text-align: center; color: #64748b;">
                <p>No products found.</p>
                <p style="font-size: 0.9rem; margin-top: 8px;">Add your first item above.</p>
            </li>
        `;
        return;
    }

    inventory.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-item';

        const lowStockFlag = isLowStock(item);
        const expDays = daysUntilExpiry(item.expiryDate);
        const expiringTag = expDays !== null && expDays <= EXPIRY_WARNING_DAYS
            ? ` <span style="color:var(--amber);font-size:0.7rem;">⏱ ${expDays}d</span>` : '';

        const barcodeLine = item.barcode
            ? `<span class="result-barcode" style="font-size:0.75rem;">${escapeHtml(item.barcode)}</span> • `
            : '';

        li.innerHTML = `
            <div class="item-info">
                <h4>${escapeHtml(item.name)}</h4>
                <p>${barcodeLine}${item.category.charAt(0).toUpperCase() + item.category.slice(1)} • ₦ ${item.price}${expiringTag}</p>
            </div>
            <div style="text-align: right;">
                <span class="stock-badge ${lowStockFlag ? 'stock-low' : 'stock-good'}">
                    ${item.quantity}
                </span>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
                    ${item.lastUpdated}
                </div>
            </div>
        `;
        listRoot.appendChild(li);
    });
}

// Render Smart Insights + Charts
function renderInsights() {
    const panel = document.getElementById('insights-panel');
    if (!panel) return;
    const inventory = loadData();
    const a = getAnalytics(inventory);
    const topSeller = a.fastSellers[0];

    const catTotals = {};
    inventory.forEach(item => {
        catTotals[item.category] = (catTotals[item.category] || 0) + item.quantity;
    });
    const chartCats = Object.keys(catTotals).slice(0, 5);
    const maxCat = Math.max(...Object.values(catTotals), 1);

    const insightsHTML = `
        <div class="insights-header">
            <h3>🧠 Smart Insights</h3>
            <span style="background: rgba(34,197,94,0.2); color: #22c55e; padding: 4px 10px; border-radius: 9999px; font-size: 0.75rem;">LIVE</span>
        </div>

        <div class="insight-card">
            <strong>Low Stock Alert</strong>
            <p style="margin-top: 4px; font-size: 0.9rem;">${a.lowStock.length} products need immediate restocking.</p>
        </div>

        <div class="insight-card">
            <strong>Expiry Alerts</strong>
            <p style="margin-top: 4px; font-size: 0.9rem;">${a.expiring.length} products expiring within ${EXPIRY_WARNING_DAYS} days.</p>
        </div>

        <div class="insight-card">
            <strong>Inventory Value</strong>
            <p style="margin-top: 4px; font-size: 0.9rem;">Total stock worth ₦${a.totalValue.toLocaleString()}</p>
        </div>

        ${topSeller ? `
        <div class="insight-card">
            <strong>Fastest Moving</strong>
            <p style="margin-top: 4px; font-size: 0.9rem;">${escapeHtml(topSeller.name)} (${topSeller.quantity} units)</p>
        </div>` : ''}

        <div class="charts-panel" id="charts-panel">
            <h4>Charts &amp; Analytics</h4>
            <div class="chart-bars" id="chart-bars">
                ${chartCats.map(cat => `
                    <div class="chart-bar-wrap">
                        <div class="chart-bar" data-height="${Math.round((catTotals[cat] / maxCat) * 100)}" style="height:0"></div>
                        <span class="chart-bar-label">${cat.slice(0, 4)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    panel.innerHTML = insightsHTML;
    requestAnimationFrame(animateCharts);
}

function animateCharts() {
    document.querySelectorAll('.chart-bar').forEach(bar => {
        const h = bar.getAttribute('data-height') || '0';
        bar.style.height = '0';
        requestAnimationFrame(() => { bar.style.height = h + '%'; });
    });
}

function updateAlertTicker() {
    const el = document.getElementById('alert-ticker-content');
    if (!el) return;
    const inventory = loadData();
    const a = getAnalytics(inventory);
    const msgs = [
        `${a.lowStock.length} low-stock alert(s) active`,
        `${a.expiring.length} expiry warning(s)`,
        `${a.restocking.length} restock recommendation(s)`,
        `${a.stagnant.length} stagnant product(s) flagged`,
        `Inventory value ₦${a.totalValue.toLocaleString()}`,
        `POS sync: ${localStorage.getItem(POS_SYNC_KEY) || 'Connected'}`
    ];
    const doubled = [...msgs, ...msgs].map(m => `<span>${escapeHtml(m)}</span>`).join('');
    el.innerHTML = doubled;
}

function pollKPIs() {
    updateHeroStats();
    renderFeatureModules();
    updateAlertTicker();
    const syncEl = document.getElementById('pos-last-sync');
    if (syncEl) {
        syncEl.textContent = localStorage.getItem(POS_LAST_SYNC_KEY) || new Date().toLocaleTimeString();
    }
}

// Update quick stats in hero
function updateHeroStats() {
    const inventory = loadData();

    const totalProducts = inventory.length;
    const lowStock = inventory.filter(isLowStock).length;
    let totalValueToday = inventory.reduce((sum, item) => sum + (item.price * Math.floor(item.quantity * 0.1)), 0); // Simulated daily sales

    // Note: In real version these would be more sophisticated
    document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = totalProducts;
    document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = lowStock;
    document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = '₦' + (totalValueToday / 1000000).toFixed(1) + 'm';
}

// Filter list based on query toolbar
function filterList() {
    const sku = (document.getElementById('input-query-sku')?.value || '').toLowerCase().trim();
    const categoryFilter = document.getElementById('input-query-category')?.value || '';
    const statusFilter = document.getElementById('input-query-status')?.value || '';
    const rangeFilter = document.getElementById('input-query-range')?.value || '';
    const storeFilter = document.getElementById('input-query-store')?.value || '';

    const inventory = loadData();
    const rangeDays = parseInt(rangeFilter) || 0;
    const cutoff = rangeDays ? new Date(Date.now() - rangeDays * 86400000) : null;

    let filtered = inventory.filter(item => {
        const matchesSku = !sku || item.name.toLowerCase().includes(sku)
            || (item.barcode && item.barcode.includes(sku))
            || (item.sku && String(item.sku).toLowerCase().includes(sku));
        const matchesCategory = !categoryFilter || item.category === categoryFilter;
        const matchesStore = !storeFilter || item.storeBranch === storeFilter;
        let matchesStatus = true;
        if (statusFilter === 'low') matchesStatus = isLowStock(item);
        else if (statusFilter === 'ok') matchesStatus = !isLowStock(item);
        else if (statusFilter === 'expiring') matchesStatus = isExpiringSoon(item);
        let matchesRange = true;
        if (cutoff && item.lastUpdated) {
            matchesRange = new Date(item.lastUpdated) >= cutoff;
        }
        return matchesSku && matchesCategory && matchesStore && matchesStatus && matchesRange;
    });

    renderList(filtered);
}

// --- Barcode Scanner ---

function showBarcodeResult(code, product) {
    const container = document.getElementById('barcode-result-content');
    if (!container) return;

    if (product) {
        const low = isLowStock(product);
        container.className = 'found';
        container.innerHTML = `
            <p style="color:#10b981;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;">Product Found</p>
            <div class="result-product-name">${escapeHtml(product.name)}</div>
            <div class="result-barcode">${escapeHtml(code)}</div>
            <p style="margin-top:0.75rem;">
                ${product.category.charAt(0).toUpperCase() + product.category.slice(1)} •
                ₦${product.price} •
                <strong style="color:${low ? '#f87171' : '#10b981'}">${product.quantity} in stock</strong>
            </p>
            <div class="result-actions">
                <button type="button" data-action="stock-minus" data-id="${product.id}">−1 Stock</button>
                <button type="button" data-action="stock-plus" data-id="${product.id}">+1 Stock</button>
                <button type="button" data-action="view-inventory">View in List</button>
            </div>
        `;
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => handleBarcodeResultAction(btn.dataset.action, product.id));
        });
        highlightProductInList(product.id);
    } else {
        container.className = '';
        container.innerHTML = `
            <p style="color:#fbbf24;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;">Not in Inventory</p>
            <div class="result-barcode" style="margin:0.75rem 0;">${escapeHtml(code)}</div>
            <p>No product matches this barcode. Add it using the form above.</p>
            <div class="result-actions">
                <button type="button" data-action="prefill-form">Register by Barcode</button>
            </div>
        `;
        container.querySelector('[data-action="prefill-form"]')
            ?.addEventListener('click', () => prefillAddFormFromBarcode(code));
    }
}

function handleBarcodeResultAction(action, productId) {
    if (action === 'stock-plus') adjustProductStock(productId, 1);
    else if (action === 'stock-minus') adjustProductStock(productId, -1);
    else if (action === 'view-inventory') {
        document.getElementById('inventory')?.scrollIntoView({ behavior: 'smooth' });
        highlightProductInList(productId);
    }
}

function adjustProductStock(productId, delta) {
    const inventory = loadData();
    const item = inventory.find(p => p.id === productId);
    if (!item) return;

    item.quantity = Math.max(0, item.quantity + delta);
    item.lastUpdated = getToday();
    saveData(inventory);

    refreshAllViews();

    const code = item.barcode || '';
    if (code) handleBarcodeLookup(code);
    else showBarcodeResult('', item);
}

function highlightProductInList(productId) {
    document.querySelectorAll('#inventory-list .list-item').forEach(li => li.classList.remove('highlight-scan'));
    const items = document.querySelectorAll('#inventory-list .list-item');
    const inventory = loadData();
    const index = inventory.findIndex(p => p.id === productId);
    if (index >= 0 && items[index]) {
        items[index].classList.add('highlight-scan');
        items[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function prefillAddFormFromBarcode(code) {
    const section = document.getElementById('barcode-register');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        const regInput = document.getElementById('register-barcode-input');
        if (regInput) regInput.value = code;
        handleRegisterBarcodeCapture(code);
        return;
    }
    const barcodeInput = document.getElementById('product-barcode');
    const manualInput = document.getElementById('barcode-manual-input');
    if (barcodeInput) barcodeInput.value = code;
    if (manualInput) manualInput.value = code;
    document.getElementById('product-name')?.focus();
    document.querySelector('.hero')?.scrollIntoView({ behavior: 'smooth' });
}

function handleBarcodeLookup(code) {
    const normalized = normalizeBarcode(code);
    if (!normalized) {
        alert('Please enter or scan a valid barcode.');
        return;
    }

    const manualInput = document.getElementById('barcode-manual-input');
    if (manualInput) manualInput.value = normalized;

    const product = findProductByBarcode(normalized);
    showBarcodeResult(normalized, product);

    if (!product) {
        // Don't auto-jump on lookup; user can click Register by Barcode
    }
}

function onBarcodeDetected(code) {
    const normalized = normalizeBarcode(code);
    if (!normalized) return;

    const now = Date.now();
    if (normalized === lastScannedCode && now - lastScannedTime < 2500) return;
    lastScannedCode = normalized;
    lastScannedTime = now;

    handleBarcodeLookup(normalized);
}

async function startBarcodeScanner() {
    if (barcodeScanActive) return;

    const video = document.getElementById('barcode-video');
    const viewport = document.getElementById('scanner-viewport');
    const placeholder = document.getElementById('scanner-placeholder');
    const btnStart = document.getElementById('btn-barcode-scan') || document.getElementById('btn-start-scan');
    const btnStop = document.getElementById('btn-stop-scan');

    if (!('BarcodeDetector' in window)) {
        const msg = document.getElementById('scanner-support-msg');
        if (msg) {
            msg.textContent = 'Camera scan needs Chrome or Edge. Use manual entry below, or open in a supported browser.';
        }
        return;
    }

    try {
        barcodeMediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        video.srcObject = barcodeMediaStream;
        await video.play();

        video.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        viewport?.classList.add('scanning');

        const detector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });

        barcodeScanActive = true;
        if (btnStart) btnStart.disabled = true;
        if (btnStop) btnStop.disabled = false;

        barcodeScanInterval = setInterval(async () => {
            if (!barcodeScanActive || video.readyState < 2) return;
            try {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) onBarcodeDetected(barcodes[0].rawValue);
            } catch (err) {
                console.warn('Barcode detect:', err);
            }
        }, 400);
    } catch (err) {
        alert('Camera access denied or unavailable. Use manual barcode entry instead.');
        console.error(err);
        stopBarcodeScanner();
    }
}

function stopBarcodeScanner() {
    barcodeScanActive = false;

    if (barcodeScanInterval) {
        clearInterval(barcodeScanInterval);
        barcodeScanInterval = null;
    }

    if (barcodeMediaStream) {
        barcodeMediaStream.getTracks().forEach(track => track.stop());
        barcodeMediaStream = null;
    }

    const video = document.getElementById('barcode-video');
    const viewport = document.getElementById('scanner-viewport');
    const placeholder = document.getElementById('scanner-placeholder');
    const btnStart = document.getElementById('btn-barcode-scan') || document.getElementById('btn-start-scan');
    const btnStop = document.getElementById('btn-stop-scan');

    if (video) {
        video.srcObject = null;
        video.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'flex';
    viewport?.classList.remove('scanning');
    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;
}

// --- Register Product by Barcode ---

function setRegisterAlert(type, message) {
    const alert = document.getElementById('register-alert');
    if (!alert) return;
    alert.className = 'register-alert visible' + (type ? ' ' + type : '');
    alert.textContent = message;
}

function clearRegisterAlert() {
    const alert = document.getElementById('register-alert');
    if (!alert) return;
    alert.className = 'register-alert';
    alert.textContent = '';
}

function setRegisterStep(step) {
    const s1 = document.getElementById('reg-step-1');
    const s2 = document.getElementById('reg-step-2');
    if (s1) s1.classList.toggle('active', step === 1);
    if (s2) s2.classList.toggle('active', step === 2);
}

function enableRegisterForm(barcode) {
    const panel = document.getElementById('register-form-panel');
    const locked = document.getElementById('reg-barcode-locked');
    const btn = document.getElementById('btn-register-barcode');
    const display = document.getElementById('register-barcode-display');

    capturedRegisterBarcode = barcode;

    if (display) {
        display.textContent = barcode;
        display.classList.remove('empty');
    }
    if (locked) locked.value = barcode;
    if (panel) panel.classList.remove('disabled');
    if (btn) btn.disabled = false;
    setRegisterStep(2);
    clearRegisterAlert();
    document.getElementById('reg-product-name')?.focus();
}

function disableRegisterForm() {
    const panel = document.getElementById('register-form-panel');
    const locked = document.getElementById('reg-barcode-locked');
    const btn = document.getElementById('btn-register-barcode');
    const display = document.getElementById('register-barcode-display');

    capturedRegisterBarcode = '';

    if (display) {
        display.textContent = 'No barcode captured yet';
        display.classList.add('empty');
    }
    if (locked) locked.value = '';
    if (panel) panel.classList.add('disabled');
    if (btn) btn.disabled = true;
    setRegisterStep(1);
}

function handleRegisterBarcodeCapture(code) {
    const normalized = normalizeBarcode(code);
    if (!normalized) {
        setRegisterAlert('error', 'Please enter or scan a valid barcode.');
        return;
    }

    const input = document.getElementById('register-barcode-input');
    if (input) input.value = normalized;

    const existing = findProductByBarcode(normalized);
    if (existing) {
        setRegisterAlert('warning', `"${existing.name}" is already registered with this barcode.`);
        disableRegisterForm();
        const display = document.getElementById('register-barcode-display');
        if (display) {
            display.textContent = normalized + ' (already registered)';
            display.classList.remove('empty');
        }
        return;
    }

    enableRegisterForm(normalized);
    setRegisterAlert('success', 'Barcode ready. Enter product details and click Register Product.');
}

function registerProductByBarcode() {
    const barcode = normalizeBarcode(capturedRegisterBarcode);
    const nameInput = document.getElementById('reg-product-name');
    const qtyInput = document.getElementById('reg-product-qty');
    const priceInput = document.getElementById('reg-product-price');
    const costInput = document.getElementById('reg-product-cost');
    const expiryInput = document.getElementById('reg-product-expiry');
    const thresholdInput = document.getElementById('reg-product-threshold');
    const supplierInput = document.getElementById('reg-product-supplier');
    const branchSelect = document.getElementById('reg-product-branch');
    const categorySelect = document.getElementById('reg-product-category');

    if (!barcode) {
        setRegisterAlert('error', 'Capture a barcode first (Step 1).');
        return;
    }

    const name = nameInput?.value.trim() || '';
    const quantity = parseInt(qtyInput?.value) || 0;
    const price = parseInt(priceInput?.value) || 0;
    const costPrice = parseInt(costInput?.value) || Math.max(1, Math.floor(price * 0.8));
    const reorderThreshold = parseInt(thresholdInput?.value) || LOW_STOCK_DEFAULT;
    const category = categorySelect?.value || 'food';

    if (!name) {
        setRegisterAlert('error', 'Product name is required.');
        nameInput?.focus();
        return;
    }
    if (quantity < 0 || price <= 0) {
        setRegisterAlert('error', 'Enter a valid opening stock and price.');
        return;
    }

    const inventory = loadData();
    if (inventory.some(item => normalizeBarcode(item.barcode) === barcode)) {
        setRegisterAlert('warning', 'This barcode is already registered.');
        return;
    }

    const newProduct = enrichProduct({
        id: generateId(),
        name,
        category,
        barcode,
        sku: barcode,
        price,
        costPrice,
        quantity,
        expiryDate: expiryInput?.value || '',
        reorderThreshold,
        supplier: supplierInput?.value.trim() || '',
        storeBranch: branchSelect?.value || 'lagos-main',
        lastUpdated: getToday()
    });

    inventory.unshift(newProduct);
    saveData(inventory);

    if (nameInput) nameInput.value = '';
    if (qtyInput) qtyInput.value = '50';
    if (priceInput) priceInput.value = '';
    if (costInput) costInput.value = '';
    if (expiryInput) expiryInput.value = '';
    if (supplierInput) supplierInput.value = '';
    if (thresholdInput) thresholdInput.value = LOW_STOCK_DEFAULT;
    const regInput = document.getElementById('register-barcode-input');
    if (regInput) regInput.value = '';

    disableRegisterForm();
    setRegisterAlert('success', `✅ "${name}" registered with barcode ${barcode}.`);

    refreshAllViews();
    highlightProductInList(newProduct.id);

    setTimeout(() => {
        document.getElementById('inventory')?.scrollIntoView({ behavior: 'smooth' });
    }, 400);
}

function onRegisterBarcodeDetected(code) {
    const normalized = normalizeBarcode(code);
    if (!normalized) return;

    const now = Date.now();
    if (normalized === lastScannedCode && now - lastScannedTime < 2500) return;
    lastScannedCode = normalized;
    lastScannedTime = now;

    stopRegisterBarcodeScanner();
    handleRegisterBarcodeCapture(normalized);
}

async function startRegisterBarcodeScanner() {
    if (registerScanActive) return;

    const video = document.getElementById('register-barcode-video');
    const placeholder = document.getElementById('register-placeholder');
    const btnStart = document.getElementById('btn-register-scan-start');
    const btnStop = document.getElementById('btn-register-scan-stop');
    const msg = document.getElementById('register-scan-msg');

    if (!('BarcodeDetector' in window)) {
        if (msg) msg.textContent = 'Camera scan needs Chrome or Edge. Type the barcode manually instead.';
        return;
    }

    try {
        registerMediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        video.srcObject = registerMediaStream;
        await video.play();
        video.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';

        const detector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });

        registerScanActive = true;
        if (btnStart) btnStart.disabled = true;
        if (btnStop) btnStop.disabled = false;
        if (msg) msg.textContent = 'Point camera at product barcode…';

        registerScanInterval = setInterval(async () => {
            if (!registerScanActive || video.readyState < 2) return;
            try {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) onRegisterBarcodeDetected(barcodes[0].rawValue);
            } catch (err) {
                console.warn('Register barcode detect:', err);
            }
        }, 400);
    } catch (err) {
        if (msg) msg.textContent = 'Camera unavailable. Enter barcode manually.';
        console.error(err);
        stopRegisterBarcodeScanner();
    }
}

function stopRegisterBarcodeScanner() {
    registerScanActive = false;

    if (registerScanInterval) {
        clearInterval(registerScanInterval);
        registerScanInterval = null;
    }

    if (registerMediaStream) {
        registerMediaStream.getTracks().forEach(track => track.stop());
        registerMediaStream = null;
    }

    const video = document.getElementById('register-barcode-video');
    const placeholder = document.getElementById('register-placeholder');
    const btnStart = document.getElementById('btn-register-scan-start');
    const btnStop = document.getElementById('btn-register-scan-stop');

    if (video) {
        video.srcObject = null;
        video.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'flex';
    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;
}

function resetRegisterSection() {
    stopRegisterBarcodeScanner();
    disableRegisterForm();
    clearRegisterAlert();
    const input = document.getElementById('register-barcode-input');
    if (input) input.value = '';
    const nameInput = document.getElementById('reg-product-name');
    const priceInput = document.getElementById('reg-product-price');
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
}

function initBarcodeRegister() {
    const btnUse = document.getElementById('btn-use-barcode');
    const btnRegister = document.getElementById('btn-register-barcode');
    const regInput = document.getElementById('register-barcode-input');
    const btnStart = document.getElementById('btn-register-scan-start');
    const btnStop = document.getElementById('btn-register-scan-stop');
    const msg = document.getElementById('register-scan-msg');

    if (btnUse) {
        btnUse.addEventListener('click', () => {
            handleRegisterBarcodeCapture(regInput?.value || '');
        });
    }
    if (regInput) {
        regInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleRegisterBarcodeCapture(regInput.value);
        });
    }
    if (btnRegister) btnRegister.addEventListener('click', registerProductByBarcode);
    if (btnStart) btnStart.addEventListener('click', startRegisterBarcodeScanner);
    if (btnStop) btnStop.addEventListener('click', stopRegisterBarcodeScanner);

    if (msg) {
        if ('BarcodeDetector' in window) {
            msg.textContent = 'Scan a barcode, then fill in name, category, price, and stock.';
        } else {
            msg.textContent = 'Type a barcode and click Use This Barcode to continue.';
        }
    }

    disableRegisterForm();
}

function initBarcodeScanner() {
    const btnStart = document.getElementById('btn-barcode-scan') || document.getElementById('btn-start-scan');
    const btnStop = document.getElementById('btn-stop-scan');
    const btnLookup = document.getElementById('btn-lookup-barcode');
    const manualInput = document.getElementById('barcode-manual-input');
    const msg = document.getElementById('scanner-support-msg');

    if (btnStart) btnStart.addEventListener('click', startBarcodeScanner);
    if (btnStop) btnStop.addEventListener('click', stopBarcodeScanner);
    if (btnLookup) {
        btnLookup.addEventListener('click', () => {
            handleBarcodeLookup(manualInput?.value || '');
        });
    }
    if (manualInput) {
        manualInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleBarcodeLookup(manualInput.value);
        });
    }

    if (msg) {
        if ('BarcodeDetector' in window) {
            msg.textContent = 'Camera scanning supported. Click Start Scan and point at a product barcode.';
        } else {
            msg.textContent = 'Manual entry works in all browsers. Camera scan requires Chrome or Edge.';
        }
    }
}

// --- Barcode Generator & Label Printer ---

function generateEAN13() {
    let base = '200';
    for (let i = 0; i < 9; i++) base += Math.floor(Math.random() * 10);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    return base + check;
}

function getPrintLabelSizeClass() {
    const size = document.getElementById('print-label-size')?.value || 'standard';
    return 'size-' + size;
}

function renderBarcodeOnSvg(svgEl, code, format) {
    if (!svgEl) return false;
    const fmt = format === 'EAN13' ? 'EAN13' : 'CODE128';
    let value = normalizeBarcode(code);
    if (!value) return false;

    if (fmt === 'EAN13') {
        value = value.replace(/\D/g, '');
        if (value.length === 12) {
            // JsBarcode calculates check digit from 12 digits
        } else if (value.length === 13) {
            value = value.slice(0, 12);
        } else if (value.length < 12) {
            value = value.padStart(12, '0').slice(-12);
        } else {
            value = value.slice(0, 12);
        }
    }

    if (typeof JsBarcode !== 'undefined') {
        try {
            JsBarcode(svgEl, value, {
                format: fmt,
                width: fmt === 'EAN13' ? 2 : 2,
                height: 60,
                displayValue: true,
                fontSize: 14,
                margin: 8,
                background: '#ffffff',
                lineColor: '#0f1108'
            });
            return true;
        } catch (err) {
            console.warn('JsBarcode error:', err);
        }
    }

    renderFallbackBarcode(svgEl, value, fmt);
    return true;
}

function renderFallbackBarcode(svgEl, value, format) {
    const width = 260;
    const height = 92;
    const clean = String(value || '').toUpperCase();
    svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svgEl.setAttribute('width', width);
    svgEl.setAttribute('height', height);
    svgEl.innerHTML = '';

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', width);
    bg.setAttribute('height', height);
    bg.setAttribute('fill', '#fff');
    svgEl.appendChild(bg);

    let x = 12;
    const maxX = width - 12;
    const seed = clean.split('').reduce((sum, ch, index) => sum + ch.charCodeAt(0) * (index + 3), 17);
    while (x < maxX) {
        const barWidth = 1 + ((seed + x + clean.length) % 4);
        const gap = 1 + ((seed + x) % 3);
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', x);
        bar.setAttribute('y', 10);
        bar.setAttribute('width', Math.min(barWidth, maxX - x));
        bar.setAttribute('height', 52);
        bar.setAttribute('fill', '#0f1108');
        svgEl.appendChild(bar);
        x += barWidth + gap;
    }

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', width / 2);
    label.setAttribute('y', 82);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-family', 'monospace');
    label.setAttribute('font-size', '13');
    label.setAttribute('fill', '#0f1108');
    label.textContent = format === 'EAN13' ? calculateDisplayEAN13(clean) : clean;
    svgEl.appendChild(label);
}

function calculateDisplayEAN13(value) {
    const digits = String(value || '').replace(/\D/g, '').padStart(12, '0').slice(-12);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(digits[i], 10) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    return digits + check;
}

function getLabelDataFromForm() {
    const name = document.getElementById('print-label-name')?.value.trim() || 'Product';
    const barcode = normalizeBarcode(document.getElementById('print-label-barcode')?.value || '');
    const price = parseInt(document.getElementById('print-label-price')?.value) || 0;
    const store = document.getElementById('print-store-name')?.value.trim() || 'SmartStock';
    const format = document.getElementById('print-barcode-format')?.value || 'EAN13';
    const copies = Math.min(99, Math.max(1, parseInt(document.getElementById('print-label-copies')?.value) || 1));
    const sizeClass = getPrintLabelSizeClass();
    return { name, barcode, price, store, format, copies, sizeClass };
}

function buildLabelHtml(data, svgMarkup) {
    const priceText = data.price > 0 ? '₦' + data.price.toLocaleString() : '';
    return `
        <div class="label-store-name">${escapeHtml(data.store)}</div>
        <div class="label-product-name">${escapeHtml(data.name)}</div>
        ${priceText ? `<div class="label-price">${priceText}</div>` : ''}
        ${svgMarkup}
    `;
}

function createLabelSvgMarkup(code, format) {
    const temp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    temp.setAttribute('class', 'label-barcode-svg');
    if (!renderBarcodeOnSvg(temp, code, format)) return '';
    return temp.outerHTML;
}

function setPrinterStatus(message, isError) {
    const el = document.getElementById('printer-status-msg');
    if (el) {
        el.textContent = message;
        el.style.color = isError ? '#f87171' : '';
    }
}

function generateBarcodeLabel() {
    const data = getLabelDataFromForm();
    if (!data.barcode) {
        setPrinterStatus('Enter a barcode or click Auto Generate.', true);
        return;
    }

    const previewBox = document.getElementById('label-preview-box');
    const previewSvg = document.getElementById('barcode-svg-preview');
    if (previewBox) {
        previewBox.className = 'label-preview-box ' + data.sizeClass;
    }
    document.getElementById('preview-store-name').textContent = data.store;
    document.getElementById('preview-product-name').textContent = data.name;
    document.getElementById('preview-price').textContent = data.price > 0 ? '₦' + data.price.toLocaleString() : '';

    if (!renderBarcodeOnSvg(previewSvg, data.barcode, data.format)) {
        setPrinterStatus('Could not generate barcode. Check format and number (EAN-13 needs 12–13 digits).', true);
        return;
    }

    setPrinterStatus(`Label ready — ${data.copies} copy/copies. Click Print Labels to send to your printer.`);
}

function printLabelsFromData(items) {
    const printSheet = document.getElementById('print-sheet');
    if (!printSheet) return;

    let html = '';
    items.forEach(item => {
        const svgContent = createLabelSvgMarkup(item.barcode, item.format);
        if (!svgContent) return;
        for (let c = 0; c < item.copies; c++) {
            html += `<div class="print-label ${item.sizeClass}">${buildLabelHtml(item, svgContent)}</div>`;
        }
    });

    if (!html) {
        setPrinterStatus('No valid labels to print.', true);
        return;
    }

    printSheet.innerHTML = html;
    window.print();
    setTimeout(() => { printSheet.innerHTML = ''; }, 500);
}

function printBarcodeLabels() {
    generateBarcodeLabel();
    const data = getLabelDataFromForm();
    if (!data.barcode) return;
    printLabelsFromData([data]);
    setPrinterStatus(`Sent ${data.copies} label(s) to printer.`);
}

function printAllInventoryLabels() {
    const inventory = loadData().filter(p => normalizeBarcode(p.barcode));
    if (inventory.length === 0) {
        setPrinterStatus('No products with barcodes in inventory. Add barcodes first.', true);
        return;
    }

    const format = document.getElementById('print-barcode-format')?.value || 'EAN13';
    const sizeClass = getPrintLabelSizeClass();
    const store = document.getElementById('print-store-name')?.value.trim() || 'SmartStock';
    const copies = 1;

    const items = inventory.map(p => ({
        name: p.name,
        barcode: normalizeBarcode(p.barcode),
        price: p.price,
        store,
        format,
        copies,
        sizeClass
    }));

    printLabelsFromData(items);
    setPrinterStatus(`Printing ${items.length} product label(s).`);
}

function populatePrintProductSelect() {
    const select = document.getElementById('print-product-select');
    if (!select) return;

    const current = select.value;
    const inventory = loadData();

    select.innerHTML = '<option value="">— Custom label —</option>';
    inventory.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        const bc = item.barcode ? ` (${item.barcode})` : '';
        opt.textContent = item.name + bc;
        select.appendChild(opt);
    });

    if (current && inventory.some(p => p.id === current)) {
        select.value = current;
    }
}

function onPrintProductSelect(productId) {
    if (!productId) return;
    const product = loadData().find(p => p.id === productId);
    if (!product) return;

    const nameEl = document.getElementById('print-label-name');
    const barcodeEl = document.getElementById('print-label-barcode');
    const priceEl = document.getElementById('print-label-price');

    if (nameEl) nameEl.value = product.name;
    if (barcodeEl) barcodeEl.value = product.barcode || '';
    if (priceEl) priceEl.value = product.price || '';

    if (product.barcode) {
        generateBarcodeLabel();
    }
}

function autoGeneratePrintBarcode() {
    const format = document.getElementById('print-barcode-format')?.value || 'EAN13';
    const barcodeEl = document.getElementById('print-label-barcode');
    if (!barcodeEl) return;

    if (format === 'EAN13') {
        barcodeEl.value = generateEAN13();
    } else {
        barcodeEl.value = 'SS' + Date.now().toString(36).toUpperCase().slice(-10);
    }
    setPrinterStatus('New barcode generated. Click Generate Label to preview.');
    generateBarcodeLabel();
}

function initBarcodePrinter() {
    const btnGenerate = document.getElementById('btn-generate-label');
    const btnPrint = document.getElementById('btn-print-labels');
    const btnPrintAll = document.getElementById('btn-print-all-labels');
    const btnAuto = document.getElementById('btn-auto-barcode');
    const productSelect = document.getElementById('print-product-select');

    populatePrintProductSelect();

    if (btnGenerate) btnGenerate.addEventListener('click', generateBarcodeLabel);
    if (btnPrint) btnPrint.addEventListener('click', printBarcodeLabels);
    if (btnPrintAll) btnPrintAll.addEventListener('click', printAllInventoryLabels);
    if (btnAuto) btnAuto.addEventListener('click', autoGeneratePrintBarcode);

    if (productSelect) {
        productSelect.addEventListener('change', () => onPrintProductSelect(productSelect.value));
    }

    ['print-label-name', 'print-label-barcode', 'print-label-price', 'print-barcode-format', 'print-label-size'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (normalizeBarcode(document.getElementById('print-label-barcode')?.value)) {
                generateBarcodeLabel();
            }
        });
    });

    generateBarcodeLabel();
}

function refreshPrinterAfterInventoryChange() {
    populatePrintProductSelect();
}

function initPosSync() {
    const btn = document.getElementById('btn-pos-sync');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const now = new Date().toLocaleString();
        localStorage.setItem(POS_LAST_SYNC_KEY, now);
        localStorage.setItem(POS_SYNC_KEY, 'Connected');
        updateOperationalStatus();
        updateAlertTicker();
    });
}

function updateOperationalStatus() {
    const posStatus = document.getElementById('pos-sync-status');
    const posLast = document.getElementById('pos-last-sync');
    const cctvEvent = document.getElementById('cctv-event');
    const cctvZones = document.getElementById('cctv-zones');
    const syncState = localStorage.getItem(POS_SYNC_KEY) || 'Connected';
    const lastSync = localStorage.getItem(POS_LAST_SYNC_KEY) || 'Not synced this session';

    if (posStatus) {
        posStatus.textContent = syncState;
        posStatus.className = syncState === 'Connected' ? 'pos-status' : 'pos-status offline';
    }
    if (posLast) posLast.textContent = lastSync;
    if (cctvEvent) cctvEvent.textContent = localStorage.getItem(CCTV_EVENT_KEY) || 'No exceptions in the last audit';
    if (cctvZones) cctvZones.textContent = `${Math.max(1, Math.ceil(loadData().length / 2))} zones active`;
}

function runCctvAudit() {
    const inventory = loadData();
    const watched = inventory.filter(item => isLowStock(item) || isExpiringSoon(item));
    const subject = watched[0] || inventory[0];
    const message = subject
        ? `${new Date().toLocaleTimeString()} - verified ${subject.name}; ${subject.quantity} units on shelf record`
        : `${new Date().toLocaleTimeString()} - no inventory records to audit`;
    localStorage.setItem(CCTV_EVENT_KEY, message);
    updateOperationalStatus();
}

function initOperationalControls() {
    initPosSync();
    const btnAudit = document.getElementById('btn-cctv-audit');
    if (btnAudit) btnAudit.addEventListener('click', runCctvAudit);
    updateOperationalStatus();
}

function updateDataTools() {
    const count = document.getElementById('data-product-count');
    const value = document.getElementById('data-stock-value');
    const updated = document.getElementById('data-last-updated');
    if (!count && !value && !updated) return;

    const inventory = loadData();
    const analytics = getAnalytics(inventory);
    if (count) count.textContent = String(inventory.length);
    if (value) value.textContent = '₦' + analytics.totalValue.toLocaleString();
    if (updated) {
        const dates = inventory.map(p => p.lastUpdated).filter(Boolean).sort().reverse();
        updated.textContent = dates[0] || 'No updates yet';
    }
}

function exportInventoryData() {
    const payload = {
        app: 'SmartStock',
        exportedAt: new Date().toISOString(),
        inventory: loadData()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartstock-inventory-${getToday()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDataStatus('Inventory export prepared.');
}

function importInventoryData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result || '{}'));
            const imported = Array.isArray(parsed) ? parsed : parsed.inventory;
            if (!Array.isArray(imported)) throw new Error('Invalid file format');
            saveData(imported.map(enrichProduct));
            refreshAllViews();
            setDataStatus(`Imported ${imported.length} product record(s).`);
        } catch (err) {
            setDataStatus('Import failed. Choose a SmartStock JSON export.', true);
        }
    };
    reader.readAsText(file);
}

function resetDemoData() {
    if (!confirm('Reset inventory to the demo data? This clears local edits on this device.')) return;
    saveData(INITIAL_DATA.map(enrichProduct));
    refreshAllViews();
    setDataStatus('Demo inventory restored.');
}

function setDataStatus(message, isError = false) {
    const el = document.getElementById('data-status-msg');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#f87171' : '';
}

function initDataTools() {
    const exportBtn = document.getElementById('btn-export-data');
    const importInput = document.getElementById('input-import-data');
    const resetBtn = document.getElementById('btn-reset-demo');
    if (exportBtn) exportBtn.addEventListener('click', exportInventoryData);
    if (importInput) importInput.addEventListener('change', () => {
        importInventoryData(importInput.files?.[0]);
        importInput.value = '';
    });
    if (resetBtn) resetBtn.addEventListener('click', resetDemoData);
    updateDataTools();
}

function initQueryFilters() {
    ['input-query-sku', 'input-query-category', 'input-query-status', 'input-query-range', 'input-query-store'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', filterList);
            el.addEventListener('change', filterList);
        }
    });
}

// Initialize the app
function init() {
    const addBtn = document.getElementById('btn-primary');
    if (addBtn) addBtn.addEventListener('click', addProduct);

    initQueryFilters();
    initBarcodeScanner();
    initBarcodeRegister();
    initBarcodePrinter();
    initOperationalControls();
    initDataTools();

    refreshAllViews();

    if (kpiPollTimer) clearInterval(kpiPollTimer);
    kpiPollTimer = setInterval(pollKPIs, 8000);
}

window.addEventListener('beforeunload', () => {
    stopBarcodeScanner();
    stopRegisterBarcodeScanner();
});

// Run when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

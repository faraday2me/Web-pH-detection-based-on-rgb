// ===== pH Detection Dashboard — script.js =====

const firebaseConfig = {
    apiKey:            "AIzaSyAHuCnBj49G60HptaJyHtinT_OSeDvfgmY",
    authDomain:        "ph-detection-based-on-rgb.firebaseapp.com",
    databaseURL:       "https://ph-detection-based-on-rgb-default-rtdb.firebaseio.com",
    projectId:         "ph-detection-based-on-rgb",
    storageBucket:     "ph-detection-based-on-rgb.firebasestorage.app",
    messagingSenderId: "48403449960",
    appId:             "1:48403449960:web:d86dee6a856457436613dd",
};

// ── State ──
let db              = null;
let allScans        = [];
let phChart         = null;
let realtimeRef     = null;
let isRealtimeOn    = false;

// ── Helpers ──
const getPH        = s => s.pH ?? s.ph ?? null;
const getStatus    = s => (s.status || '').toUpperCase();
const getMeaning   = s => s.meaning || '';
const getTimestamp = s => {
    if (!s.timestamp) return null;
    const t = Number(s.timestamp);
    return t < 1e12 ? t * 1000 : t;
};
const getRGB       = s => {
    const rgb = s.normalizedRGB || s.rgb;
    if (!rgb) return { r: null, g: null, b: null };
    if (typeof rgb === 'object' && !Array.isArray(rgb))
        return { r: rgb.r ?? null, g: rgb.g ?? null, b: rgb.b ?? null };
    return { r: null, g: null, b: null };
};
const getRGBText   = s => {
    const { r, g, b } = getRGB(s);
    return `(${r ?? '--'}, ${g ?? '--'}, ${b ?? '--'})`;
};
const getRawRGBText = s => {
    const raw = s.rawRGB;
    if (!raw) return '(--, --, --)';
    if (typeof raw === 'object' && !Array.isArray(raw))
        return `[${raw.r ?? '--'}, ${raw.g ?? '--'}, ${raw.b ?? '--'}]`;
    return String(raw);
};
const formatDate = s => {
    const ms = getTimestamp(s);
    if (!ms) return '--';
    const d = new Date(ms);
    return isNaN(d.getTime()) ? '--' : d.toLocaleString('id-ID');
};
const statusClass = st => {
    if (st === 'FRESH')   return 'fresh';
    if (st === 'CAUTION') return 'caution';
    if (st === 'ROTTEN')  return 'rotten';
    return 'unknown';
};
const statusColor = st => {
    if (st === 'FRESH')   return '#00875a';
    if (st === 'CAUTION') return '#b45309';
    if (st === 'ROTTEN')  return '#c0392b';
    return '#5c6b82';
};

// ── UI setters ──
function set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ── Connection status ──
function setOnline(online) {
    const dot  = document.getElementById('connDot');
    const text = document.getElementById('connText');
    if (!dot || !text) return;
    dot.className  = 'conn-dot ' + (online ? 'online' : 'offline');
    text.textContent = online ? 'ONLINE' : 'OFFLINE';
}

// ── Current reading ──
function updateReading(scan) {
    if (!scan) return;

    const ph     = getPH(scan);
    const status = getStatus(scan);
    const sc     = statusClass(status);
    const color  = statusColor(status);
    const rgb    = getRGB(scan);

    // pH ring
    const phNum = ph != null ? Number(ph) : null;
    set('phNumber', phNum != null ? phNum.toFixed(1) : '--');

    const circumference = 314.16; // 2π × 50
    const progress = phNum != null ? phNum / 14 : 0;
    const fill = document.getElementById('phRingFill');
    if (fill) {
        fill.style.strokeDashoffset = circumference * (1 - progress);
        fill.style.stroke = color;
    }

    // pH scale bar indicator
    const indicator = document.getElementById('phIndicator');
    if (indicator && phNum != null) {
        indicator.style.left = `${(phNum / 14) * 100}%`;
        indicator.style.background = color;
    }

    // status pill
    const pill = document.getElementById('statusPill');
    if (pill) { pill.textContent = status || '--'; pill.className = 'status-pill ' + sc; }

    set('meaningText', getMeaning(scan) || '--');

    // RGB bars + swatch
    const r = rgb.r ?? 128, g = rgb.g ?? 128, b = rgb.b ?? 128;
    ['r','g','b'].forEach(ch => {
        const val = rgb[ch];
        set(`rgb${ch.toUpperCase()}`, val ?? '--');
        const bar = document.getElementById(`bar${ch.toUpperCase()}`);
        if (bar) bar.style.width = (val != null ? (val / 255 * 100) : 0) + '%';
    });

    // Update color swatch
    const swatch = document.getElementById('rgbSwatch');
    if (swatch && rgb.r != null) {
        swatch.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }

    // meta
    set('metaTimestamp', formatDate(scan));
    set('metaRawRGB', getRawRGBText(scan));

    // last update
    const now = new Date().toLocaleString('id-ID');
    set('lastUpdate', now);
    set('footerTime', now);
}

// ── Stats ──
function updateStats() {
    set('statTotal', allScans.length);
    if (allScans.length === 0) {
        set('statFresh', '0');
        set('statCaution', '0');
        set('statRotten', '0');
        return;
    }
    set('statFresh',   allScans.filter(s => getStatus(s) === 'FRESH').length);
    set('statCaution', allScans.filter(s => getStatus(s) === 'CAUTION').length);
    set('statRotten',  allScans.filter(s => getStatus(s) === 'ROTTEN').length);
}

// ── Chart ──
function buildChart() {
    const canvas = document.getElementById('phChart');
    if (!canvas) return;

    if (phChart) { phChart.destroy(); phChart = null; }
    if (allScans.length === 0) return;

    const recent = allScans.slice(-60);
    const labels = recent.map(s => {
        const ms = getTimestamp(s);
        return ms ? new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
    });
    const phVals = recent.map(s => { const v = getPH(s); return v != null ? Number(v) : null; });
    const ptColors = recent.map(s => statusColor(getStatus(s)));

    phChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'pH',
                data: phVals,
                borderColor: 'rgba(29,78,216,0.5)',
                backgroundColor: ctx => {
                    const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 240);
                    g.addColorStop(0, 'rgba(29,78,216,0.08)');
                    g.addColorStop(1, 'rgba(29,78,216,0.00)');
                    return g;
                },
                pointBackgroundColor: ptColors,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.35,
                borderWidth: 1.5,
                fill: true,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#ffffff',
                    borderColor: '#dde1e8',
                    borderWidth: 1,
                    titleFont:   { family: 'IBM Plex Mono', size: 10 },
                    bodyFont:    { family: 'IBM Plex Mono', size: 10 },
                    titleColor:  '#475569',
                    bodyColor:   '#0f172a',
                    padding: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    callbacks: {
                        title: items => {
                            const s = recent[items[0].dataIndex];
                            return formatDate(s);
                        },
                        label: item => {
                            const s = recent[item.dataIndex];
                            return [
                                `pH    : ${item.parsed.y}`,
                                `Status: ${getStatus(s)}`,
                                `RGB   : ${getRGBText(s)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid:  { color: '#f0f2f5', drawBorder: false },
                    ticks: { font: { family: 'IBM Plex Mono', size: 9 }, color: '#94a3b8', maxTicksLimit: 10 }
                },
                y: {
                    min: 0, max: 14,
                    grid:  { color: '#f0f2f5', drawBorder: false },
                    ticks: {
                        font: { family: 'IBM Plex Mono', size: 9 }, color: '#94a3b8',
                        stepSize: 2,
                        callback: v => `${v}`
                    },
                    title: { display: false }
                }
            }
        }
    });
}

// ── Table ──
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (allScans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Belum ada data scan</td></tr>`;
        return;
    }

    allScans.slice(-100).reverse().forEach(scan => {
        const ph     = getPH(scan);
        const status = getStatus(scan);
        const sc     = statusClass(status);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(scan)}</td>
            <td class="td-ph">${ph != null ? Number(ph).toFixed(2) : '-'}</td>
            <td><span class="badge ${sc}">${status || '-'}</span></td>
            <td>${getMeaning(scan) || '-'}</td>
            <td>${getRGBText(scan)}</td>
            <td>
                <button class="btn-del" onclick="deleteScan('${scan._id || ''}')">Del</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

// ── Process snapshot ──
function processSnapshot(snap) {
    allScans = [];
    snap.forEach(child => {
        const v  = child.val();
        v._id    = child.key;
        allScans.push(v);
    });
    allScans.sort((a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0));

    if (allScans.length > 0) updateReading(allScans[allScans.length - 1]);
    updateStats();
    renderTable();
    buildChart();
}

// ── Delete ──
window.deleteScan = function(id) {
    if (!id || !db) return;
    if (!confirm('Hapus data ini?')) return;
    db.ref('scans/' + id).remove().catch(e => alert('Gagal: ' + e.message));
};

// ── Firebase ──
function startRealtime() {
    if (!db || realtimeRef) return;
    realtimeRef = db.ref('scans');
    realtimeRef.on('value', processSnapshot, err => console.error('[RT]', err));
    isRealtimeOn = true;
}

function stopRealtime() {
    if (!db || !realtimeRef) return;
    realtimeRef.off('value');
    realtimeRef   = null;
    isRealtimeOn  = false;
}

function initFirebase() {
    try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        db.ref('.info/connected').on('value', s => setOnline(s.val() === true));
        startRealtime();
    } catch (err) {
        console.error('[Firebase] init failed:', err);
        setOnline(false);
    }
}

// ── Event bindings ──
window.addEventListener('load', () => {
    initFirebase();

    const rtBtn = document.getElementById('btnRealtime');
    rtBtn.addEventListener('click', () => {
        if (isRealtimeOn) {
            stopRealtime();
            rtBtn.textContent = '○ Realtime OFF';
            rtBtn.classList.remove('btn-active');
        } else {
            startRealtime();
            rtBtn.textContent = '● Realtime ON';
            rtBtn.classList.add('btn-active');
        }
    });

    document.getElementById('btnRefresh').addEventListener('click', () => {
        if (isRealtimeOn) return;
        if (!db) return;
        db.ref('scans').once('value', processSnapshot);
    });

    document.getElementById('btnExport').addEventListener('click', () => {
        if (allScans.length === 0) { alert('Belum ada data'); return; }
        let csv = 'Timestamp,pH,Status,Meaning,NormalizedRGB,RawRGB\n';
        allScans.forEach(s => {
            const ms = getTimestamp(s);
            const t  = ms ? new Date(ms).toLocaleString('id-ID') : '';
            csv += `"${t}","${getPH(s)||''}","${getStatus(s)}","${getMeaning(s)}","${getRGBText(s)}","${getRawRGBText(s)}"\n`;
        });
        const a = Object.assign(document.createElement('a'), {
            href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
            download: `ph-scans-${Date.now()}.csv`
        });
        a.click();
    });

    document.getElementById('btnDeleteOld').addEventListener('click', () => {
        if (allScans.length <= 50) { alert('Data kurang dari 50, tidak perlu dihapus'); return; }
        const del = allScans.slice(0, allScans.length - 50);
        if (!confirm(`Hapus ${del.length} data lama? Menyisakan 50 terbaru.`)) return;
        const upd = {};
        del.forEach(s => { if (s._id) upd['scans/' + s._id] = null; });
        db.ref().update(upd).catch(e => alert('Gagal: ' + e.message));
    });

    document.getElementById('btnDeleteAll').addEventListener('click', () => {
        if (!confirm('Hapus SEMUA data? Tindakan ini tidak bisa dibatalkan.')) return;
        db.ref('scans').remove()
            .then(() => { allScans = []; renderTable(); updateStats(); })
            .catch(e => alert('Gagal: ' + e.message));
    });
});

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
let db           = null;
let allScans     = [];
let phChart      = null;
let realtimeRef  = null;
let isRealtimeOn = false;
let selectedScanId = null;

// ── Helpers ──
const getPH        = s => s.pH ?? s.ph ?? null;
const getStatus    = s => (s.status || '').toUpperCase();
const getMeaning   = s => s.meaning || '';
const getTimestamp = s => {
    if (!s.timestamp) return null;
    const t = Number(s.timestamp);
    return t < 1e12 ? t * 1000 : t;
};
const getRGB = s => {
    const rgb = s.normalizedRGB || s.rgb;
    if (!rgb) return { r: null, g: null, b: null };
    if (typeof rgb === 'object' && !Array.isArray(rgb))
        return { r: rgb.r ?? null, g: rgb.g ?? null, b: rgb.b ?? null };
    return { r: null, g: null, b: null };
};
const getRGBText = s => {
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

function setOnline(online) {
    const dot  = document.getElementById('connDot');
    const text = document.getElementById('connText');
    if (!dot || !text) return;
    dot.className    = 'conn-dot ' + (online ? 'online' : 'offline');
    text.textContent = online ? 'ONLINE' : 'OFFLINE';
}

// ── Display Updaters ──
function updatePHDisplay(scan) {
    if (!scan) return;
    const ph     = getPH(scan);
    const status = getStatus(scan);
    const sc     = statusClass(status);
    const color  = statusColor(status);

    const phNum = ph != null ? Number(ph) : null;
    set('phNumber', phNum != null ? phNum.toFixed(1) : '--');

    const circumference = 314.16;
    const progress = phNum != null ? phNum / 14 : 0;
    const fill = document.getElementById('phRingFill');
    if (fill) {
        fill.style.strokeDashoffset = circumference * (1 - progress);
        fill.style.stroke = color;
    }

    const indicator = document.getElementById('phIndicator');
    if (indicator && phNum != null) {
        indicator.style.left = `${(phNum / 14) * 100}%`;
        indicator.style.background = color;
    }

    const pill = document.getElementById('statusPill');
    if (pill) { pill.textContent = status || '--'; pill.className = 'status-pill ' + sc; }

    set('meaningText', getMeaning(scan) || '--');

    const now = new Date().toLocaleString('id-ID');
    set('lastUpdate', now);
    set('footerTime', now);
}

function updateRGBDisplay(scan) {
    if (!scan) return;
    const rgb = getRGB(scan);
    
    ['r','g','b'].forEach(ch => {
        const val = rgb[ch];
        set(`rgb${ch.toUpperCase()}`, val ?? '--');
        const bar = document.getElementById(`bar${ch.toUpperCase()}`);
        if (bar) bar.style.width = (val != null ? (val / 255 * 100) : 0) + '%';
    });

    const swatch = document.getElementById('rgbSwatch');
    if (swatch && rgb.r != null) {
        swatch.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }

    set('metaTimestamp', formatDate(scan));
    set('metaRawRGB', getRawRGBText(scan));
}

function updateReading(scan) {
    if (!scan) return;
    updatePHDisplay(scan);
    // Hanya perbarui RGB ke live jika tidak ada baris yang sedang dipilih
    if (!selectedScanId) {
        updateRGBDisplay(scan);
    }
}

// ── Stats ──
function updateStats() {
    set('statTotal', allScans.length);
    if (allScans.length === 0) {
        set('statFresh', '0'); set('statCaution', '0'); set('statRotten', '0');
        return;
    }
    set('statFresh',   allScans.filter(s => getStatus(s) === 'FRESH').length);
    set('statCaution', allScans.filter(s => getStatus(s) === 'CAUTION').length);
    set('statRotten',  allScans.filter(s => getStatus(s) === 'ROTTEN').length);
}

// ── pH Chart ──
function buildCharts() {
    if (allScans.length === 0) {
        if (phChart)  { phChart.destroy();  phChart  = null; }
        return;
    }
    const recent = allScans.slice(-60);
    const labels = recent.map(s => {
        const ms = getTimestamp(s);
        return ms ? new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
    });

    const canvas = document.getElementById('phChart');
    if (!canvas) return;
    if (phChart) { phChart.destroy(); phChart = null; }

    const phVals   = recent.map(s => { const v = getPH(s); return v != null ? Number(v) : null; });
    const ptColors = recent.map(s => statusColor(getStatus(s)));
    
    // Konfigurasi tebal titik ketika baris dipilih
    const pointRadii = recent.map(s => s._id === selectedScanId ? 8 : 4);
    const pointBorderWidths = recent.map(s => s._id === selectedScanId ? 3 : 2);
    const pointHoverRadii = recent.map(s => s._id === selectedScanId ? 10 : 6);

    phChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'pH',
                data: phVals,
                borderColor: 'rgba(29,78,216,0.55)',
                backgroundColor: ctx => {
                    const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
                    g.addColorStop(0, 'rgba(29,78,216,0.10)');
                    g.addColorStop(1, 'rgba(29,78,216,0.00)');
                    return g;
                },
                pointBackgroundColor: ptColors,
                pointBorderColor: '#ffffff',
                pointBorderWidth: pointBorderWidths,
                pointRadius: pointRadii,
                pointHoverRadius: pointHoverRadii,
                tension: 0.35,
                borderWidth: 2,
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
                    titleFont: { family: 'IBM Plex Mono', size: 11 },
                    bodyFont:  { family: 'IBM Plex Mono', size: 11 },
                    titleColor: '#475569',
                    bodyColor:  '#0f172a',
                    padding: 12,
                    callbacks: {
                        title: items => formatDate(recent[items[0].dataIndex]),
                        label: item => {
                            const s = recent[item.dataIndex];
                            return [
                                `pH    : ${item.parsed.y ?? '--'}`,
                                `Status: ${getStatus(s)}`,
                                `RGB   : ${getRGBText(s)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid:  { color: '#f0f2f5' },
                    ticks: { font: { family: 'IBM Plex Mono', size: 11 }, color: '#94a3b8', maxTicksLimit: 10 }
                },
                y: {
                    min: 0, max: 14,
                    grid:  { color: '#f0f2f5' },
                    ticks: {
                        font: { family: 'IBM Plex Mono', size: 11 },
                        color: '#94a3b8',
                        stepSize: 2
                    }
                }
            }
        }
    });
}

// ── Interactive Row Click ──
window.selectScan = function(id) {
    if (selectedScanId === id) {
        selectedScanId = null; // Toggle off jika di klik lagi
        if (allScans.length > 0) updateRGBDisplay(allScans[allScans.length - 1]);
    } else {
        selectedScanId = id;
        const scan = allScans.find(s => s._id === id);
        if (scan) updateRGBDisplay(scan);
    }
    renderTable();
    buildCharts(); // Render ulang chart agar titik menjadi tebal
};

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
        if (scan._id === selectedScanId) tr.classList.add('selected-row');
        tr.style.cursor = 'pointer';
        
        tr.onclick = (e) => {
            // Hindari trigger klik baris ketika mengklik checkbox
            if (e.target.tagName === 'INPUT') return;
            selectScan(scan._id);
        };

        tr.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" class="row-check" value="${scan._id}">
            </td>
            <td>${formatDate(scan)}</td>
            <td class="td-ph">${ph != null ? Number(ph).toFixed(2) : '-'}</td>
            <td><span class="badge ${sc}">${status || '-'}</span></td>
            <td>${getMeaning(scan) || '-'}</td>
            <td>${getRGBText(scan)}</td>`;
        
        tbody.appendChild(tr);
    });

    const checkAll = document.getElementById('checkAll');
    if (checkAll) checkAll.checked = false;
}

// ── Process snapshot ──
function processSnapshot(snap) {
    allScans = [];
    snap.forEach(child => {
        const v = child.val();
        v._id = child.key;
        allScans.push(v);
    });
    allScans.sort((a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0));

    if (allScans.length > 0) {
        const latest = allScans[allScans.length - 1];
        updateReading(latest);
        // Pastikan tampilan RGB tetap pada data yang dipilih jika ada
        if (selectedScanId) {
            const sel = allScans.find(s => s._id === selectedScanId);
            if (sel) updateRGBDisplay(sel);
        }
    }
    
    updateStats();
    renderTable();
    buildCharts();
}

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
    realtimeRef  = null;
    isRealtimeOn = false;
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

    // Check All Checkbox Logic
    document.getElementById('checkAll').addEventListener('change', (e) => {
        document.querySelectorAll('.row-check').forEach(cb => cb.checked = e.target.checked);
    });

    // Hapus Terpilih
    document.getElementById('btnDeleteSelected').addEventListener('click', () => {
        const checked = document.querySelectorAll('.row-check:checked');
        if (checked.length === 0) { alert('Pilih data yang ingin dihapus terlebih dahulu'); return; }
        if (!confirm(`Hapus ${checked.length} data terpilih?`)) return;
        
        const upd = {};
        checked.forEach(cb => { upd['scans/' + cb.value] = null; });
        db.ref().update(upd).catch(e => alert('Gagal: ' + e.message));
    });

    // Export CSV
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

    // Export PDF
    document.getElementById('btnExportPDF').addEventListener('click', () => {
        if (allScans.length === 0) { alert('Belum ada data untuk diekspor'); return; }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Judul Dokumen
        doc.setFontSize(16);
        doc.text("Laporan Deteksi pH", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Diekspor pada: " + new Date().toLocaleString('id-ID'), 14, 26);

        // Siapkan Data
        const tableData = allScans.map((s, i) => [
            i + 1,
            formatDate(s),
            getPH(s) != null ? Number(getPH(s)).toFixed(2) : '-',
            getStatus(s),
            getMeaning(s),
            getRGBText(s)
        ]);

        // Buat Tabel
        doc.autoTable({
            startY: 32,
            head: [['No', 'Waktu', 'pH', 'Status', 'Keterangan', 'RGB']],
            body: tableData,
            columnStyles: {
                0: { cellPadding: { left: 12 } } // Geser text nomer ke kanan untuk space warna
            },
            didDrawCell: function(data) {
                // Gambar bulatan warna dari RGB di kolom 'No'
                if (data.section === 'body' && data.column.index === 0) {
                    const rowData = allScans[data.row.index];
                    const rgb = getRGB(rowData);
                    if (rgb.r != null && rgb.g != null && rgb.b != null) {
                        doc.setFillColor(rgb.r, rgb.g, rgb.b);
                        doc.circle(data.cell.x + 6, data.cell.y + (data.cell.height / 2), 2.5, 'F');
                    }
                }
            },
            styles: { font: 'helvetica', fontSize: 9 },
            headStyles: { fillColor: [29, 78, 216], textColor: 255 }
        });

        // Unduh PDF
        doc.save(`Laporan-pH-${Date.now()}.pdf`);
    });
});
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
let selectedScanId  = null;   // baris yang diklik di tabel
let checkedIds      = new Set(); // id yang dicentang untuk dihapus

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

// ── Update left panel (Current Reading + RGB) ──
function updateReading(scan, fromClick) {
    if (!scan) return;

    const ph     = getPH(scan);
    const status = getStatus(scan);
    const sc     = statusClass(status);
    const color  = statusColor(status);
    const rgb    = getRGB(scan);

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

    // RGB bars + swatch
    ['r','g','b'].forEach(ch => {
        const val = rgb[ch];
        set(`rgb${ch.toUpperCase()}`, val ?? '--');
        const bar = document.getElementById(`bar${ch.toUpperCase()}`);
        if (bar) bar.style.width = (val != null ? (val / 255 * 100) : 0) + '%';
    });

    const swatch = document.getElementById('rgbSwatch');
    if (swatch) {
        swatch.style.background = rgb.r != null
            ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
            : 'rgb(200,200,200)';
    }

    // Note di bawah swatch: kalau dari klik tabel, kasih label "dari scan #X"
    const note = document.getElementById('rgbSwatchNote');
    if (note) {
        note.textContent = fromClick ? `▸ Dari scan terpilih` : `▸ Scan terbaru`;
    }

    set('metaTimestamp', formatDate(scan));
    set('metaRawRGB', getRawRGBText(scan));

    if (!fromClick) {
        const now = new Date().toLocaleString('id-ID');
        set('lastUpdate', now);
        set('footerTime', now);
    }
}

// ── Stats ──
function updateStats() {
    set('statTotal', allScans.length);
    if (allScans.length === 0) {
        set('statFresh','0'); set('statCaution','0'); set('statRotten','0');
        return;
    }
    set('statFresh',   allScans.filter(s => getStatus(s) === 'FRESH').length);
    set('statCaution', allScans.filter(s => getStatus(s) === 'CAUTION').length);
    set('statRotten',  allScans.filter(s => getStatus(s) === 'ROTTEN').length);
}

// ── pH Chart dengan highlight titik terpilih ──
function buildPhChart(highlightId) {
    const canvas = document.getElementById('phChart');
    if (!canvas) return;
    if (phChart) { phChart.destroy(); phChart = null; }

    const recent = allScans.slice(-60);
    if (recent.length === 0) return;

    const labels = recent.map(s => {
        const ms = getTimestamp(s);
        return ms ? new Date(ms).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : '-';
    });

    const phVals    = recent.map(s => { const v = getPH(s); return v != null ? Number(v) : null; });
    const ptColors  = recent.map(s => statusColor(getStatus(s)));
    const ptRadius  = recent.map(s => s._id === highlightId ? 10 : 5);
    const ptBorderW = recent.map(s => s._id === highlightId ? 3 : 1.5);

    phChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'pH',
                data: phVals,
                borderColor: 'rgba(29,78,216,0.55)',
                backgroundColor: ctx => {
                    const g = ctx.chart.ctx.createLinearGradient(0,0,0,260);
                    g.addColorStop(0,'rgba(29,78,216,0.10)');
                    g.addColorStop(1,'rgba(29,78,216,0.00)');
                    return g;
                },
                pointBackgroundColor: ptColors,
                pointBorderColor: recent.map(s => s._id === highlightId ? '#0f172a' : '#ffffff'),
                pointBorderWidth: ptBorderW,
                pointRadius: ptRadius,
                pointHoverRadius: 8,
                tension: 0.35,
                borderWidth: 2,
                fill: true,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#ffffff',
                    borderColor: '#dde1e8',
                    borderWidth: 1,
                    titleFont: { family:'IBM Plex Mono', size:11 },
                    bodyFont:  { family:'IBM Plex Mono', size:11 },
                    titleColor: '#475569',
                    bodyColor:  '#0f172a',
                    padding: 12,
                    callbacks: {
                        title: items => formatDate(recent[items[0].dataIndex]),
                        label: item  => {
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
                    ticks: { font:{ family:'IBM Plex Mono', size:11 }, color:'#94a3b8', maxTicksLimit:10 }
                },
                y: {
                    min: 0, max: 14,
                    grid:  { color: '#f0f2f5' },
                    ticks: { font:{ family:'IBM Plex Mono', size:11 }, color:'#94a3b8', stepSize:2, callback: v=>`${v}` }
                }
            },
            onClick: (evt, elements) => {
                if (!elements.length) return;
                const idx = elements[0].index;
                const scan = recent[idx];
                if (!scan) return;
                selectRow(scan._id);
            }
        }
    });
}

// ── Pilih baris (dari tabel atau klik chart) ──
function selectRow(id) {
    selectedScanId = id;
    const scan = allScans.find(s => s._id === id);
    if (scan) updateReading(scan, true);

    // highlight baris di tabel
    document.querySelectorAll('#tableBody tr').forEach(tr => {
        tr.classList.toggle('row-selected', tr.dataset.id === id);
    });

    // rebuild chart supaya titik terpilih lebih tebal
    buildPhChart(id);

    // scroll baris ke tampilan
    const tr = document.querySelector(`#tableBody tr[data-id="${id}"]`);
    if (tr) tr.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ── Render table ──
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    checkedIds.clear();
    updateCheckAllState();

    if (allScans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada data scan</td></tr>`;
        return;
    }

    const displayed = allScans.slice(-100).reverse();
    displayed.forEach((scan, idx) => {
        const ph     = getPH(scan);
        const status = getStatus(scan);
        const sc     = statusClass(status);
        const rgb    = getRGB(scan);
        const swatchColor = rgb.r != null ? `rgb(${rgb.r},${rgb.g},${rgb.b})` : '#ccc';
        const no = allScans.length - idx;  // nomor urut dari terbaru

        const tr = document.createElement('tr');
        tr.dataset.id = scan._id || '';
        if (scan._id === selectedScanId) tr.classList.add('row-selected');

        tr.innerHTML = `
            <td class="td-check">
                <input type="checkbox" class="row-check" data-id="${scan._id || ''}">
            </td>
            <td class="td-no">${no}</td>
            <td>${formatDate(scan)}</td>
            <td class="td-ph">${ph != null ? Number(ph).toFixed(2) : '-'}</td>
            <td><span class="badge ${sc}">${status || '-'}</span></td>
            <td>${getMeaning(scan) || '-'}</td>
            <td>
                <span class="td-swatch">
                    <span class="td-swatch-dot" style="background:${swatchColor}"></span>
                    ${getRGBText(scan)}
                </span>
            </td>`;

        // Klik baris → update RGB panel + highlight chart
        tr.addEventListener('click', e => {
            if (e.target.type === 'checkbox') return; // jangan interfere checkbox
            selectRow(scan._id);
        });

        // Checkbox
        const cb = tr.querySelector('.row-check');
        cb.addEventListener('change', () => {
            if (cb.checked) checkedIds.add(scan._id);
            else checkedIds.delete(scan._id);
            updateCheckAllState();
            updateDeleteBtn();
        });

        tbody.appendChild(tr);
    });
}

function updateCheckAllState() {
    const allCbs = document.querySelectorAll('.row-check');
    const chk    = document.getElementById('checkAll');
    if (!chk) return;
    if (allCbs.length === 0) { chk.indeterminate = false; chk.checked = false; return; }
    const checkedCount = [...allCbs].filter(c => c.checked).length;
    if (checkedCount === 0)            { chk.indeterminate = false; chk.checked = false; }
    else if (checkedCount === allCbs.length) { chk.indeterminate = false; chk.checked = true; }
    else                               { chk.indeterminate = true; }
}

function updateDeleteBtn() {
    const btn = document.getElementById('btnDeleteSel');
    if (!btn) return;
    const n = checkedIds.size;
    btn.textContent = n > 0 ? `☒ Hapus Dipilih (${n})` : '☐ Hapus Dipilih';
}

// ── Process snapshot ──
function processSnapshot(snap) {
    allScans = [];
    snap.forEach(child => {
        const v = child.val();
        v._id = child.key;
        allScans.push(v);
    });
    allScans.sort((a,b) => (getTimestamp(a)||0) - (getTimestamp(b)||0));

    // Kalau tidak ada baris terpilih, tampilkan scan terbaru di panel kiri
    if (!selectedScanId && allScans.length > 0)
        updateReading(allScans[allScans.length - 1], false);

    updateStats();
    renderTable();
    buildPhChart(selectedScanId);

    const now = new Date().toLocaleString('id-ID');
    set('lastUpdate', now);
    set('footerTime', now);
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

// ── Modal helper ──
function showModal(msg, onConfirm) {
    document.getElementById('modalMsg').textContent = msg;
    document.getElementById('deleteModal').style.display = 'flex';
    const confirmBtn = document.getElementById('modalConfirm');
    const newBtn = confirmBtn.cloneNode(true); // remove old listeners
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', () => {
        hideModal();
        onConfirm();
    });
}
function hideModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

// ── Export CSV ──
function exportCSV() {
    if (allScans.length === 0) { alert('Belum ada data'); return; }
    let csv = 'No,Timestamp,pH,Status,Meaning,NormalizedRGB,RawRGB\n';
    allScans.forEach((s, i) => {
        const ms = getTimestamp(s);
        const t  = ms ? new Date(ms).toLocaleString('id-ID') : '';
        csv += `"${i+1}","${t}","${getPH(s)||''}","${getStatus(s)}","${getMeaning(s)}","${getRGBText(s)}","${getRawRGBText(s)}"\n`;
    });
    const a = Object.assign(document.createElement('a'), {
        href:     URL.createObjectURL(new Blob([csv], { type:'text/csv' })),
        download: `ph-scans-${Date.now()}.csv`
    });
    a.click();
}

// ── Export PDF ──
function exportPDF() {
    if (allScans.length === 0) { alert('Belum ada data'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });

    const pageW = 210;
    const margin = 14;
    const colWidths = [12, 48, 16, 24, 30, 38]; // No, Waktu, pH, Status, Keterangan, RGB
    const colX = [];
    let cx = margin;
    colWidths.forEach(w => { colX.push(cx); cx += w; });

    // ── HEADER BRIN ──
    // Logo placeholder (teks karena jsPDF tidak support webp langsung)
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(margin, 8, 12, 12, 2, 2, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.text('BRIN', margin+6, 15.5, { align:'center' });

    doc.setTextColor(30,30,30);
    doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('pH Detection Report', margin+16, 14);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.setTextColor(100,100,100);
    doc.text('Badan Riset dan Inovasi Nasional', margin+16, 19);

    // Tanggal cetak
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.setTextColor(120,120,120);
    const now = new Date().toLocaleString('id-ID');
    doc.text(`Dicetak: ${now}`, pageW - margin, 14, { align:'right' });
    doc.text(`Total data: ${allScans.length} scan`, pageW - margin, 19, { align:'right' });

    // Garis bawah header
    doc.setDrawColor(200,200,200);
    doc.setLineWidth(0.3);
    doc.line(margin, 23, pageW - margin, 23);

    // ── RINGKASAN STATISTIK ──
    let y = 30;
    const freshCount   = allScans.filter(s => getStatus(s) === 'FRESH').length;
    const cautionCount = allScans.filter(s => getStatus(s) === 'CAUTION').length;
    const rottenCount  = allScans.filter(s => getStatus(s) === 'ROTTEN').length;

    const statBoxes = [
        { label:'Total Scans', val: allScans.length, r:30,g:30,b:30 },
        { label:'Fresh',  val: freshCount,   r:0,  g:135,b:90 },
        { label:'Caution',val: cautionCount, r:180,g:83, b:9  },
        { label:'Rotten', val: rottenCount,  r:192,g:57, b:43 },
    ];
    const bw = (pageW - margin*2 - 9) / 4;
    statBoxes.forEach((sb, i) => {
        const bx = margin + i*(bw+3);
        doc.setFillColor(245,247,250);
        doc.setDrawColor(220,225,232);
        doc.setLineWidth(0.2);
        doc.roundedRect(bx, y, bw, 14, 2, 2, 'FD');
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.setTextColor(100,100,100);
        doc.text(sb.label.toUpperCase(), bx + bw/2, y+5, { align:'center' });
        doc.setFontSize(14); doc.setFont('helvetica','bold');
        doc.setTextColor(sb.r, sb.g, sb.b);
        doc.text(String(sb.val), bx + bw/2, y+12, { align:'center' });
    });

    y += 20;

    // ── TABLE HEADER ──
    const headers = ['No','Waktu','pH','Status','Keterangan','RGB (R,G,B)'];
    doc.setFillColor(30, 60, 114);
    doc.rect(margin, y, pageW - margin*2, 7, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica','bold');
    doc.setTextColor(255,255,255);
    headers.forEach((h,i) => {
        doc.text(h, colX[i]+1, y+5);
    });
    y += 7;

    // ── TABLE ROWS ──
    doc.setFont('helvetica','normal');
    const rowH = 8;

    allScans.forEach((s, idx) => {
        // page break
        if (y + rowH > 285) {
            doc.addPage();
            y = 15;
            // repeat header
            doc.setFillColor(30, 60, 114);
            doc.rect(margin, y, pageW - margin*2, 7, 'F');
            doc.setFontSize(7.5); doc.setFont('helvetica','bold');
            doc.setTextColor(255,255,255);
            headers.forEach((h,i) => doc.text(h, colX[i]+1, y+5));
            y += 7;
            doc.setFont('helvetica','normal');
        }

        const rgb  = getRGB(s);
        const st   = getStatus(s);
        const ph   = getPH(s);

        // Row background alternating
        if (idx % 2 === 0) {
            doc.setFillColor(250,251,253);
            doc.rect(margin, y, pageW - margin*2, rowH, 'F');
        }

        // Warna kotak RGB di kolom No
        if (rgb.r != null) {
            doc.setFillColor(rgb.r, rgb.g, rgb.b);
            doc.roundedRect(colX[0]+0.5, y+1.5, 7, 5, 1, 1, 'F');
            doc.setDrawColor(180,180,180);
            doc.setLineWidth(0.15);
            doc.roundedRect(colX[0]+0.5, y+1.5, 7, 5, 1, 1, 'D');
        }

        // Status warna teks
        let sr=80,sg=80,sb2=80;
        if (st==='FRESH')   { sr=0;  sg=135; sb2=90; }
        if (st==='CAUTION') { sr=180;sg=83;  sb2=9;  }
        if (st==='ROTTEN')  { sr=192;sg=57;  sb2=43; }

        doc.setFontSize(7); doc.setTextColor(40,40,40);
        doc.text(String(idx+1), colX[0]+9, y+5.5);
        doc.text(formatDate(s).replace(', ','  '), colX[1]+1, y+5.5);
        doc.text(ph != null ? Number(ph).toFixed(2) : '-', colX[2]+1, y+5.5);

        doc.setTextColor(sr,sg,sb2);
        doc.setFont('helvetica','bold');
        doc.text(st || '-', colX[3]+1, y+5.5);
        doc.setFont('helvetica','normal');
        doc.setTextColor(40,40,40);

        doc.text(getMeaning(s) || '-', colX[4]+1, y+5.5);
        doc.text(getRGBText(s), colX[5]+1, y+5.5);

        // border bawah baris
        doc.setDrawColor(230,233,238);
        doc.setLineWidth(0.1);
        doc.line(margin, y+rowH, pageW-margin, y+rowH);

        y += rowH;
    });

    // ── FOOTER tiap halaman ──
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.setTextColor(160,160,160);
        doc.line(margin, 289, pageW-margin, 289);
        doc.text('BRIN — pH Detection System (ESP32 + TCS3200)', margin, 293);
        doc.text(`Halaman ${p} / ${pageCount}`, pageW-margin, 293, { align:'right' });
    }

    doc.save(`pH-Report-BRIN-${Date.now()}.pdf`);
}

// ── Event bindings ──
window.addEventListener('load', () => {
    initFirebase();

    // Realtime toggle
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

    // Export CSV
    document.getElementById('btnExportCSV').addEventListener('click', exportCSV);

    // Export PDF
    document.getElementById('btnExportPDF').addEventListener('click', exportPDF);

    // Hapus dipilih
    document.getElementById('btnDeleteSel').addEventListener('click', () => {
        if (checkedIds.size === 0) { alert('Pilih minimal 1 data terlebih dahulu.'); return; }
        showModal(
            `Hapus ${checkedIds.size} data yang dipilih? Tindakan ini tidak bisa dibatalkan.`,
            () => {
                const upd = {};
                checkedIds.forEach(id => { upd['scans/' + id] = null; });
                db.ref().update(upd).catch(e => alert('Gagal: ' + e.message));
                checkedIds.clear();
                updateDeleteBtn();
            }
        );
    });

    // Check all
    document.getElementById('checkAll').addEventListener('change', e => {
        const cbs = document.querySelectorAll('.row-check');
        cbs.forEach(cb => {
            cb.checked = e.target.checked;
            const id = cb.dataset.id;
            if (e.target.checked) checkedIds.add(id);
            else checkedIds.delete(id);
        });
        updateDeleteBtn();
    });

    // Modal close/cancel
    document.getElementById('modalClose').addEventListener('click', hideModal);
    document.getElementById('modalCancel').addEventListener('click', hideModal);
    document.getElementById('deleteModal').addEventListener('click', e => {
        if (e.target === document.getElementById('deleteModal')) hideModal();
    });
});

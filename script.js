// ===== pH Detection Dashboard - Fixed Script =====
const firebaseConfig = {
  apiKey: "AIzaSyAHuCnBj49G60HptaJyHtinT_OSeDvfgmY",
  authDomain: "ph-detection-based-on-rgb.firebaseapp.com",
  databaseURL: "https://ph-detection-based-on-rgb-default-rtdb.firebaseio.com",
  projectId: "ph-detection-based-on-rgb",
  storageBucket: "ph-detection-based-on-rgb.firebasestorage.app",
  messagingSenderId: "48403449960",
  appId: "1:48403449960:web:d86dee6a856457436613dd",
  measurementId: "G-T39CN1MLQF"
};

let db;
let allScans = [];
let phChart = null;
let realtimeListener = null;
let isRealtimeOn = false;

// ==================== HELPER FUNCTIONS ====================
function getPH(scan)        { return scan.pH ?? scan.ph ?? null; }
function getStatus(scan)    { return scan.status || ''; }
function getMeaning(scan)   { return scan.meaning || ''; }
function getTimestamp(scan) {
    if (!scan.timestamp) return null;
    const ts = Number(scan.timestamp);
    return ts < 1e12 ? ts * 1000 : ts; // Unix seconds → milliseconds
}
function getRGBText(scan) {
    const rgb = scan.normalizedRGB || scan.rgb;
    if (!rgb) return '(--, --, --)';
    if (typeof rgb === 'object' && !Array.isArray(rgb))
        return `(${rgb.r ?? '--'}, ${rgb.g ?? '--'}, ${rgb.b ?? '--'})`;
    if (Array.isArray(rgb)) return `(${rgb.join(', ')})`;
    return String(rgb);
}
function getRawRGBText(scan) {
    const raw = scan.rawRGB;
    if (!raw) return '(--, --, --)';
    if (typeof raw === 'object' && !Array.isArray(raw))
        return `[${raw.r ?? '--'}, ${raw.g ?? '--'}, ${raw.b ?? '--'}]`;
    return String(raw);
}
function formatDate(scan) {
    const ms = getTimestamp(scan);
    if (!ms) return '--';
    const d = new Date(ms);
    return isNaN(d.getTime()) ? '--' : d.toLocaleString('id-ID');
}

// ==================== UI UPDATE ====================
function updateConnectionStatus(isOnline) {
    const el = document.getElementById('deviceStatus');
    if (!el) return;
    el.className = isOnline ? 'status-indicator online' : 'status-indicator offline';
    el.innerHTML = isOnline ? '● Online' : '● Offline';
}

function updateCurrentReading(scan) {
    if (!scan) return;

    const ph = getPH(scan);
    document.getElementById('currentPH').textContent = ph != null ? Number(ph).toFixed(2) : '--';

    const statusEl = document.getElementById('currentStatus');
    const status = getStatus(scan).toUpperCase();
    statusEl.textContent = status || '--';
    if (status === 'FRESH') statusEl.className = 'reading-status fresh';
    else if (status === 'CAUTION') statusEl.className = 'reading-status caution';
    else if (status === 'ROTTEN') statusEl.className = 'reading-status rotten';
    else statusEl.className = 'reading-status unknown';

    const meaningEl = document.getElementById('currentMeaning');
    if (meaningEl) meaningEl.textContent = getMeaning(scan) || '--';

    document.getElementById('currentRGB').textContent = getRGBText(scan);
    document.getElementById('currentRawRGB').textContent = getRawRGBText(scan);
    document.getElementById('currentTimestamp').textContent = formatDate(scan);

    const now = new Date().toLocaleString('id-ID');
    const lel = document.getElementById('lastUpdateTime');
    if (lel) lel.textContent = 'Last update: ' + now;
    const fel = document.getElementById('footerTime');
    if (fel) fel.textContent = now;
}

function updateStatistics() {
    document.getElementById('totalScans').textContent = allScans.length;
    if (allScans.length === 0) {
        document.getElementById('avgPH').textContent = '--';
        document.getElementById('freshCount').textContent = '0';
        document.getElementById('cautionCount').textContent = '0';
        document.getElementById('rottenCount').textContent = '0';
        return;
    }
    const validPH = allScans.map(s => getPH(s)).filter(v => v != null).map(Number);
    const avg = validPH.length > 0
        ? (validPH.reduce((a, b) => a + b, 0) / validPH.length).toFixed(2)
        : '--';
    document.getElementById('avgPH').textContent = avg;
    document.getElementById('freshCount').textContent   = allScans.filter(s => getStatus(s).toUpperCase() === 'FRESH').length;
    document.getElementById('cautionCount').textContent = allScans.filter(s => getStatus(s).toUpperCase() === 'CAUTION').length;
    document.getElementById('rottenCount').textContent  = allScans.filter(s => getStatus(s).toUpperCase() === 'ROTTEN').length;
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (allScans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;">Belum ada data scan</td></tr>`;
        return;
    }
    allScans.slice(-50).reverse().forEach(scan => {
        const ph = getPH(scan);
        const statusStr = getStatus(scan).toUpperCase();
        let statusStyle = '';
        if (statusStr === 'FRESH') statusStyle = 'color:green;font-weight:bold';
        else if (statusStr === 'CAUTION') statusStyle = 'color:orange;font-weight:bold';
        else if (statusStr === 'ROTTEN') statusStyle = 'color:red;font-weight:bold';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(scan)}</td>
            <td><strong>${ph != null ? Number(ph).toFixed(2) : '-'}</strong></td>
            <td style="${statusStyle}">${statusStr || '-'}</td>
            <td>${getMeaning(scan) || '-'}</td>
            <td>${getRGBText(scan)}</td>
            <td>
              <button class="btn btn-danger" style="padding:2px 8px;font-size:12px"
                onclick="deleteScan('${scan._id || ''}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderChart() {
    const canvas = document.getElementById('phChart');
    if (!canvas || allScans.length === 0) return;
    if (phChart) phChart.destroy();

    const recent = allScans.slice(-50);
    const labels = recent.map(s => {
        const ms = getTimestamp(s);
        if (!ms) return '-';
        return new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    });
    const phValues = recent.map(s => {
        const v = getPH(s);
        return v != null ? Number(v) : null;
    });
    const pointColors = recent.map(s => {
        const st = getStatus(s).toUpperCase();
        if (st === 'FRESH') return '#4CAF50';
        if (st === 'CAUTION') return '#FF9800';
        if (st === 'ROTTEN') return '#f44336';
        return '#9E9E9E';
    });

    phChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'pH Level',
                data: phValues,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76,175,80,0.1)',
                pointBackgroundColor: pointColors,
                pointRadius: 6,
                tension: 0.4,
                borderWidth: 3,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const s = recent[ctx.dataIndex];
                            return `pH: ${ctx.parsed.y} | Status: ${getStatus(s)} | ${getMeaning(s)}`;
                        }
                    }
                }
            },
            scales: {
                y: { min: 0, max: 14, title: { display: true, text: 'pH Value' } },
                x: { title: { display: true, text: 'Waktu' } }
            }
        }
    });
}

// ==================== DELETE ====================
function deleteScan(scanId) {
    if (!scanId || !db) { alert('ID tidak valid'); return; }
    if (!confirm('Hapus data scan ini?')) return;
    db.ref('scans/' + scanId).remove()
        .then(() => console.log('[Firebase] Deleted:', scanId))
        .catch(e => alert('Gagal hapus: ' + e.message));
}

function deleteOldScans() {
    if (!db || allScans.length === 0) { alert('Tidak ada data'); return; }
    if (allScans.length <= 50) { alert('Data kurang dari 50, tidak ada yang perlu dihapus'); return; }
    const toDelete = allScans.slice(0, allScans.length - 50);
    if (!confirm(`Hapus ${toDelete.length} data lama? (menyisakan 50 terbaru)`)) return;
    const updates = {};
    toDelete.forEach(s => { if (s._id) updates['scans/' + s._id] = null; });
    db.ref().update(updates)
        .then(() => alert('Data lama berhasil dihapus'))
        .catch(e => alert('Gagal: ' + e.message));
}

// ==================== FIREBASE ====================
function processSnapshot(snapshot) {
    allScans = [];
    snapshot.forEach(child => {
        const val = child.val();
        val._id = child.key;
        allScans.push(val);
    });
    allScans.sort((a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0));
    console.log(`[Firebase] ${allScans.length} scans loaded`);

    if (allScans.length > 0) updateCurrentReading(allScans[allScans.length - 1]);
    renderTable();
    renderChart();
    updateStatistics();
}

function fetchAllScans() {
    if (!db) return;
    const tbody = document.getElementById('tableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px">⏳ Memuat data...</td></tr>';

    db.ref('scans').once('value', processSnapshot, error => {
        console.error('[Firebase] Error:', error);
        updateConnectionStatus(false);
        if (tbody) tbody.innerHTML = `
          <tr><td colspan="6" style="text-align:center;color:red;padding:20px">
            ❌ Gagal membaca data: <strong>${error.message}</strong><br><br>
            Buka <strong>Firebase Console → Realtime Database → Rules</strong><br>
            Set: <code>{ "rules": { ".read": true, ".write": true } }</code>
          </td></tr>`;
    });
}

function startRealtimeListener() {
    if (!db || realtimeListener) return;
    realtimeListener = db.ref('scans').on('value', processSnapshot, err => {
        console.error('[Realtime] Error:', err);
    });
    isRealtimeOn = true;
}

function stopRealtimeListener() {
    if (!db) return;
    db.ref('scans').off('value', realtimeListener);
    realtimeListener = null;
    isRealtimeOn = false;
}

function initializeFirebase() {
    try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        db.ref('.info/connected').on('value', snap => updateConnectionStatus(snap.val() === true));
        fetchAllScans();
    } catch (err) {
        console.error('[Firebase] Init failed:', err);
        updateConnectionStatus(false);
    }
}

// ==================== INIT ====================
window.addEventListener('load', () => {
    initializeFirebase();

    document.getElementById('refreshBtn').addEventListener('click', () => {
        if (!isRealtimeOn && db) fetchAllScans();
        else if (isRealtimeOn) alert('Real-time aktif — data otomatis diperbarui');
    });

    document.getElementById('realtimeToggle').addEventListener('click', function() {
        if (isRealtimeOn) {
            stopRealtimeListener();
            this.textContent = '⏱️ Real-time: OFF';
            this.classList.remove('active');
        } else {
            startRealtimeListener();
            this.textContent = '⏱️ Real-time: ON';
            this.classList.add('active');
        }
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        if (allScans.length === 0) { alert('Belum ada data'); return; }
        let csv = 'Timestamp,pH,Status,Meaning,NormalizedRGB,RawRGB\n';
        allScans.forEach(s => {
            const ms = getTimestamp(s);
            const time = ms ? new Date(ms).toLocaleString('id-ID') : '';
            csv += `"${time}","${getPH(s) || ''}","${getStatus(s)}","${getMeaning(s)}","${getRGBText(s)}","${getRawRGBText(s)}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ph-scans.csv';
        a.click();
    });

    document.getElementById('deleteOldBtn').addEventListener('click', deleteOldScans);

    document.getElementById('deleteAllBtn').addEventListener('click', () => {
        if (!confirm('Yakin mau hapus SEMUA data scan?')) return;
        if (!db) return;
        db.ref('scans').remove()
            .then(() => { allScans = []; renderTable(); updateStatistics(); alert('Semua data dihapus'); })
            .catch(e => alert('Gagal: ' + e.message));
    });
});

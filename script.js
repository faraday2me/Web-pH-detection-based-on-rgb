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
function updateConnectionStatus(isOnline) {
    const statusEl = document.getElementById('deviceStatus');
    if (statusEl) {
        statusEl.className = isOnline ? 'status-indicator online' : 'status-indicator offline';
        statusEl.innerHTML = isOnline ? '● Online' : '● Offline';
    }
}

function updateCurrentReading(scan) {
    if (!scan) return;

    document.getElementById('currentPH').textContent = scan.ph ? Number(scan.ph).toFixed(2) : '--';

    const statusEl = document.getElementById('currentStatus');
    const status = (scan.status || 'Unknown').toUpperCase();
    statusEl.textContent = status;
    if (status === 'FRESH') statusEl.className = 'reading-status fresh';
    else if (status === 'CAUTION') statusEl.className = 'reading-status caution';
    else if (status === 'ROTTEN') statusEl.className = 'reading-status rotten';
    else statusEl.className = 'reading-status unknown';

    // FIX 1: Meaning sekarang diupdate
    const meaningEl = document.getElementById('currentMeaning');
    if (meaningEl) meaningEl.textContent = scan.meaning || '--';

    let rgbText = '(--, --, --)';
    if (scan.rgb) rgbText = Array.isArray(scan.rgb) ? `(${scan.rgb.join(', ')})` : scan.rgb;
    document.getElementById('currentRGB').textContent = rgbText;

    let rawText = '(--, --, --)';
    if (scan.rawRGB) rawText = typeof scan.rawRGB === 'object' ? `[${Object.values(scan.rawRGB).join(', ')}]` : scan.rawRGB;
    document.getElementById('currentRawRGB').textContent = rawText;

    let timeStr = '--';
    if (scan.timestamp) {
        const date = new Date(scan.timestamp);
        if (!isNaN(date.getTime())) timeStr = date.toLocaleString('id-ID');
    }
    document.getElementById('currentTimestamp').textContent = timeStr;

    const now = new Date().toLocaleString('id-ID');
    const lastUpdateEl = document.getElementById('lastUpdateTime');
    if (lastUpdateEl) lastUpdateEl.textContent = 'Last update: ' + now;
    const footerEl = document.getElementById('footerTime');
    if (footerEl) footerEl.textContent = now;
}

// FIX 2: Statistik yang sebelumnya tidak pernah dihitung
function updateStatistics() {
    document.getElementById('totalScans').textContent = allScans.length;
    if (allScans.length === 0) {
        document.getElementById('avgPH').textContent = '--';
        document.getElementById('freshCount').textContent = '0';
        document.getElementById('cautionCount').textContent = '0';
        document.getElementById('rottenCount').textContent = '0';
        return;
    }
    const validPH = allScans.filter(s => s.ph != null).map(s => Number(s.ph));
    const avg = validPH.length > 0 ? (validPH.reduce((a, b) => a + b, 0) / validPH.length).toFixed(2) : '--';
    document.getElementById('avgPH').textContent = avg;
    document.getElementById('freshCount').textContent = allScans.filter(s => (s.status||'').toUpperCase() === 'FRESH').length;
    document.getElementById('cautionCount').textContent = allScans.filter(s => (s.status||'').toUpperCase() === 'CAUTION').length;
    document.getElementById('rottenCount').textContent = allScans.filter(s => (s.status||'').toUpperCase() === 'ROTTEN').length;
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
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${scan.timestamp ? new Date(scan.timestamp).toLocaleString('id-ID') : '-'}</td>
            <td><strong>${scan.ph ? Number(scan.ph).toFixed(2) : '-'}</strong></td>
            <td>${scan.status || '-'}</td>
            <td>${scan.meaning || '-'}</td>
            <td>${scan.rgb || '-'}</td>
            <td><button class="btn btn-danger" style="padding:2px 8px;font-size:12px" onclick="deleteScan('${scan.id || ''}')">🗑️</button></td>
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
        try { return new Date(s.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}); }
        catch(e) { return '-'; }
    });
    const phValues = recent.map(s => s.ph ? Number(s.ph) : null);
    const pointColors = recent.map(s => {
        const st = (s.status || '').toUpperCase();
        if (st === 'FRESH') return '#4CAF50';
        if (st === 'CAUTION') return '#FF9800';
        if (st === 'ROTTEN') return '#f44336';
        return '#9E9E9E';
    });
    phChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'pH Level',
                data: phValues,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                pointBackgroundColor: pointColors,
                pointRadius: 5,
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
                        label: ctx => `pH: ${ctx.parsed.y} | ${recent[ctx.dataIndex]?.status || '-'}`
                    }
                }
            },
            scales: { y: { min: 0, max: 14 } }
        }
    });
}

// ==================== DELETE ====================
function deleteScan(scanId) {
    if (!scanId || !db) return;
    if (!confirm('Hapus data ini?')) return;
    db.ref('scans/' + scanId).remove();
}

function deleteOldScans() {
    if (!db || allScans.length <= 50) {
        alert(allScans.length === 0 ? 'Tidak ada data' : 'Data kurang dari 50, tidak ada yang dihapus');
        return;
    }
    const toDelete = allScans.slice(0, allScans.length - 50);
    if (!confirm(`Hapus ${toDelete.length} data lama? (menyisakan 50 terbaru)`)) return;
    const updates = {};
    toDelete.forEach(s => { if (s.id) updates['scans/' + s.id] = null; });
    db.ref().update(updates).then(() => alert('Data lama berhasil dihapus'));
}

// ==================== FIREBASE ====================
function fetchAllScans() {
    if (!db) return;
    const tbody = document.getElementById('tableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">⏳ Memuat data...</td></tr>';

    // FIX 3: orderByChild('timestamp') untuk sorting yang benar
    db.ref('scans').orderByChild('timestamp').once('value', (snapshot) => {
        allScans = [];
        snapshot.forEach(child => {
            const val = child.val();
            val.id = child.key; // simpan key untuk delete
            allScans.push(val);
        });
        console.log(`[Firebase] Loaded ${allScans.length} scans`);
        if (allScans.length > 0) updateCurrentReading(allScans[allScans.length - 1]);
        renderTable();
        renderChart();
        updateStatistics();
    }, (error) => {
        console.error('[Firebase] Read error:', error);
        updateConnectionStatus(false);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;padding:20px">
            ❌ Gagal membaca data: ${error.message}<br><br>
            <strong>Cek Firebase Rules:</strong><br>
            Buka Firebase Console → Realtime Database → Rules<br>
            Ubah ke: <code>{"rules": {".read": true, ".write": true}}</code>
        </td></tr>`;
    });
}

// FIX 4: Realtime listener yang benar-benar bekerja
function startRealtimeListener() {
    if (!db || realtimeListener) return;
    realtimeListener = db.ref('scans').orderByChild('timestamp').on('value', (snapshot) => {
        allScans = [];
        snapshot.forEach(child => {
            const val = child.val();
            val.id = child.key;
            allScans.push(val);
        });
        if (allScans.length > 0) updateCurrentReading(allScans[allScans.length - 1]);
        renderTable();
        renderChart();
        updateStatistics();
    });
    isRealtimeOn = true;
}

function stopRealtimeListener() {
    if (!db || !realtimeListener) return;
    db.ref('scans').off('value', realtimeListener);
    realtimeListener = null;
    isRealtimeOn = false;
}

function initializeFirebase() {
    try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        db = firebase.database();

        // Monitor koneksi real dari Firebase
        db.ref('.info/connected').on('value', (snap) => updateConnectionStatus(snap.val() === true));

        fetchAllScans();
    } catch (error) {
        console.error('[Firebase] Init error:', error);
        updateConnectionStatus(false);
    }
}

// ==================== INIT ====================
window.addEventListener('load', () => {
    initializeFirebase();

    document.getElementById('refreshBtn').addEventListener('click', () => {
        if (db) fetchAllScans();
    });

    // FIX 5: Realtime toggle yang benar-benar berfungsi
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
        if (allScans.length === 0) { alert('Belum ada data untuk diekspor'); return; }
        let csv = 'Timestamp,pH,Status,Meaning,RGB\n';
        allScans.forEach(scan => {
            csv += `"${scan.timestamp}","${scan.ph||''}","${scan.status||''}","${scan.meaning||''}","${scan.rgb||''}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'ph-scans.csv'; a.click();
    });

    // FIX 6: deleteOldBtn sekarang ada listener-nya
    document.getElementById('deleteOldBtn').addEventListener('click', deleteOldScans);

    document.getElementById('deleteAllBtn').addEventListener('click', () => {
        if (confirm('Yakin mau hapus SEMUA data?')) {
            if (db) {
                db.ref('scans').remove().then(() => {
                    allScans = [];
                    renderTable();
                    updateStatistics();
                    alert('Semua data berhasil dihapus');
                });
            }
        }
    });
});

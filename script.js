// pH Detection Dashboard - Main Logic

// ===== FIREBASE CONFIG =====
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

// ===== GLOBAL VARIABLES =====
let db;
let allScans = [];
let phChart = null;
let isRealtimeEnabled = false;
let realtimeListener = null;

// ===== HELPER FUNCTIONS =====
function updateConnectionStatus(isOnline) {
    const statusEl = document.getElementById('deviceStatus');
    if (statusEl) {
        if (isOnline) {
            statusEl.className = 'status-indicator online';
            statusEl.innerHTML = '● Online';
        } else {
            statusEl.className = 'status-indicator offline';
            statusEl.innerHTML = '● Offline';
        }
    }
}

function fetchAllScans() {
    if (!db) {
        console.error("[Firebase] Database belum siap");
        return;
    }
    
    console.log("[Firebase] Fetching all scans...");
    
    db.ref('scans').once('value', (snapshot) => {
        allScans = [];
        
        snapshot.forEach((child) => {
            const data = child.val();
            allScans.push(data);
        });

        console.log(`[Firebase] Loaded ${allScans.length} scans`);
        
        // Update semua tampilan
        if (allScans.length > 0) {
            const latest = allScans[allScans.length - 1];  // data terbaru
            updateCurrentReading(latest);
        }
        
        renderTable();
        renderChart();
        
    }, (error) => {
        console.error("[Firebase] Error fetching data:", error);
    });
}

// ===== RENDER TABLE (Sesuai HTML kamu) =====
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (allScans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px;">Belum ada data scan</td></tr>`;
        return;
    }

    allScans.slice(-50).reverse().forEach(scan => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${scan.timestamp ? new Date(scan.timestamp).toLocaleString('id-ID') : '-'}</td>
            <td>${scan.ph ? scan.ph.toFixed(2) : '-'}</td>
            <td>${scan.status || 'Normal'}</td>
            <td>${scan.meaning || '-'}</td>
            <td>${scan.rgb ? scan.rgb : '-'}</td>
            <td><button class="btn btn-small" onclick="deleteScan('${scan.id || ''}')">Hapus</button></td>
        `;
        tbody.appendChild(row);
    });
}

// ===== UPDATE CURRENT READING & STATUS =====
function updateCurrentReading(scan) {
    if (!scan) return;

    document.getElementById('currentPH').textContent = scan.ph ? scan.ph.toFixed(2) : '--';
    document.getElementById('currentRGB').textContent = scan.rgb || '(--, --, --)';
    document.getElementById('currentRawRGB').textContent = scan.rawRGB || '(--, --, --)';
    document.getElementById('currentTimestamp').textContent = scan.timestamp ? 
        new Date(scan.timestamp).toLocaleString('id-ID') : '--';

    const statusEl = document.getElementById('currentStatus');
    statusEl.textContent = scan.status || '--';

    if (scan.status === "Fresh") statusEl.className = "reading-status fresh";
    else if (scan.status === "Caution") statusEl.className = "reading-status caution";
    else if (scan.status === "Rotten") statusEl.className = "reading-status rotten";
}

// ===== RENDER TABLE =====
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (allScans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#888;">Belum ada data dari sensor</td></tr>`;
        return;
    }

    allScans.slice(-50).reverse().forEach((scan, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${scan.timestamp ? new Date(scan.timestamp).toLocaleString('id-ID') : '-'}</td>
            <td><strong>${scan.ph ? scan.ph.toFixed(2) : '-'}</strong></td>
            <td>${scan.status || '-'}</td>
            <td>${scan.meaning || '-'}</td>
            <td>${scan.rgb || '-'}</td>
            <td></td>
        `;
        tbody.appendChild(row);
    });
}

// ===== MAIN INITIALIZE =====
function initializeFirebase() {
    try {
        console.log("[Firebase] Starting initialization...");

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("[Firebase] App initialized successfully");
        }

        db = firebase.database();
        console.log("[Firebase] Database ready");

        // Update status ke Online
        document.getElementById('deviceStatus').className = 'status-indicator online';
        document.getElementById('deviceStatus').innerHTML = '● Online';

        // Ambil data
        fetchAllScans();

    } catch (error) {
        console.error("[Firebase] Critical Error:", error);
        document.getElementById('deviceStatus').className = 'status-indicator offline';
        document.getElementById('deviceStatus').innerHTML = '● Firebase Error';
    }
}

// ===== INISIALISASI =====
function initializeFirebase() {
    try {
        console.log("[Firebase] Starting initialization...");

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("[Firebase] App initialized");
        }

        db = firebase.database();
        console.log("[Firebase] Database ready");

        updateConnectionStatus(true);
        fetchAllScans();           // ambil data

    } catch (error) {
        console.error("[Firebase] Error:", error);
        updateConnectionStatus(false);
    }
}

// ===== RENDER CHART =====
function renderChart() {
    const canvas = document.getElementById('phChart');
    if (!canvas) {
        console.warn("[Chart] Canvas phChart tidak ditemukan");
        return;
    }

    if (phChart) {
        phChart.destroy();
    }

    if (allScans.length === 0) return;

    const recent = allScans.slice(-50);
    const labels = recent.map(scan => {
        return scan.timestamp ? new Date(scan.timestamp).toLocaleTimeString('id-ID') : '';
    });
    const phValues = recent.map(scan => scan.ph || 0);

    phChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'pH Level',
                data: phValues,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.4,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    min: 0,
                    max: 14,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });

    console.log(`[Chart] Berhasil render ${phValues.length} data`);
}

// Jalankan saat halaman load
window.addEventListener('load', initializeFirebase);

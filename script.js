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

// Fetch data dari Firebase
function fetchAllScans() {
    if (!db) return;
    
    console.log("[Firebase] Fetching all scans...");
    
    db.ref('scans').once('value', (snapshot) => {
        allScans = [];
        snapshot.forEach((child) => {
            allScans.push(child.val());
        });
        console.log(`[Firebase] Loaded ${allScans.length} scans`);
        renderTable();
        renderChart();
    });
}

// Render tabel (sesuaikan dengan struktur HTML kamu)
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (allScans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada data sensor</td></tr>';
        return;
    }
    
    allScans.slice(-10).reverse().forEach(scan => {   // tampilkan 10 data terakhir
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${scan.timestamp || '-'}</td>
            <td>${scan.ph || '-'}</td>
            <td>${scan.rgb || '-'}</td>
            <td>${scan.temperature || '-'}</td>
            <td>${scan.status || 'Normal'}</td>
        `;
        tbody.appendChild(row);
    });
}

// Render Chart (kosongkan dulu biar tidak error)
function renderChart() {
    console.log("[Chart] Render chart called");
    // Tambahkan kode chart kalau sudah ada
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

// Jalankan saat halaman load
window.addEventListener('load', initializeFirebase);

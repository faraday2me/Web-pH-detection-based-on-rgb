// ===== pH Detection Dashboard - Full Script =====
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

// Global Variables
let db;
let allScans = [];
let phChart = null;

// ==================== HELPER FUNCTIONS ====================
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

function updateCurrentReading(scan) {
    if (!scan) return;

    // pH Value
    document.getElementById('currentPH').textContent = scan.ph ? Number(scan.ph).toFixed(2) : '--';

    // Status
    const statusEl = document.getElementById('currentStatus');
    const status = (scan.status || 'Caution').toUpperCase();
    statusEl.textContent = status;

    if (status === 'FRESH') statusEl.className = 'reading-status fresh';
    else if (status === 'CAUTION') statusEl.className = 'reading-status caution';
    else if (status === 'ROTTEN') statusEl.className = 'reading-status rotten';
    else statusEl.className = 'reading-status unknown';

    // RGB
    let rgbText = '(--, --, --)';
    if (scan.rgb) {
        rgbText = Array.isArray(scan.rgb) ? `(${scan.rgb.join(', ')})` : scan.rgb;
    }
    document.getElementById('currentRGB').textContent = rgbText;

    // Raw RGB
    let rawText = '(--, --, --)';
    if (scan.rawRGB) {
        rawText = typeof scan.rawRGB === 'object' ? 
                  `[${Object.values(scan.rawRGB).join(', ')}]` : scan.rawRGB;
    }
    document.getElementById('currentRawRGB').textContent = rawText;

    // Timestamp
    let timeStr = '--';
    if (scan.timestamp) {
        const date = new Date(scan.timestamp);
        if (!isNaN(date.getTime())) timeStr = date.toLocaleString('id-ID');
    }
    document.getElementById('currentTimestamp').textContent = timeStr;
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
            <td></td>
        `;
        tbody.appendChild(row);
    });
}

function renderChart() {
    const canvas = document.getElementById('phChart');
    if (!canvas || allScans.length === 0) return;

    if (phChart) phChart.destroy();

    const recent = allScans.slice(-50);
    const labels = recent.map(s => new Date(s.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}));
    const phValues = recent.map(s => s.ph || 0);

    phChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'pH Level',
                data: phValues,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 0, max: 14 } }
        }
    });
}

// ==================== FIREBASE FUNCTIONS ====================
function fetchAllScans() {
    if (!db) return;

    console.log("[Firebase] Fetching all scans...");
    
    db.ref('scans').once('value', (snapshot) => {
        allScans = [];
        snapshot.forEach(child => allScans.push(child.val()));

        console.log(`[Firebase] Loaded ${allScans.length} scans`);

        if (allScans.length > 0) {
            updateCurrentReading(allScans[allScans.length - 1]);
        }

        renderTable();
        renderChart();
    });
}

function initializeFirebase() {
    try {
        console.log("[Firebase] Starting initialization...");

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("[Firebase] App initialized successfully");
        }

        db = firebase.database();
        console.log("[Firebase] Database ready");

        updateConnectionStatus(true);
        fetchAllScans();

    } catch (error) {
        console.error("[Firebase] Error:", error);
        updateConnectionStatus(false);
    }
}

// ==================== INIT ====================
window.addEventListener('load', () => {
    initializeFirebase();
});

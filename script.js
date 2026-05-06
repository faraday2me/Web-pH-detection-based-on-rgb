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

// ===== FIREBASE INITIALIZATION (UPDATED) =====
function initializeFirebase() {
    try {
        console.log("[Firebase] Starting initialization...");

        // Initialize Firebase hanya sekali
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("[Firebase] App initialized successfully");
        }

        db = firebase.database();
        console.log("[Firebase] Database instance created");

        // Update status
        updateConnectionStatus(true);

        // Test koneksi
        testFirebaseConnection();

    } catch (error) {
        console.error("[Firebase] Initialization Error:", error);
        updateConnectionStatus(false);
    }
}

// Helper untuk update status
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

// Test Connection
function testFirebaseConnection() {
    if (!db) return;

    db.ref('.info/connected').on('value', (snapshot) => {
        const isConnected = snapshot.val() === true;
        console.log("[Firebase] Realtime connection:", isConnected ? "CONNECTED" : "DISCONNECTED");
        updateConnectionStatus(isConnected);
        
        if (isConnected) {
            fetchAllScans();   // ambil data
        }
    });
}

// ===== TEST FIREBASE CONNECTION =====
function testFirebaseConnection() {
    try {
        console.log("[Firebase] Testing connection...");
        
        db.ref('.info/connected').on('value', (snapshot) => {
            if (snapshot.val() === true) {
                console.log("[Firebase] ✓ Connected to realtime database");
                document.getElementById('deviceStatus').className = 'status-indicator online';
                document.getElementById('deviceStatus').textContent = '● Online';
                
                // Fetch data setelah connected
                fetchAllScans();
            } else {
                console.log("[Firebase] ✗ Disconnected from database");
                document.getElementById('deviceStatus').className = 'status-indicator offline';
                document.getElementById('deviceStatus').textContent = '● Offline';
            }
        });
    } catch (error) {
        console.error("[Firebase] Connection test error:", error);
    }
}

// Jalankan saat halaman selesai load
window.addEventListener('load', () => {
    initializeFirebase();
});

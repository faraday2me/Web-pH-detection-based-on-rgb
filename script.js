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
let isRealtimeEnabled = true;
let realtimeListener = null;

// ===== FIREBASE INITIALIZATION (FIXED) =====
function initializeFirebase() {
    try {
        console.log("[Firebase] Starting initialization...");
        console.log("[Firebase] Config:", firebaseConfig);
        
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        console.log("[Firebase] ✓ App initialized");
        
        // Get database reference
        db = firebase.database();
        console.log("[Firebase] ✓ Database reference created");
        console.log("[Firebase] Database URL:", firebaseConfig.databaseURL);
        
        showNotification("Connected", "Firebase connected!");
        document.getElementById('deviceStatus').className = 'status-indicator online';
        document.getElementById('deviceStatus').textContent = '● Online';
        
        // Test connection
        setTimeout(() => {
            testFirebaseConnection();
        }, 500);
        
    } catch (error) {
        console.error("[Firebase] Initialization failed:", error);
        console.error("[Firebase] Error message:", error.message);
        showNotification("Error", "Firebase Error: " + error.message);
        document.getElementById('deviceStatus').className = 'status-indicator offline';
        document.getElementById('deviceStatus').textContent = '● Offline';
    }
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

// REST OF CODE SAMA SEPERTI SEBELUMNYA...
// (Copy semua function lainnya dari script.js lama)

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
        console.log("[Firebase] Initializing with config...");
        console.log("[Firebase] Database URL:", firebaseConfig.databaseURL);
        
        // Check apakah Firebase sudah di-initialize
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("[Firebase] ✓ SDK initialized");
        }
        
        db = firebase.database();
        console.log("[Firebase] ✓ Database instance created");
        
        showNotification("Success", "Connected to Firebase!");
        document.getElementById('deviceStatus').className = 'status-indicator online';
        document.getElementById('deviceStatus').textContent = '● Online';
        
        // Test connection
        testFirebaseConnection();
        
    } catch (error) {
        console.error("[Firebase] Initialization error:", error);
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
                console.log("[Firebase] ✓ Connected to database");
                document.getElementById('deviceStatus').className = 'status-indicator online';
                document.getElementById('deviceStatus').textContent = '● Online';
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

// ===== UTILITY: Format Timestamp =====
function formatTime(timestamp) {
    if (!timestamp) return '--';
    const date = new Date(timestamp * 1000);
    const time = date.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    const dateStr = date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return `${time} ${dateStr}`;
}

// ===== UTILITY: Get Status Color =====
function getStatusColor(status) {
    switch(status) {
        case 'FRESH': return '#4CAF50';
        case 'CAUTION': return '#FF9800';
        case 'ROTTEN': return '#F44336';
        default: return '#9E9E9E';
    }
}

// ===== UTILITY: Get Status Class =====
function getStatusClass(status) {
    return `status-${status.toLowerCase()}`;
}

// ===== NOTIFICATION MODAL =====
function showNotification(title, message) {
    const modal = document.getElementById('notificationModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    modal.style.display = 'block';
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 3000);
}

// Close modal when clicking X
document.querySelector('.close').onclick = function() {
    document.getElementById('notificationModal').style.display = 'none';
}

// ===== CONFIRMATION MODAL =====
function showConfirmation(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('confirmationModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    const confirmBtn = document.getElementById('confirmYes');
    const cancelBtn = document.getElementById('confirmNo');
    
    // Remove old event listeners
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    
    modal.style.display = 'block';
    
    confirmBtn.onclick = function() {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    };
    
    cancelBtn.onclick = function() {
        modal.style.display = 'none';
        if (onCancel) onCancel();
    };
    
    // Close saat click X
    document.getElementById('confirmClose').onclick = function() {
        modal.style.display = 'none';
        if (onCancel) onCancel();
    };
}

// ===== UPDATE CURRENT READING UI =====
function updateCurrentReading(scan) {
    if (!scan) return;

    const ph = scan.pH || '--';
    const status = scan.status || '--';
    const meaning = scan.meaning || '--';
    const timestamp = scan.timestamp;
    
    const normalizedRGB = scan.normalizedRGB || {};
    const rawRGB = scan.rawRGB || {};
    
    const r_norm = normalizedRGB.r || '--';
    const g_norm = normalizedRGB.g || '--';
    const b_norm = normalizedRGB.b || '--';
    
    const r_raw = rawRGB.r || '--';
    const g_raw = rawRGB.g || '--';
    const b_raw = rawRGB.b || '--';

    // Update values
    document.getElementById('currentPH').textContent = ph.toFixed(1);
    
    const statusEl = document.getElementById('currentStatus');
    statusEl.textContent = status;
    statusEl.className = `reading-status ${getStatusClass(status)}`;
    
    document.getElementById('currentMeaning').textContent = meaning;
    document.getElementById('currentRGB').textContent = `(${r_norm}, ${g_norm}, ${b_norm})`;
    document.getElementById('currentRawRGB').textContent = `(${r_raw}, ${g_raw}, ${b_raw})`;
    document.getElementById('currentTimestamp').textContent = formatTime(timestamp);
    document.getElementById('lastUpdateTime').textContent = `Last update: ${formatTime(timestamp)}`;
}

// ===== FETCH ALL SCANS (FIXED) =====
async function fetchAllScans() {
    try {
        // Check apakah db sudah initialized
        if (!db) {
            console.error("Database not initialized");
            showNotification("Error", "Database not initialized. Refresh page.");
            return;
        }

        console.log("[Firebase] Fetching scans...");
        
        const snapshot = await db.ref('scans').orderByChild('timestamp').limitToLast(50).once('value');
        
        if (!snapshot.exists()) {
            console.log("[Firebase] No scans found");
            allScans = [];
            updateCurrentReading(null);
            updateHistoryTable([]);
            updateStatistics([]);
            return;
        }

        const data = snapshot.val();
        console.log("[Firebase] Data received:", data);
        
        allScans = [];
        
        // Convert object to array dan reverse (newest first)
        Object.keys(data).reverse().forEach(key => {
            allScans.push({
                id: key,
                ...data[key]
            });
        });

        console.log(`[Firebase] ✓ Loaded ${allScans.length} scans`);
        
        // Update UI
        if (allScans.length > 0) {
            updateCurrentReading(allScans[0]);
        }
        updateHistoryTable(allScans);
        updateStatistics(allScans);
        updateChart(allScans);
        
    } catch (error) {
        console.error("[Firebase] Error fetching scans:", error);
        showNotification("Error", "Failed to fetch scans: " + error.message);
    }
}

// ===== UPDATE HISTORY TABLE =====
function updateHistoryTable(scans) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (scans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No data available</td></tr>';
        return;
    }

    scans.forEach((scan, index) => {
        const row = document.createElement('tr');
        
        const time = formatTime(scan.timestamp);
        const ph = scan.pH ? scan.pH.toFixed(1) : '--';
        const status = scan.status || '--';
        const meaning = scan.meaning || '--';
        const rgb = scan.normalizedRGB || {};
        const rgbText = `(${rgb.r || '--'}, ${rgb.g || '--'}, ${rgb.b || '--'})`;
        
        row.innerHTML = `
            <td>${time}</td>
            <td>${ph}</td>
            <td class="${getStatusClass(status)}">${status}</td>
            <td>${meaning}</td>
            <td><code>${rgbText}</code></td>
            <td>
                <button class="btn-delete-item" data-scan-id="${scan.id}" data-index="${index}">🗑️ Delete</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });

    // Add event listeners untuk delete button
    document.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const scanId = e.target.getAttribute('data-scan-id');
            const index = e.target.getAttribute('data-index');
            deleteSpecificScan(scanId, index);
        });
    });
}

// ===== UPDATE STATISTICS =====
function updateStatistics(scans) {
    if (scans.length === 0) {
        document.getElementById('totalScans').textContent = '0';
        document.getElementById('avgPH').textContent = '--';
        document.getElementById('freshCount').textContent = '0';
        document.getElementById('cautionCount').textContent = '0';
        document.getElementById('rottenCount').textContent = '0';
        return;
    }

    const total = scans.length;
    const avgPH = (scans.reduce((sum, s) => sum + s.pH, 0) / total).toFixed(2);
    const freshCount = scans.filter(s => s.status === 'FRESH').length;
    const cautionCount = scans.filter(s => s.status === 'CAUTION').length;
    const rottenCount = scans.filter(s => s.status === 'ROTTEN').length;

    document.getElementById('totalScans').textContent = total;
    document.getElementById('avgPH').textContent = avgPH;
    document.getElementById('freshCount').textContent = freshCount;
    document.getElementById('cautionCount').textContent = cautionCount;
    document.getElementById('rottenCount').textContent = rottenCount;
}

// ===== UPDATE CHART =====
function updateChart(scans) {
    const ctx = document.getElementById('phChart').getContext('2d');
    
    // Prepare data (reverse untuk oldest first)
    const reversedScans = [...scans].reverse();
    const labels = reversedScans.map(s => formatTime(s.timestamp).split(' ')[0]);
    const phData = reversedScans.map(s => s.pH);
    const colors = reversedScans.map(s => getStatusColor(s.status));

    // Destroy old chart if exists
    if (phChart) phChart.destroy();

    // Create new chart
    phChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'pH Value',
                data: phData,
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: colors,
                pointBorderColor: colors,
                pointRadius: 5,
                pointHoverRadius: 7,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'pH: ' + context.raw.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 14,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'pH Value'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                }
            }
        }
    });
}

// ===== EXPORT TO CSV =====
function exportToCSV() {
    if (allScans.length === 0) {
        showNotification("Warning", "No data to export");
        return;
    }

    let csv = 'Timestamp,pH,Status,Meaning,RGB(R),RGB(G),RGB(B)\n';
    
    allScans.forEach(scan => {
        const time = formatTime(scan.timestamp);
        const ph = scan.pH ? scan.pH.toFixed(2) : '--';
        const status = scan.status || '--';
        const meaning = scan.meaning || '--';
        const rgb = scan.normalizedRGB || {};
        const r = rgb.r || '--';
        const g = rgb.g || '--';
        const b = rgb.b || '--';
        
        csv += `"${time}",${ph},"${status}","${meaning}",${r},${g},${b}\n`;
    });

    // Download file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pH_Scans_${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showNotification("Success", "CSV exported successfully!");
}

// ===== DELETE SPECIFIC SCAN =====
async function deleteSpecificScan(scanId, index) {
    showConfirmation(
        "Delete Scan?",
        `Delete scan at index ${parseInt(index) + 1}?\n\nThis action cannot be undone.`,
        async () => {
            try {
                await db.ref(`scans/${scanId}`).remove();
                showNotification("Success", "Scan deleted successfully!");
                fetchAllScans();
            } catch (error) {
                console.error("Error deleting scan:", error);
                showNotification("Error", "Failed to delete scan: " + error.message);
            }
        }
    );
}

// ===== DELETE ALL SCANS =====
function deleteAllScans() {
    showConfirmation(
        "⚠️ Delete All Scans?",
        `This will delete ALL ${allScans.length} scans from the database.\n\nThis action CANNOT be undone!`,
        async () => {
            try {
                document.getElementById('deleteAllBtn').disabled = true;
                showNotification("Deleting", "Deleting all scans...");
                
                await db.ref('scans').remove();
                
                allScans = [];
                updateCurrentReading(null);
                updateHistoryTable([]);
                updateStatistics([]);
                updateChart([]);
                
                showNotification("Success", "All scans deleted successfully!");
                document.getElementById('deleteAllBtn').disabled = false;
            } catch (error) {
                console.error("Error deleting all scans:", error);
                showNotification("Error", "Failed to delete scans: " + error.message);
                document.getElementById('deleteAllBtn').disabled = false;
            }
        }
    );
}

// ===== DELETE SCANS OLDER THAN X DAYS =====
function deleteOldScans() {
    const days = prompt("Delete scans older than how many days?\n\nEnter number of days (e.g., 7 untuk 7 hari lalu):");
    
    if (days === null) return; // User cancel
    
    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum < 0) {
        showNotification("Error", "Invalid input. Please enter a positive number.");
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    const oldestTimestamp = now - (daysNum * 24 * 60 * 60);
    
    const scansToDelete = allScans.filter(scan => scan.timestamp < oldestTimestamp);
    
    if (scansToDelete.length === 0) {
        showNotification("Info", `No scans older than ${daysNum} days found.`);
        return;
    }

    showConfirmation(
        "Delete Old Scans?",
        `Found ${scansToDelete.length} scans older than ${daysNum} days.\n\nDelete them?`,
        async () => {
            try {
                showNotification("Deleting", `Deleting ${scansToDelete.length} old scans...`);
                
                for (let scan of scansToDelete) {
                    await db.ref(`scans/${scan.id}`).remove();
                }
                
                showNotification("Success", `Deleted ${scansToDelete.length} old scans!`);
                fetchAllScans();
            } catch (error) {
                console.error("Error deleting old scans:", error);
                showNotification("Error", "Failed to delete old scans: " + error.message);
            }
        }
    );
}

// ===== REAL-TIME LISTENER =====
function setupRealtimeListener() {
    if (realtimeListener) {
        db.ref('scans').orderByChild('timestamp').limitToLast(50).off('value', realtimeListener);
    }

    realtimeListener = db.ref('scans').orderByChild('timestamp').limitToLast(50).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            allScans = [];
            
            Object.keys(data).reverse().forEach(key => {
                allScans.push({
                    id: key,
                    ...data[key]
                });
            });

            // Update UI realtime
            updateCurrentReading(allScans[0]);
            updateHistoryTable(allScans);
            updateStatistics(allScans);
            updateChart(allScans);
            
            // Update footer time
            document.getElementById('footerTime').textContent = formatTime(allScans[0].timestamp);
        }
    });
}

// ===== STOP REAL-TIME LISTENER =====
function stopRealtimeListener() {
    if (realtimeListener) {
        db.ref('scans').off('value', realtimeListener);
        realtimeListener = null;
    }
}

// ===== BUTTON EVENTS =====
document.getElementById('refreshBtn').addEventListener('click', () => {
    document.getElementById('refreshBtn').disabled = true;
    fetchAllScans().then(() => {
        document.getElementById('refreshBtn').disabled = false;
    });
});

document.getElementById('exportBtn').addEventListener('click', exportToCSV);

document.getElementById('deleteAllBtn').addEventListener('click', deleteAllScans);

document.getElementById('deleteOldBtn').addEventListener('click', deleteOldScans);

document.getElementById('realtimeToggle').addEventListener('click', (e) => {
    isRealtimeEnabled = !isRealtimeEnabled;
    const btn = e.target;
    
    if (isRealtimeEnabled) {
        btn.classList.add('active');
        btn.textContent = '⏱️ Real-time: ON';
        setupRealtimeListener();
        showNotification("Info", "Real-time monitoring enabled");
    } else {
        btn.classList.remove('active');
        btn.textContent = '⏱️ Real-time: OFF';
        stopRealtimeListener();
        showNotification("Info", "Real-time monitoring disabled");
    }
});

// ===== PAGE LOAD =====
window.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    
    // Delay untuk pastikan Firebase initialized
    setTimeout(() => {
        fetchAllScans();
        setupRealtimeListener();
    }, 1000);
});

// ===== CLEANUP ON PAGE UNLOAD =====
window.addEventListener('beforeunload', () => {
    stopRealtimeListener();
});

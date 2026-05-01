// pH Detection Dashboard - Main Logic

// ===== FIREBASE CONFIG - GANTI INI! =====
const firebaseConfig = {
    apiKey: "AIzaSyAHuCnBj49G60HptaJyHtinT_OSeDvfgmY",
    authDomain: "ph-detection-based-on-rgb.firebaseapp.com",
    databaseURL: "https://ph-detection-based-on-rgb-default-rtdb.firebaseio.com",
    projectId: "ph-detection-based-on-rgb",
    storageBucket: "ph-detection-based-on-rgb.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// ===== GLOBAL VARIABLES =====
let db;
let allScans = [];
let phChart = null;
let isRealtimeEnabled = true;
let realtimeListener = null;

// ===== FIREBASE INITIALIZATION =====
function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        console.log("✓ Firebase initialized");
        showNotification("Success", "Connected to Firebase!");
        document.getElementById('deviceStatus').className = 'status-indicator online';
        document.getElementById('deviceStatus').textContent = '● Online';
    } catch (error) {
        console.error("✗ Firebase error:", error);
        showNotification("Error", "Failed to connect to Firebase: " + error.message);
        document.getElementById('deviceStatus').className = 'status-indicator offline';
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

// ===== FETCH ALL SCANS =====
async function fetchAllScans() {
    try {
        const snapshot = await db.ref('scans').orderByChild('timestamp').limitToLast(50).once('value');
        
        if (!snapshot.exists()) {
            console.log("No scans found");
            allScans = [];
            return;
        }

        const data = snapshot.val();
        allScans = [];
        
        // Convert object to array dan reverse (newest first)
        Object.keys(data).reverse().forEach(key => {
            allScans.push({
                id: key,
                ...data[key]
            });
        });

        console.log(`✓ Loaded ${allScans.length} scans`);
        
        // Update UI
        updateCurrentReading(allScans[0]);
        updateHistoryTable(allScans);
        updateStatistics(allScans);
        updateChart(allScans);
        
    } catch (error) {
        console.error("✗ Error fetching scans:", error);
        showNotification("Error", "Failed to fetch scans: " + error.message);
    }
}

// ===== UPDATE HISTORY TABLE =====
function updateHistoryTable(scans) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (scans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No data available</td></tr>';
        return;
    }

    scans.forEach(scan => {
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
        `;
        
        tbody.appendChild(row);
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
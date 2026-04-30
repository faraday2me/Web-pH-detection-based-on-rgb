# pH Detection Dashboard

Web dashboard untuk monitoring pH makanan secara real-time menggunakan ESP32, TCS3200 sensor, dan Firebase Realtime Database.

## 🚀 Fitur

- ✅ Real-time pH monitoring
- ✅ Interactive pH trend chart
- ✅ Scan history dengan table
- ✅ Statistics (average pH, status breakdown)
- ✅ Export data to CSV
- ✅ Responsive design (mobile-friendly)
- ✅ Live Firebase integration

## 📋 Prerequisites

Pastikan sudah setup:
- [x] ESP32 dengan kode Arduino (ph_detection_esp32_main.ino)
- [x] Firebase Realtime Database
- [x] Firebase API Key
- [x] Firebase Database URL

## 🔧 Setup

### 1. Clone Repository

```bash
git clone https://github.com/faraday2me/ph-detection-web.git
cd ph-detection-web
```

### 2. Update Firebase Config

Edit file `script.js` dan ganti config dengan Firebase project Anda:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Update Firebase Security Rules

Di Firebase Console → Realtime Database → Rules, update ke:

```json
{
  "rules": {
    "devices": {
      ".read": true,
      ".write": "auth != null"
    },
    "scans": {
      ".read": true,
      ".write": "auth != null"
    },
    "statistics": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

Klik **Publish**

## 🌐 Deploy ke Netlify (FREE)

### Option 1: Drag & Drop (Termudah)

1. Buka: https://app.netlify.com/drop
2. Drag folder project ke halaman
3. **DONE!** Website langsung live 🎉

### Option 2: GitHub + Auto Deploy

1. Push project ke GitHub
2. Buka: https://app.netlify.com/
3. Klik **"New site from Git"**
4. Pilih GitHub repo
5. Klik **"Deploy"**
6. **DONE!** Auto-update setiap push

## 📝 File Structure

```
ph-detection-web/
├── index.html          # HTML struktur
├── style.css           # Styling & responsive
├── script.js           # Firebase logic & interaksi
└── README.md           # Dokumentasi ini
```

## 🎨 Fitur Dashboard

### Current Reading
- Menampilkan pH nilai terakhir
- Status makanan (FRESH/CAUTION/ROTTEN)
- RGB values (normalized & raw)
- Timestamp pembacaan

### Chart
- Visualisasi trend pH 50 scan terakhir
- Color-coded sesuai status
- Interactive tooltip

### Statistics
- Total jumlah scans
- Average pH
- Breakdown status (Fresh/Caution/Rotten)

### History
- Table dengan 50 scan terakhir
- Sortable berdasarkan waktu
- Export ke CSV

### Real-time Monitoring
- Toggle ON/OFF auto-refresh
- Update otomatis setiap ada data baru
- Powered by Firebase listeners

## 🔌 ESP32 Integration

ESP32 mengirim data ke Firebase dengan format:

```json
{
  "deviceId": "esp32_ph_scanner_001",
  "timestamp": 1714521600,
  "rawRGB": {
    "r": 155,
    "g": 142,
    "b": 109
  },
  "normalizedRGB": {
    "r": 0,
    "g": 5,
    "b": 10
  },
  "pH": 6.5,
  "status": "FRESH",
  "meaning": "Makanan masih FRESH"
}
```

## 📱 Responsive Breakpoints

- **Desktop**: Full layout (1200px+)
- **Tablet**: Adjusted grid (768px - 1199px)
- **Mobile**: Single column (< 768px)

## 🛠️ Troubleshooting

### Dashboard tidak connect ke Firebase
- Cek Firebase config di `script.js`
- Cek API Key & Database URL
- Cek internet connection

### Data tidak muncul
- Pastikan ESP32 sudah mengirim data
- Cek Firebase Database rules (must allow `.read: true`)
- Check browser console for errors

### Export CSV tidak jalan
- Pastikan ada minimal 1 scan di database
- Cek browser console untuk error messages

## 📚 Dokumentasi Lengkap

- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [Netlify Deployment](https://docs.netlify.com/)

## 📧 Support

Untuk pertanyaan atau issues, buat issue di GitHub atau hubungi developer.

## 📄 License

MIT License - feel free to use for personal & commercial projects

---

**Happy Monitoring!** 🔬📊
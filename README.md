# 🔬 pH Detection Dashboard

Web dashboard real-time untuk monitoring pH makanan menggunakan **ESP32**, **TCS3200 Sensor**, dan **Firebase Realtime Database**.

## 📋 Daftar Isi
- [Fitur](#-fitur)
- [Prerequisites](#-prerequisites)
- [Setup](#-setup)
- [Deploy](#-deploy)
- [File Structure](#-file-structure)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Fitur

✅ **Real-time pH Monitoring** - Update otomatis saat ada data baru  
✅ **Interactive Chart** - Visualisasi trend pH 50 scan terakhir  
✅ **Scan History** - Tabel dengan data lengkap 50 scan terakhir  
✅ **Statistics** - Average pH, breakdown status (Fresh/Caution/Rotten)  
✅ **Export to CSV** - Download data untuk analisis lebih lanjut  
✅ **Responsive Design** - Desktop, tablet, dan mobile-friendly  
✅ **Color-Coded Status** - 🟢 Fresh, 🟠 Caution, 🔴 Rotten  
✅ **Real-time Toggle** - On/Off auto-refresh kapan saja  

---

## 📋 Prerequisites

Pastikan sudah setup:

- ✅ **ESP32** dengan kode Arduino (sudah beres)
- ✅ **Firebase Realtime Database** (sudah beres)
- ✅ **Firebase API Key** (sudah beres)
- ✅ **Firebase Database URL** (sudah beres)

---

## 🔧 Setup

### Step 1: Unduh File

Buat folder di laptop:
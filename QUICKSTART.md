# FarmTrust Quick Start Guide

## ✅ What We've Built So Far

### Backend (Node.js + Express + PostgreSQL)
- ✅ User authentication (register/login with JWT)
- ✅ Farm CRUD endpoints with GPS polygon storage  
- ✅ Claims submission with NDVI integration point
- ✅ Automatic NDVI verification when severity > 0.6
- ✅ Complete database schema

### NDVI Service (Python + FastAPI)
- ✅ Google Earth Engine integration (free tier)
- ✅ Real-time NDVI calculation from Sentinel-2
- ✅ Claim verification endpoint
- ✅ Background baseline collection job (every 5 days)
- ✅ NDVI history tracking

### Architecture
```
Expo App (frontend)
    ↓
Node.js Backend (Express, port 5000)
    ├─ User auth + farm management
    └─ Calls NDVI service for verification
         ↓
Python NDVI Service (FastAPI, port 8000)
    └─ Calls Google Earth Engine API
         ↓
PostgreSQL Database
    └─ Stores all data + NDVI history
```

---

## 🚀 How to Start Everything

### Step 1: PostgreSQL Setup

**Windows:**
1. Download: https://www.postgresql.org/download/windows/
2. Install (default options are fine)
3. Note your password
4. Open Command Prompt:
   ```bash
   psql -U postgres
   CREATE DATABASE farmtrust;
   \q
   ```

**Alternative using Docker (if you have Docker):**
```bash
docker run --name farmtrust-db -e POSTGRES_PASSWORD=postgres -d -p 5432:5432 postgres
```

### Step 2: Backend Setup & Run

```bash
cd backend

# 1. Create .env file (copy from .env.example)
copy .env.example .env
# Edit .env with your PostgreSQL password

# 2. Install dependencies (one-time)
npm install

# 3. Start backend
npm run dev

# Should show:
# ✅ FarmTrust Backend running on http://localhost:5000
# 📡 Available endpoints: ...
```

**Keep this terminal open!**

### Step 3: NDVI Service - Google Earth Engine Setup

First time only (5 minutes):

```bash
cd ndvi-service

# 1. Create .env file
copy .env.example .env

# 2. Create virtual environment
python -m venv venv

# 3. Activate it
venv\Scripts\activate

# 4. Install dependencies (one-time)
pip install -r requirements.txt

# 5. Start service (will open browser for authentication)
python main.py
```

**On first run:**
- Browser opens at Google Earth Engine
- Click "Generate Token"
- Authorize the app
- Copy token
- Paste in terminal (paste with Ctrl+Shift+V in Windows Terminal)
- Credentials saved for future runs

**Keep this terminal open!**

### Step 4: Expo Frontend

In a new terminal:

```bash
cd app

# Your Expo frontend already has dependencies installed
npx expo start

# Then:
# - Press 'i' for iOS (simulator only, need macOS)
# - Press 'a' for Android (need Android emulator or phone)
# - Scan QR code with Expo app on physical phone
```

**Frontend will run on port 8081**

---

## 📝 Testing the System

### Test 1: Backend Health Check

```bash
curl http://localhost:5000/api/health

# Should return:
# {"status":"Backend is running","timestamp":"2024-04-12T..."}
```

### Test 2: NDVI Service Health Check

```bash
curl http://localhost:8000/health

# Should return:
# {"status":"NDVI service is running","timestamp":"..."}
```

### Test 3: Register User (Backend)

**Using PowerShell:**
```powershell
$body = @{
    email = "farmer1@example.com"
    password = "password123"
    farmerName = "Ram Kumar"
    phone = "+91-9876543210"
    walletAddress = "0x123456789abcdef"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/auth/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "farmer1@example.com",
    "farmer_name": "Ram Kumar"
  },
  "token": "eyJhbGc..."
}
```

**Save the token!** You'll need it for next requests.

### Test 4: Create a Farm (Backend)

**Using PowerShell:**
```powershell
$token = "eyJhbGc..."  # From register response

$body = @{
    farmName = "North Field"
    gpsPolygon = @(
        @{ lat = 28.5355; lon = 77.3910 }
        @{ lat = 28.5360; lon = 77.3920 }
        @{ lat = 28.5365; lon = 77.3915 }
    )
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/farms" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
  } `
  -Body $body
```

**Response:**
```json
{
  "message": "Farm created successfully",
  "farm": {
    "id": 1,
    "owner_id": 1,
    "farm_name": "North Field",
    "gps_polygon": {...},
    "baseline_ndvi": null,  # Will be set by cron job
    ...
  }
}
```

### Test 5: Start NDVI Baseline Collection

**In NDVI service terminal 2:**
```bash
# Activate venv first
venv\Scripts\activate

# Run baseline job (will fetch NDVI for all farms)
python cron_baseline.py

# Should show:
# 🌾 Starting baseline NDVI collection job
# 📍 Found 1 farms to process
# 🛰️ Processing: North Field (ID: 1)
# [Fetches from satellite...]
# ✅ Baseline set: NDVI = 0.72
```

**This will:**
1. Query all farms without baseline
2. Fetch current NDVI from satellite (~2-5 seconds)
3. Store in database
4. Set as baseline

### Test 6: Submit a Disease Claim with NDVI Verification

**Using PowerShell:**
```powershell
$token = "eyJhbGc..."

$body = @{
    farmId = 1
    policyId = $null
    diseaseImageHash = "QmXxxx-sample-hash"
    diseaseType = "Rice Blast"
    diseaseSeverity = 0.85  # High severity triggers NDVI check
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/claims/submit" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
  } `
  -Body $body
```

**Response:**
```json
{
  "message": "Claim submitted with NDVI verification",
  "claim": {
    "id": 1,
    "farm_id": 1,
    "disease_severity": 0.85,
    "ndvi_verified": true,
    "ndvi_baseline": 0.72,
    "ndvi_current": 0.68,
    "ndvi_drop_percentage": 5.56,
    "status": "pending",
    ...
  },
  "ndvi_data": {
    "verified": true,
    "drop_percentage": 5.56,
    "ndvi_baseline": 0.72,
    "ndvi_current": 0.68,
    "flag_reason": "Within normal range"
  }
}
```

**What happened:**
1. Claim created with severity 0.85
2. Backend detected severity > 0.6
3. Called NDVI service with farm_id=1
4. NDVI service fetched current satellite data
5. Compared current (0.68) vs baseline (0.72)
6. Drop was 5.56% (<20% threshold) → verified=true
7. Result stored with claim

---

## 🔄 Running Everything (Regular Setup)

Once Google Earth Engine is authenticated:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - NDVI Service (API only):**
```bash
cd ndvi-service
venv\Scripts\activate
python main.py
```

**Terminal 3 - NDVI Baseline Job (optional, for passive baseline building):**
```bash
cd ndvi-service
venv\Scripts\activate
python cron_baseline.py
```

**Terminal 4 - Expo Frontend:**
```bash
cd app
npx expo start
```

---

## 🎯 Your Local IP (Needed for Frontend ↔ Backend)

Get it for Expo frontend to connect to backend:

**Windows Command Prompt:**
```bash
ipconfig

# Look for: IPv4 Address. . . . . . . . . : 192.168.x.x
```

Example: `192.168.1.105`

**Update in frontend config** (we'll do this next phase) to use this IP instead of localhost.

---

## 📊 What Happens Next (Phase 3)

We'll update the Expo frontend to:
1. Connect to backend at `http://192.168.x.x:5000`
2. Add farm registration screen (sends GPS polygon)
3. Add disease detection screen
4. Add claim submission (triggers NDVI verification)
5. Show NDVI verification results to farmer

---

## ⚠️ Troubleshooting

### Backend won't start
```
Error: Database connection failed
```
- Check PostgreSQL is running
- Check .env file has correct password
- Run: `psql -U postgres -d farmtrust` to verify database exists

### NDVI service authentication fails
```
Error: Could not authenticate with Earth Engine
```
- Make sure you cleared the token or updated the code
- Delete: `~/.config/earthengine/` folder
- Delete: `venv/` folder
- Reinstall: `pip install -r requirements.txt`
- Run again: `python main.py`

### Expo can't connect to backend
- Check backend is running on port 5000
- Use your actual IP (not localhost)
- Check firewall allows port 5000

### Claim submission errors
- Make sure farm was created first
- Make sure baseline NDVI is set (run cron_baseline.py)
- Check NDVI service is running on port 8000

---

## 📱  Next: Connect Expo to Backend

Once everything is running, we'll:
1. Add API service file to Expo app
2. Create farm registration screen
3. Create claim submission flow
4. Display NDVI verification results

Would you like to proceed with the frontend integration now, or do you want to test the current backend/NDVI setup first?

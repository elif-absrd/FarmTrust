# FarmTrust Testing Guide - Complete End-to-End Workflow

## Step 1: PostgreSQL Setup & Verification

### Check if PostgreSQL is Running

**Windows Command Prompt:**
```bash
# Check PostgreSQL service
sc query postgresql-x64-*

# Or check port
netstat -ano | findstr :5432

# Should show a process listening on port 5432
```

### Create Database

**PowerShell:**
```powershell
# Connect to PostgreSQL
psql -U postgres

# Inside psql:
CREATE DATABASE farmtrust;
\l
# Should show: farmtrust | postgres | UTF8 | ...

# Exit psql
\q
```

### Test Connection (optional)

```bash
psql -U postgres -d farmtrust -c "SELECT version();"
# Should show PostgreSQL version
```

---

## Step 2: Backend Server Setup & Test

### Create .env File

**Navigate to backend folder and create `.env`:**

```bash
cd backend
```

Create file `backend/.env` with:
```
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=farmtrust

PORT=5000
NODE_ENV=development

JWT_SECRET=your_jwt_secret_key_farmtrust_2024
JWT_EXPIRE=7d

NDVI_SERVICE_URL=http://localhost:8000

FRONTEND_URL=http://192.168.x.x:8081
```

**⚠️ Important:** Replace `192.168.x.x` with your actual local IP (get from `ipconfig`)

### Start Backend

**PowerShell:**
```bash
cd backend
npm run dev

# Should show:
# 🔄 Initializing database...
# ✅ Database tables initialized successfully
# ✅ FarmTrust Backend running on http://localhost:5000
# 📡 Available endpoints:
#   POST   /api/auth/register
#   POST   /api/auth/login
#   ...
```

**Keep this terminal open! Don't close it.**

### Test Backend Health

**New PowerShell window:**
```bash
# Test if backend is running
curl http://localhost:5000/api/health | ConvertFrom-Json | Format-List

# Should return:
# status : Backend is running
# timestamp : 2024-04-12T...
```

✅ **If you see this, backend is working!**

---

## Step 3: Google Earth Engine Authentication (One-time - 5 minutes)

### Sign Up for Earth Engine

1. Go to: https://developers.google.com/earth-engine
2. Click **"Sign Up"** button (instant approval)
3. Sign in with Google account

### Install Google Earth Engine for Python

The `earthengine-api` is already in `requirements.txt`. It's installed when you run `pip install -r requirements.txt`.

### First-Time Authentication

This happens automatically when NDVI service starts:

```bash
cd ndvi-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

---

## Step 4: NDVI Service Setup & Test

### Create .env File

**In `ndvi-service` folder, create `.env`:**

```
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=farmtrust

PORT=8000
NODE_ENV=development

BACKEND_URL=http://localhost:5000
LOG_LEVEL=INFO
```

### Start NDVI Service

**New PowerShell window:**

```bash
cd ndvi-service

# Activate virtual environment
venv\Scripts\activate

# Start service
python main.py
```

**First Run - Browser Opens:**
1. A browser window will open (Google OAuth)
2. Log in with your Google account
3. Click **"Generate Token"** button
4. Click **"Authorize"** to give permissions
5. Copy the authorization code
6. Return to PowerShell and paste the token (Ctrl+Shift+V)
7. Press Enter

**Should show:**
```
🚀 Starting NDVI service...
✅ Earth Engine initialized successfully

INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Keep this terminal open!**

### Test NDVI Service Health

**New PowerShell window:**
```bash
curl http://localhost:8000/health | ConvertFrom-Json | Format-List

# Should return:
# status : NDVI service is running
# timestamp : 2024-04-12T...
# earth_engine : initialized
```

✅ **If you see this, NDVI service is working!**

---

## Step 5: Complete End-to-End Test

Now all services are running. Let's test the complete flow:

### Test 1: Register a Farmer

**PowerShell:**

```powershell
$registerBody = @{
    email = "farmer1@test.com"
    password = "password123"
    farmerName = "Ram Kumar Singh"
    phone = "+91-9876543210"
    walletAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE"
} | ConvertTo-Json

$registerResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $registerBody

$registerData = $registerResponse.Content | ConvertFrom-Json
$registerData | Format-List

# Save token for next requests
$token = $registerData.token
Write-Host "`n✅ Token saved! ($($token.Substring(0, 20))...)"
```

**Expected Response:**
```
message      : User registered successfully
user         : @{id=1; email=farmer1@test.com; farmer_name=Ram Kumar Singh}
token        : eyJhbGc... (long string)
```

### Test 2: Create a Farm with GPS Boundary

**PowerShell:**

```powershell
# Use token from previous step
$token = "eyJhbGc..."  # Paste your token here

$farmBody = @{
    farmName = "North Field - Delhi"
    gpsPolygon = @(
        @{ lat = 28.5355; lon = 77.3910 }
        @{ lat = 28.5360; lon = 77.3920 }
        @{ lat = 28.5365; lon = 77.3915 }
        @{ lat = 28.5355; lon = 77.3910 }  # Close polygon
    )
} | ConvertTo-Json

$farmResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/farms" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
  } `
  -Body $farmBody

$farmData = $farmResponse.Content | ConvertFrom-Json
$farmData | Format-List

# Save farm ID for next steps
$farmId = $farmData.farm.id
Write-Host "`n✅ Farm created with ID: $farmId"
```

**Expected Response:**
```
message   : Farm created successfully
farm      : @{
    id=1
    owner_id=1
    farm_name=North Field - Delhi
    gps_polygon={...}
    baseline_ndvi=  (null - will be set by cron job)
    ...
}
```

### Test 3: Collect Baseline NDVI (Background Job)

**New PowerShell window:**

```powershell
cd ndvi-service
venv\Scripts\activate

# Run baseline collection job
python cron_baseline.py

# Should show:
# 🌾 Starting baseline NDVI collection job
# 📍 Found 1 farms to process
# 🌾 Processing: North Field - Delhi (ID: 1)
# 🛰️  Starting NDVI calculation...
#    Farm boundary: 4 points
#    Querying Sentinel-2 data...
#    Using image from: 2024-04-11
#    Calculating NDVI = (NIR - Red) / (NIR + Red)
#    Computing mean NDVI across farm boundary...
# ✅ NDVI calculated: 0.72
#    Interpretation: Healthy vegetation
# ✅ Baseline set: NDVI = 0.72
```

⏱️ **First satellite fetch takes ~2-5 seconds**

✅ **If successful, your farm now has baseline NDVI = 0.72**

### Test 4: Verify Baseline Was Stored

**PowerShell:**

```powershell
$token = "eyJhbGc..."
$farmId = 1

# Get farm details
$farmDetailResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/farms/$farmId" `
  -Method GET `
  -Headers @{
    "Authorization" = "Bearer $token"
  }

$farmDetail = $farmDetailResponse.Content | ConvertFrom-Json
$farmDetail.farm | Format-List

# Should show:
# baseline_ndvi : 0.72
# baseline_date : 2024-04-12T...
```

### Test 5: Submit Disease Claim with NDVI Verification

**PowerShell:**

```powershell
$token = "eyJhbGc..."
$farmId = 1

$claimBody = @{
    farmId = $farmId
    policyId = $null
    diseaseImageHash = "QmVhbGZvcmNlNmQ3ZTFjNGI0YThhMmQ5NzM4Zjc3NWQy"
    diseaseType = "Rice Blast"
    diseaseSeverity = 0.85  # High severity triggers NDVI check
} | ConvertTo-Json

Write-Host "📤 Submitting disease claim..."

$claimResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/claims/submit" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
  } `
  -Body $claimBody

$claimData = $claimResponse.Content | ConvertFrom-Json

Write-Host "`n✅ Claim submitted! Details:"
$claimData.claim | Format-List
Write-Host "`n📊 NDVI Verification Result:"
$claimData.ndvi_data | Format-List
```

**Expected Response:**

```
message : Claim submitted with NDVI verification

claim: {
    id=1
    farm_id=1
    disease_severity=0.85
    ndvi_verified=True          ← ✅ VERIFIED
    ndvi_baseline=0.72          ← Baseline from satellite
    ndvi_current=0.68           ← Current from satellite
    ndvi_drop_percentage=5.56   ← Drop % (< 20% = good)
    status=pending
    ...
}

ndvi_data: {
    verified=True
    drop_percentage=5.56
    ndvi_baseline=0.72
    ndvi_current=0.68
    flag_reason=Within normal range
    timestamp=2024-04-12T...
}
```

### Test 6: Query NDVI History

**PowerShell:**

```powershell
# Get all NDVI readings for the farm
curl "http://localhost:8000/api/ndvi/history/1?limit=10" | ConvertFrom-Json | Format-List
```

**Expected Response:**
```
farm_id    : 1
ndvi_values: {
    ndvi_value=0.72, fetch_date=2024-04-12T...
    ndvi_value=0.68, fetch_date=2024-04-12T...
}
```

---

## 🎯 Summary: What Each Test Verified

| Test | Verified | Status |
|------|----------|--------|
| Backend Health | Server running, DB connected | ✅ |
| NDVI Health | NDVI service + Earth Engine | ✅ |
| User Registration | Authentication system works | ✅ |
| Farm Creation | GPS polygon storage works | ✅ |
| Satellite Query | Google Earth Engine integration | ✅ |
| Baseline Setting | NDVI history table working | ✅ |
| Claim + NDVI | Complete verification pipeline | ✅ |

---

## 📊 Test Results Checklist

After completing all tests, check:

- [ ] Backend running on port 5000
- [ ] NDVI service running on port 8000
- [ ] PostgreSQL database has 7 tables created
- [ ] User registered successfully
- [ ] Farm created with GPS polygon
- [ ] Baseline NDVI collected from satellite
- [ ] Claim submitted and verified with NDVI
- [ ] NDVI drop calculated correctly
- [ ] Claim marked as verified (drop < 20%)

---

## 🐛 Troubleshooting Tests

### "Database connection failed"
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** PostgreSQL not running
```bash
# Check if running
psql -U postgres -c "SELECT 1"

# If error, start PostgreSQL from Services
```

### "Earth Engine initialization failed"
```
Error: Could not authenticate with Earth Engine
```
**Solution:** First-time auth needed
```bash
# Clean auth cache
rmdir %USERPROFILE%\.config\earthengine /s /q

# Reinstall earthengine-api
pip uninstall earthengine-api -y
pip install earthengine-api

# Try again
python main.py
# Browser should open for auth
```

### "NDVI service not responding"
```
Error: HTTP 500 - Could not calculate NDVI
```
**Usually means:** Cloud cover too high (>20%) or bad coordinates
**Solution:** Wait a few hours for clearer satellite image

### "Claim verification failed"
```
Error: Baseline NDVI not yet available
```
**Solution:** Run baseline collection first
```bash
python cron_baseline.py
```

---

## 📝 Next Steps After Testing

Once all tests pass (✅ all checked), you can:

1. **Run continuously** (3 terminals):
   - Terminal 1: `cd backend && npm run dev`
   - Terminal 2: `cd ndvi-service && python main.py`
   - Terminal 3 (optional, for baseline every 5 days): `python cron_baseline.py`

2. **Move to Phase 3**: Update Expo frontend to use these APIs
   - Add farm registration screen
   - Add disease detection screen
   - Add claim submission
   - Display NDVI results

---

## 🆘 Need Help?

If any test fails, provide:
1. Full error message
2. Which step failed
3. Which terminal (backend, NDVI, or PostgreSQL)
4. Output logs

I can help debug!

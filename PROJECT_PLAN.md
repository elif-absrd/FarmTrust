# FarmTrust Implementation Plan

**Current Status**: Basic React Native frontend only  
**Objective**: Build full stack with NDVI satellite verification integration

---

## 🎯 Strategic Overview

You have a React Native mobile app shell. The critical missing pieces are:

1. **Backend infrastructure** (Node.js + PostgreSQL)
2. **NDVI satellite verification** (Python + Google Earth Engine)
3. **Database schema** to track farms, policies, claims, NDVI history
4. **API layer** connecting frontend to these services

The advisor's guidance on NDVI is very specific: **no image display needed, only fetch numerical NDVI scores for GPS coordinates**.

---

## 📋 Implementation Phases

### **Phase 1: Backend Foundation (Weeks 1-2)**
*This is blocking everything else. Do this first.*

**Goals:**
- Set up Node.js backend with Express.js
- Set up PostgreSQL database
- Create database schema
- Implement basic authentication (JWT)

**What to build:**
```
backend/
├── server.js                 # Express app entry point
├── config/
│   ├── database.js          # PostgreSQL connection
│   └── env.example          # Environment config template
├── routes/
│   ├── auth.js              # Login/registration
│   ├── farms.js             # Farm CRUD + GPS polygon storage
│   └── claims.js            # Claim submission + NDVI results
├── models/
│   ├── User.js
│   ├── Farm.js              # Stores farm_id, owner_id, gps_polygon, baseline_ndvi
│   ├── Policy.js
│   └── Claim.js             # Stores claim_id, farm_id, ndvi_verified, ndvi_scores
├── middleware/
│   └── auth.js              # JWT verification
└── package.json
```

**Database schema overview:**
```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(255) UNIQUE,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Farms table (critical for NDVI)
CREATE TABLE farms (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id),
  farm_name VARCHAR(255),
  gps_polygon JSONB,        -- Store boundary as GeoJSON polygon
  baseline_ndvi DECIMAL,    -- Will be populated by cron job
  baseline_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- NDVI History (for baseline tracking)
CREATE TABLE ndvi_history (
  id SERIAL PRIMARY KEY,
  farm_id INTEGER REFERENCES farms(id),
  ndvi_value DECIMAL,
  fetch_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Claims table
CREATE TABLE claims (
  id SERIAL PRIMARY KEY,
  farm_id INTEGER REFERENCES farms(id),
  disease_image_hash VARCHAR(255),
  ndvi_verified BOOLEAN,
  ndvi_drop_percentage DECIMAL,
  ndvi_baseline DECIMAL,
  ndvi_current DECIMAL,
  status VARCHAR(50),       -- pending, verified, rejected, paid
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Why this matters for NDVI:**
- `farms.gps_polygon` stores the farm boundary (sent to Earth Engine API)
- `farms.baseline_ndvi` is the reference point for comparison
- `ndvi_history` tracks historical NDVI values (populated by background cron)
- `claims.ndvi_*` fields store the actual NDVI verification result

---

### **Phase 2: NDVI Satellite Verification (Weeks 2-3)**
*Can work in parallel with Phase 1, but needs the database schema from Phase 1*

**Goals:**
- Create Python FastAPI service for NDVI calculations
- Get Google Earth Engine API working
- Set up background cron job for baseline collection
- Connect to backend via REST API

**What to build:**
```
ndvi-service/
├── main.py                  # FastAPI app
├── earth_engine_handler.py  # Google Earth Engine API integration
├── models.py                # Pydantic models for request/response
├── config.py                # Configuration
├── cron_baseline.py         # Background job script
└── requirements.txt
```

**Key functions:**

1. **Calculate NDVI for a GPS polygon:**
```python
def get_ndvi_for_polygon(polygon_coords):
    """
    Input: GPS polygon boundary (lat, lon pairs)
    Output: Average NDVI score across all pixels
    """
    # Use Google Earth Engine to query latest Sentinel-2 image
    # Calculate (NIR - Red) / (NIR + Red)
    # Return float value -1.0 to +1.0
```

2. **Background cron job (runs every 5 days):**
```python
def collect_baseline_ndvi():
    """
    1. Query all farms from PostgreSQL
    2. For each farm, call get_ndvi_for_polygon()
    3. Store result in ndvi_history table
    4. Update farms.baseline_ndvi if this is initial collection
    """
```

3. **Claim verification endpoint (called by backend):**
```python
def verify_claim_ndvi(farm_id, current_ndvi):
    """
    Input: farm_id, current detected NDVI
    Output: {
        "verified": true/false,
        "ndvi_drop_percentage": 25.5,
        "ndvi_baseline": 0.72,
        "ndvi_current": 0.54,
        "flag_reason": "Drop > 20% threshold"
    }
    """
    # Fetch baseline from database
    # Calculate drop percentage
    # Compare against 20% threshold
    # Return result
```

**Backend API integration:**
```
POST /api/ndvi/verify-claim
{
  "farm_id": 123,
  "current_ndvi": 0.54
}

Response:
{
  "verified": true,
  "drop_percentage": 25.0,
  "baseline": 0.72,
  "current": 0.54
}
```

**Why this approach:**
- Zero image display needed
- Single number returned for each GPS coordinate
- Passive baseline building = no user action required
- 80-100 lines of Python code for MVP

---

### **Phase 3: Connect Frontend to Backend (Weeks 3-4)**

**What changes in React Native app:**

1. **Farm Registration Flow:**
   - User enters farm name
   - User maps GPS boundary (or draws on map)
   - App sends to backend: `POST /api/farms` with polygon coordinates
   - Backend stores and eventually starts NDVI tracking

2. **Claim Submission Flow:**
   - User captures leaf image → disease detection model runs locally
   - App gets disease severity score
   - **If severity > threshold:**
     - App calls backend: `POST /api/claims/submit`
     - Backend extracts farm GPS → calls NDVI service
     - NDVI service returns verification result
     - Backend stores claim with NDVI flag
     - App shows: "Claim submitted. Satellite verification: PASSED/FAILED"

3. **NEW Dashboard Widget:**
   - Show farm baseline NDVI (from database)
   - Show claim history with NDVI verification status
   - Show when next NDVI update is expected

---

### **Phase 4: Disease Detection & Blockchain (Weeks 4+)**
*After foundation is solid*

- Integrate TensorFlow Lite model for disease detection
- Create smart contracts for automated payouts
- IPFS storage for claim evidence
- Chainlink oracle integration

---

## 🛠️ Detailed: How to Build NDVI Function

### Step 1: Set up Google Earth Engine (Free tier)
```bash
# 1. Go to https://developers.google.com/earth-engine
# 2. Sign in with Google Cloud account (free)
# 3. Create a service account + JSON key
# 4. Save key as `credentials.json` in ndvi-service/
# 5. Install Python library:
pip install earthengine-api
```

### Step 2: Core NDVI calculation
```python
# earth_engine_handler.py

import ee
import json

# Authenticate
ee.Authenticate()  # Opens browser, one-time setup
ee.Initialize(project='your-project-id')

def get_ndvi_for_farm(polygon_coords):
    """
    Input: polygon_coords = [
        {"lat": 28.5355, "lon": 77.3910},
        {"lat": 28.5360, "lon": 77.3920},
        ...
    ]
    """
    # Convert to GeoJSON
    coordinates = [[lon, lat] for lat, lon in 
                   [(p["lat"], p["lon"]) for p in polygon_coords]]
    
    # Create Earth Engine geometry
    roi = ee.Geometry.Polygon([coordinates])
    
    # Get latest Sentinel-2 image
    sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR') \
        .filterBounds(roi) \
        .filterDate('2024-04-01', '2024-04-12') \
        .sort('CLOUD_COVERAGE_ASSESSMENT') \
        .first()
    
    # Extract Red (B4) and NIR (B8) bands
    red = sentinel2.select('B4').divide(10000)
    nir = sentinel2.select('B8').divide(10000)
    
    # Calculate NDVI = (NIR - Red) / (NIR + Red)
    ndvi = nir.subtract(red).divide(nir.add(red))
    
    # Get mean value across the farm polygon
    mean_ndvi = ndvi.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=roi
    ).getInfo()
    
    return mean_ndvi.get('B8')  # Returns float like 0.72
```

### Step 3: FastAPI endpoint
```python
# main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2

app = FastAPI()

class NDVIRequest(BaseModel):
    farm_id: int
    current_ndvi: float = None  # If None, fetch current

@app.post("/api/ndvi/verify-claim")
async def verify_claim(request: NDVIRequest):
    """Verify if claim's NDVI drop exceeds 20% threshold"""
    
    # 1. Get farm boundary from DB
    farm = db.query("SELECT gps_polygon, baseline_ndvi FROM farms WHERE id=%s", 
                     (request.farm_id,))
    
    # 2. If no baseline yet, return error
    if not farm['baseline_ndvi']:
        return {"error": "Baseline NDVI not yet available"}
    
    # 3. Get current NDVI if not provided
    if request.current_ndvi is None:
        current_ndvi = get_ndvi_for_farm(farm['gps_polygon'])
    else:
        current_ndvi = request.current_ndvi
    
    # 4. Calculate drop percentage
    baseline = farm['baseline_ndvi']
    drop_pct = ((baseline - current_ndvi) / baseline) * 100
    
    # 5. Verify (flag if drop > 20%)
    verified = drop_pct <= 20
    
    return {
        "verified": verified,
        "drop_percentage": drop_pct,
        "ndvi_baseline": baseline,
        "ndvi_current": current_ndvi,
        "flag_reason": f"NDVI dropped {drop_pct:.1f}%" if not verified else "Within normal range"
    }
```

### Step 4: Background cron job
```python
# cron_baseline.py

import schedule
import time
import psycopg2

def collect_baselines():
    """Runs every 5 days, silently updates baseline NDVI"""
    
    # Get all farms without baseline
    farms = db.query("SELECT id, gps_polygon FROM farms WHERE baseline_ndvi IS NULL")
    
    for farm in farms:
        # Fetch NDVI
        ndvi = get_ndvi_for_farm(farm['gps_polygon'])
        
        # Store in history
        db.execute("""
            INSERT INTO ndvi_history (farm_id, ndvi_value)
            VALUES (%s, %s)
        """, (farm['id'], ndvi))
        
        # Update baseline if first time
        if not has_baseline(farm['id']):
            db.execute("""
                UPDATE farms SET baseline_ndvi=%s WHERE id=%s
            """, (ndvi, farm['id']))

# Schedule to run every 5 days
schedule.every(5).days.do(collect_baselines)

while True:
    schedule.run_pending()
    time.sleep(60)
```

### Step 5: How it integrates with backend claim flow
```
Frontend submits claim
  ↓
Backend POST /api/claims/submit receives:
  {
    "farm_id": 123,
    "disease_image_hash": "QmXxxx...",
    "disease_severity": 0.85
  }
  ↓
Backend checks: severity > threshold?
  ↓
If YES → Call Python ndvi-service:
  POST /api/ndvi/verify-claim { "farm_id": 123 }
  ↓
NDVI service returns:
  {
    "verified": true/false,
    "drop_percentage": 25.0,
    "ndvi_baseline": 0.72,
    "ndvi_current": 0.54
  }
  ↓
Backend writes to claims table:
  UPDATE claims SET 
    ndvi_verified = true,
    ndvi_baseline = 0.72,
    ndvi_current = 0.54,
    ndvi_drop_percentage = 25.0
  WHERE id = claim_id
  ↓
Claim enters Admin Review queue with NDVI flag shown
```

---

## 📦 Implementation Order (Start Here)

```
1. Set up backend project structure
2. PostgreSQL setup + schema creation
3. User & Farm CRUD endpoints
4. Google Earth Engine credential setup
5. NDVI Python service basic structure
6. Background cron job
7. Backend endpoint to call NDVI service
8. Connect frontend to farm registration
9. Connect frontend to claim submission
10. Display NDVI results in frontend
```

---

## ⚠️ Key Points

1. **You don't need to display satellite images** — only numerical NDVI scores
2. **Baseline building is passive** — happens in background via cron, requires no farmer action
3. **NDVI verification is optional at claim time** — acts as an additional trust layer
4. **For MVP: 1 DB column + ~100 lines of Python** — very contained scope
5. **Start with Phase 1 backend** — everything depends on it

---

## 📊 Expected Timeline

- **Phase 1 (Backend)**: 1-2 weeks
- **Phase 2 (NDVI)**: 1-2 weeks  
- **Phase 3 (Frontend connection)**: 1 week
- **Phase 4+ (Advanced features)**: Later

**Total for MVP with NDVI**: ~4-5 weeks

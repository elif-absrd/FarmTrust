# FarmTrust NDVI Service

Python FastAPI service for satellite-based crop health verification using Sentinel-2 NDVI (Normalized Difference Vegetation Index).

**Key Features:**
- Real-time NDVI calculation from freely available Sentinel-2 satellite data
- Automated baseline collection every 5 days (passive background job)
- NDVI drop detection for claim verification
- Time-series historical data tracking
- No satellite image display needed — only numerical NDVI scores

## Prerequisites

- Python 3.8+
- Google Earth Engine account (free)
- PostgreSQL (same database as backend)

## Setup

### 1. Google Earth Engine Setup (One-time, ~5 minutes)

1. Go to [Google Earth Engine](https://developers.google.com/earth-engine)
2. Sign in with your Google account
3. Click "Sign Up" to join the Earth Engine program (instant approval)
4. Go to [Earth Engine Code Editor](https://code.earthengine.google.com/)
5. Click your profile → "Generate" → Create OAuth token
6. Keep the token copied

### 2. Install Python Dependencies

```bash
cd ndvi-service
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install packages
pip install -r requirements.txt
```

### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:
```
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=farmtrust

PORT=8000
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
EE_PROJECT_ID=your_earth_engine_project_id

BACKEND_URL=http://localhost:5000
LOG_LEVEL=INFO
```

### 4. Google Earth Engine Authentication

Run the service once to authenticate:

```bash
# Terminal 1 - Start NDVI service
python main.py
```

On first run:
1. A browser window will open
2. Click "Generate Token"
3. Authorize the application
4. Copy the token
5. Paste it in the terminal
6. Credentials will be cached for future runs

## Running the Service

### Option 1: API Server Only (Manual NDVI Verification)

```bash
# Activate venv first
python main.py
```

Service will start on `http://localhost:8000`

### Option 2: API Server + Background Baseline Job (Recommended)

```bash
# Terminal 1 - Start API server
python main.py

# Terminal 2 - Start baseline collection job
python cron_baseline.py
```

The baseline job:
- Runs every 5 days automatically
- Collects NDVI for all farms without a baseline
- Stores data in `ndvi_history` table
- Runs silently in background
- No farmer action needed

## API Endpoints

### Health Check

```bash
GET http://localhost:8000/health
```

### Verify NDVI for Claim (Called during claim submission)

```bash
POST http://localhost:8000/api/ndvi/verify-claim

Request Body:
{
  "farm_id": 1,
  "current_ndvi": null  # Leave null to fetch from satellite
}

Response:
{
  "verified": true,
  "drop_percentage": 15.5,
  "ndvi_baseline": 0.72,
  "ndvi_current": 0.61,
  "flag_reason": "Within normal range",
  "timestamp": "2024-04-12T10:30:00"
}
```

### Get NDVI History

```bash
GET http://localhost:8000/api/ndvi/history/1?limit=30

Response:
{
  "farm_id": 1,
  "ndvi_values": [
    {"ndvi_value": 0.72, "fetch_date": "2024-04-12"},
    {"ndvi_value": 0.71, "fetch_date": "2024-04-07"},
    ...
  ]
}
```

### Get Current NDVI

```bash
GET http://localhost:8000/api/ndvi/current/1

Response:
{
  "farm_id": 1,
  "ndvi": 0.61,
  "timestamp": "2024-04-12T10:30:00"
}
```

## NDVI Interpretation

NDVI ranges from -1 to +1:

| NDVI Value | Interpretation | Status |
|-----------|---|---|
| > 0.6 | Dense vegetation | 🟢 Healthy |
| 0.4 - 0.6 | Moderate vegetation | 🟡 Normal |
| 0.2 - 0.4 | Sparse vegetation | 🟠 Stressed |
| < 0.2 | Minimal/no vegetation | 🔴 Critical |

**Claim Verification**: Flagged if NDVI drop > 20% from baseline.

## How It Works

### After farmer submits a disease claim:

1. **Backend receives claim** with disease severity from mobile app
2. **Backend calls NDVI service**: "Verify this farm"
3. **NDVI service**:
   - Gets farm GPS polygon from database
   - Queries Sentinel-2 satellite for latest image (< 20% cloud cover)
   - Calculates NDVI = (NIR - Red) / (NIR + Red)
   - Compares to 30+ day old baseline
   - Returns: "Drop 15% ✅ VERIFIED" or "Drop 25% ❌ FLAGGED"
4. **Backend stores result** with claim record
5. **Claim enters review** with NDVI verification status

### Baseline Building (Passive Background Job):

1. **Baseline job runs every 5 days** (aligned with Sentinel-2 refresh)
2. **For each farm**:
   - Fetches current NDVI from satellite
   - Stores in `ndvi_history` table
   - Updates `farms.baseline_ndvi` on first fetch
3. **After 30 days**: Have 6 data points for statistical comparison
4. **Farmer doesn't need to do anything** — happens automatically

## Integration with Backend

The backend (`/api/claims/submit`) automatically calls the NDVI service:

```javascript
// backend/routes/claims.js
if (disease_severity > 0.6) {
  const ndviResult = await axios.post(
    'http://localhost:8000/api/ndvi/verify-claim',
    { farm_id }
  );
  // Store NDVI result with claim
}
```

## Satellite Data Source

**Sentinel-2**: Free, 10m resolution, covers entire Earth
- Revisit frequency: 5 days
- Bands used: Red (B4), Near-Infrared (B8)
- Cloud filtering: Images with < 20% cloud cover only
- Data provider: Copernicus (EU)

## Troubleshooting

### Earth Engine Authentication Failed

```
Error: Could not authenticate with Earth Engine
```

**Solution**:
1. Visit https://code.earthengine.google.com/
2. Follow authentication steps
3. Delete `.config/earthengine/` folder
4. Run `python main.py` again

### No Sentinel-2 Images Found

```
Warning: No Sentinel-2 images found for this location
```

**Causes**:
- Heavy cloud cover (>20%)
- Outside Sentinel-2 coverage area (very rare)
- Incorrect GPS coordinates

**Solution**: Wait a few days for next Sentinel-2 pass (5-day revisit cycle)

### Database Connection Error

```
Error: Database connection failed
```

**Check**:
```bash
# Verify PostgreSQL is running
psql -U postgres -d farmtrust
```

### Backend Can't Reach NDVI Service

```
Error: NDVI_SERVICE_URL not responding
```

**Check**:
1. Is NDVI service running on port 8000?
   ```bash
   curl http://localhost:8000/health
   ```
2. Is backend `NDVI_SERVICE_URL` correct in `.env`?
3. Firewall blocking port 8000?

## Performance

- **NDVI Calculation**: ~2-5 seconds per farm (depends on image size and cloud cover)
- **Baseline Job**: Can process 10 farms/minute
- **API Response**: < 1 second (excluding satellite fetch time)
- **Data Storage**: ~100 bytes per NDVI record

## Cost

**FREE** — All services used are free tier:
- Google Earth Engine: Free
- Sentinel-2 data: Free
- FastAPI: Free
- PostgreSQL: Free

## Next Steps

1. **Start API server**: `python main.py`
2. **Test health**: `curl http://localhost:8000/health`
3. **Register farm** in mobile app with GPS boundary
4. **Wait 5 days** for first baseline to be collected
5. **Submit disease claim** to trigger NDVI verification

## Architecture Diagram

```
Farm Registration (GPS polygon stored)
        ↓
Background Job (every 5 days)
        ↓
Fetch Sentinel-2 NDVI ← Google Earth Engine
        ↓
Store in ndvi_history table
        ↓
  (After 30 days, have good baseline)
        ↓
    Farmer submits claim
        ↓
Backend calls: POST /api/ndvi/verify-claim
        ↓
NDVI Service compares current vs baseline
        ↓
Returns: verified=true/false + drop%
        ↓
Stored with claim record
```

## Scripts

- `main.py` - FastAPI server
- `earth_engine_handler.py` - Satellite data fetching
- `cron_baseline.py` - Background baseline job

## License

GPL-3.0

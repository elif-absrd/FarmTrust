import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

from earth_engine_handler import get_ndvi_for_farm, initialize_earth_engine

load_dotenv()

# Configure logging
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO'))
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="FarmTrust NDVI Service",
    description="Satellite-based NDVI verification for crop health assessment",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection pool
def get_db_connection():
    """Create database connection"""
    try:
        conn = psycopg2.connect(
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD'),
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', 5432),
            database=os.getenv('DB_NAME', 'farmtrust')
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise

# Pydantic models
class NDVIVerifyRequest(BaseModel):
    farm_id: int
    current_ndvi: Optional[float] = None

class NDVIVerifyResponse(BaseModel):
    verified: bool
    drop_percentage: float
    ndvi_baseline: float
    ndvi_current: float
    flag_reason: str
    timestamp: str

class NDVIHistoryResponse(BaseModel):
    farm_id: int
    ndvi_values: List[Dict]

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "NDVI service is running",
        "timestamp": datetime.now().isoformat(),
        "earth_engine": "initialized"
    }

# NDVI Verification endpoint (called by backend during claim submission)
@app.post("/api/ndvi/verify-claim", response_model=NDVIVerifyResponse)
async def verify_claim(request: NDVIVerifyRequest):
    """
    Verify NDVI drop for a farm claim.

    This endpoint:
    1. Retrieves farm GPS polygon from database
    2. Fetches current NDVI from satellite (if not provided)
    3. Compares against baseline from 30+ days ago
    4. Flags if drop > 20% threshold
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 1. Get farm boundary and baseline NDVI
        cursor.execute(
            """SELECT id, gps_polygon, baseline_ndvi, baseline_date
               FROM farms WHERE id = %s""",
            (request.farm_id,)
        )
        farm = cursor.fetchone()

        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")

        if not farm['baseline_ndvi']:
            raise HTTPException(
                status_code=400,
                detail="Baseline NDVI not yet available. Please try again in a few days."
            )

        # 2. Get current NDVI
        if request.current_ndvi is None:
            logger.info(f"🛰️  Fetching current NDVI for farm {request.farm_id}")
            try:
                current_ndvi = get_ndvi_for_farm(farm['gps_polygon'])
                if current_ndvi is None:
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to fetch satellite NDVI data"
                    )
            except Exception as e:
                logger.error(f"NDVI fetch error: {e}")
                raise HTTPException(status_code=500, detail=f"NDVI fetch failed: {str(e)}")
        else:
            current_ndvi = request.current_ndvi

        # 3. Calculate drop percentage
        baseline_ndvi = float(farm['baseline_ndvi'])
        drop_percentage = ((baseline_ndvi - current_ndvi) / baseline_ndvi) * 100 if baseline_ndvi != 0 else 0

        # 4. Verify (flag if drop > 20%)
        verified = drop_percentage <= 20
        flag_reason = f"NDVI dropped {drop_percentage:.1f}%" if not verified else "Within normal range"

        logger.info(
            f"✅ NDVI Verification: Farm {request.farm_id} | "
            f"Baseline: {baseline_ndvi:.3f} | Current: {current_ndvi:.3f} | "
            f"Drop: {drop_percentage:.1f}% | Verified: {verified}"
        )

        # 5. Store NDVI history
        cursor.execute(
            """INSERT INTO ndvi_history (farm_id, ndvi_value, fetch_date)
               VALUES (%s, %s, NOW())""",
            (request.farm_id, current_ndvi)
        )
        conn.commit()

        cursor.close()
        conn.close()

        return NDVIVerifyResponse(
            verified=verified,
            drop_percentage=round(drop_percentage, 2),
            ndvi_baseline=round(baseline_ndvi, 3),
            ndvi_current=round(current_ndvi, 3),
            flag_reason=flag_reason,
            timestamp=datetime.now().isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verification error: {e}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

# Get NDVI history for a farm
@app.get("/api/ndvi/history/{farm_id}", response_model=NDVIHistoryResponse)
async def get_ndvi_history(farm_id: int, limit: int = 30):
    """Get historical NDVI values for a farm"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute(
            """SELECT ndvi_value, fetch_date FROM ndvi_history
               WHERE farm_id = %s
               ORDER BY fetch_date DESC
               LIMIT %s""",
            (farm_id, limit)
        )
        history = cursor.fetchall()

        cursor.close()
        conn.close()

        return NDVIHistoryResponse(
            farm_id=farm_id,
            ndvi_values=[dict(record) for record in history]
        )

    except Exception as e:
        logger.error(f"History fetch error: {e}")
        raise HTTPException(status_code=500, detail=f"History fetch failed: {str(e)}")

# Get current NDVI for a farm (without verification)
@app.get("/api/ndvi/current/{farm_id}")
async def get_current_ndvi(farm_id: int):
    """Get current NDVI value for a farm"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute(
            "SELECT gps_polygon FROM farms WHERE id = %s",
            (farm_id,)
        )
        farm = cursor.fetchone()

        cursor.close()
        conn.close()

        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")

        logger.info(f"🛰️  Fetching current NDVI for farm {farm_id}")
        ndvi_value = get_ndvi_for_farm(farm['gps_polygon'])

        if ndvi_value is None:
            raise HTTPException(status_code=500, detail="Failed to fetch NDVI data")

        return {
            "farm_id": farm_id,
            "ndvi": round(ndvi_value, 3),
            "timestamp": datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Current NDVI fetch error: {e}")
        raise HTTPException(status_code=500, detail=f"NDVI fetch failed: {str(e)}")

# Initialize Earth Engine on startup
@app.on_event("startup")
async def startup_event():
    """Initialize Earth Engine on service startup"""
    logger.info("🚀 Starting NDVI service...")
    try:
        initialize_earth_engine()
        logger.info("✅ Earth Engine initialized successfully")
    except Exception as e:
        logger.error(f"❌ Earth Engine initialization failed: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)

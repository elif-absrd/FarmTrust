"""
Background cron job to collect baseline NDVI for all farms.

Runs every 5 days (aligned with Sentinel-2 refresh cycle).
Silently fetches and stores NDVI for every farm, building a health history.

This can be run as a separate process:
    python cron_baseline.py
"""

import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import time
import json
from dotenv import load_dotenv

from earth_engine_handler import get_ndvi_for_farm, initialize_earth_engine

load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

def collect_baseline_ndvi():
    """
    Background job: Collect NDVI baseline for all farms.

    Process:
    1. Query all farms without a baseline (or older than 30 days)
    2. For each farm, fetch current NDVI from satellite
    3. Store in ndvi_history table
    4. Update farms.baseline_ndvi if first time
    """
    logger.info("\n" + "="*60)
    logger.info("🌾 Starting baseline NDVI collection job")
    logger.info("="*60)

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Get all farms that need baseline or have outdated baseline
        cursor.execute("""
            SELECT id, farm_name, gps_polygon, baseline_ndvi, baseline_date
            FROM farms
            WHERE baseline_ndvi IS NULL
            OR baseline_date < NOW() - INTERVAL '30 days'
            ORDER BY farm_name
        """)

        farms = cursor.fetchall()
        logger.info(f"📍 Found {len(farms)} farms to process")

        if len(farms) == 0:
            logger.info("✅ All farms have recent NDVI baselines")
            cursor.close()
            conn.close()
            return

        success_count = 0
        error_count = 0

        for farm in farms:
            try:
                farm_id = farm['id']
                farm_name = farm['farm_name']
                gps_polygon = farm['gps_polygon']

                logger.info(f"\n  🌾 Processing: {farm_name} (ID: {farm_id})")

                # Parse polygon if it's a JSON string
                if isinstance(gps_polygon, str):
                    gps_polygon = json.loads(gps_polygon)

                # Fetch NDVI from satellite
                ndvi_value = get_ndvi_for_farm(gps_polygon)

                if ndvi_value is None:
                    logger.warning(f"  ⚠️  Failed to fetch NDVI for {farm_name}")
                    error_count += 1
                    continue

                # Store in ndvi_history
                cursor.execute("""
                    INSERT INTO ndvi_history (farm_id, ndvi_value, fetch_date)
                    VALUES (%s, %s, NOW())
                """, (farm_id, ndvi_value))

                # Update baseline if first time
                if farm['baseline_ndvi'] is None:
                    cursor.execute("""
                        UPDATE farms
                        SET baseline_ndvi = %s, baseline_date = NOW()
                        WHERE id = %s
                    """, (ndvi_value, farm_id))
                    logger.info(f"  ✅ Baseline set: NDVI = {ndvi_value:.3f}")
                else:
                    logger.info(f"  ✅ Updated: NDVI = {ndvi_value:.3f}")

                conn.commit()
                success_count += 1

            except Exception as e:
                logger.error(f"  ❌ Error processing farm {farm.get('id')}: {e}")
                error_count += 1
                conn.rollback()

        cursor.close()
        conn.close()

        # Summary
        logger.info("\n" + "="*60)
        logger.info("📊 Baseline Collection Summary")
        logger.info(f"   ✅ Success: {success_count}")
        logger.info(f"   ❌ Errors: {error_count}")
        logger.info(f"   Next run: in 5 days")
        logger.info("="*60 + "\n")

    except Exception as e:
        logger.error(f"❌ Baseline collection job failed: {e}")

def start_scheduler():
    """Start background scheduler for baseline collection"""
    try:
        logger.info("🚀 Initializing NDVI baseline scheduler")

        # Initialize Earth Engine
        initialize_earth_engine()

        # Create scheduler
        scheduler = BackgroundScheduler()

        # Schedule job: Run every 5 days
        scheduler.add_job(
            collect_baseline_ndvi,
            trigger=IntervalTrigger(days=5),
            id='ndvi_baseline_job',
            name='NDVI Baseline Collection',
            replace_existing=True
        )

        scheduler.start()
        logger.info("✅ Scheduler started - baseline collection every 5 days")
        logger.info("   First collection will run immediately...")

        # Run first collection immediately
        collect_baseline_ndvi()

        # Keep scheduler running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("\n🛑 Shutting down scheduler...")
            scheduler.shutdown()
            logger.info("✅ Scheduler stopped")

    except Exception as e:
        logger.error(f"❌ Scheduler initialization failed: {e}")
        raise

if __name__ == "__main__":
    start_scheduler()

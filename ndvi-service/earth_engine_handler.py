import ee
import logging
import os
from typing import List, Dict, Optional
import json

logger = logging.getLogger(__name__)

def initialize_earth_engine():
    """
    Initialize Google Earth Engine.

    Note: On first run, this will open a browser for authentication.
    The credentials will be cached in ~/.config/earthengine/
    """
    try:
        # Check if credentials exist
        credentials_path = os.path.expanduser("~/.config/earthengine/authenticated_user.json")

        if os.path.exists(credentials_path):
            logger.info("✅ Using cached Earth Engine credentials")
            ee.Authenticate(authorization_url="", code="", auth_local_webserver=False)
        else:
            logger.info("🔐 First-time setup: Browser will open for authentication")
            logger.info("   1. Click 'Generate Token'")
            logger.info("   2. Authorize in browser")
            logger.info("   3. Copy token")
            logger.info("   4. Paste token in console")
            ee.Authenticate()

        ee.Initialize(project="farmtrust-project")
        logger.info("✅ Earth Engine initialized")

    except Exception as e:
        logger.error(f"❌ Earth Engine initialization failed: {e}")
        logger.error("   Please authenticate: https://developers.google.com/earth-engine/guides/auth")
        raise

def get_ndvi_for_farm(gps_polygon: Dict) -> Optional[float]:
    """
    Calculate NDVI (Normalized Difference Vegetation Index) for a farm.

    NDVI = (NIR - Red) / (NIR + Red)
    - NIR: Near-Infrared band (Band 8)
    - Red: Red band (Band 4)
    - Output range: -1.0 to +1.0
    - Healthy vegetation: > 0.5
    - Stressed vegetation: < 0.3

    Args:
        gps_polygon: Dict with 'type' and 'coordinates' (GeoJSON format)
                    or list of lat/lon points

    Returns:
        float: NDVI value or None if fetch failed
    """
    try:
        logger.info("🛰️  Starting NDVI calculation...")

        # Handle different coordinate formats
        if isinstance(gps_polygon, dict) and 'type' in gps_polygon:
            # GeoJSON format
            coordinates = gps_polygon.get('coordinates', [])
        elif isinstance(gps_polygon, str):
            # JSON string
            gps_polygon = json.loads(gps_polygon)
            coordinates = gps_polygon.get('coordinates', [])
        else:
            # List of lat/lon dicts or tuples
            coordinates = [[p['lon'], p['lat']] if isinstance(p, dict)
                          else [p[1], p[0]] for p in gps_polygon]

        if not coordinates:
            raise ValueError("Invalid GPS polygon format")

        logger.info(f"   Farm boundary: {len(coordinates)} points")

        # Create Earth Engine geometry from coordinates
        roi = ee.Geometry.Polygon([coordinates])

        # Get Sentinel-2 collection
        logger.info("   Querying Sentinel-2 data...")
        sentinel2 = (
            ee.ImageCollection('COPERNICUS/S2_SR')
            .filterBounds(roi)
            .filterDate('2024-01-01', '2026-04-12')  # Use current date
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))  # Less than 20% cloud cover
            .sort('CLOUD_COVERAGE_ASSESSMENT')
        )

        # Get the most recent image
        image_count = sentinel2.size().getInfo()
        if image_count == 0:
            logger.warning("No Sentinel-2 images found for this location")
            return None

        latest_image = sentinel2.first()
        image_date = ee.Date(latest_image.get('system:time_start')).format('YYYY-MM-dd').getInfo()
        logger.info(f"   Using image from: {image_date}")

        # Extract Red (Band 4) and NIR (Band 8) bands
        # Divide by 10000 for surface reflectance correction
        red = latest_image.select('B4').divide(10000)
        nir = latest_image.select('B8').divide(10000)

        logger.info("   Calculating NDVI = (NIR - Red) / (NIR + Red)")

        # Calculate NDVI
        ndvi = nir.subtract(red).divide(nir.add(red))

        # Get mean NDVI across the farm polygon
        logger.info("   Computing mean NDVI across farm boundary...")
        stats = ndvi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=10  # 10 meter resolution (native Sentinel-2 resolution)
        )

        mean_ndvi = stats.getInfo()

        # Extract the NDVI value
        ndvi_value = mean_ndvi.get('B8')

        if ndvi_value is None or ndvi_value == 'null':
            logger.warning(f"Invalid NDVI result: {mean_ndvi}")
            return None

        # NDVI values should be between -1 and 1
        ndvi_value = float(ndvi_value)
        if not (-1.0 <= ndvi_value <= 1.0):
            logger.warning(f"NDVI out of expected range: {ndvi_value}")

        logger.info(f"✅ NDVI calculated: {ndvi_value:.3f}")
        logger.info(f"   Interpretation: {'Healthy vegetation' if ndvi_value > 0.5 else 'Moderate vegetation' if ndvi_value > 0.3 else 'Stressed vegetation'}")

        return ndvi_value

    except ee.EEException as e:
        logger.error(f"❌ Earth Engine error: {e}")
        return None
    except Exception as e:
        logger.error(f"❌ NDVI calculation error: {e}")
        return None

def get_ndvi_time_series(gps_polygon: Dict, start_date: str, end_date: str) -> List[Dict]:
    """
    Get NDVI time series for a farm over a period.

    Args:
        gps_polygon: Farm boundary as GeoJSON
        start_date: Start date in 'YYYY-MM-DD' format
        end_date: End date in 'YYYY-MM-DD' format

    Returns:
        List of dicts with {'date': str, 'ndvi': float}
    """
    try:
        logger.info(f"🛰️  Fetching NDVI time series from {start_date} to {end_date}...")

        coordinates = gps_polygon.get('coordinates', [])
        roi = ee.Geometry.Polygon([coordinates])

        # Get Sentinel-2 collection for date range
        sentinel2 = (
            ee.ImageCollection('COPERNICUS/S2_SR')
            .filterBounds(roi)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        )

        # Map NDVI calculation over collection
        def calculate_ndvi(image):
            red = image.select('B4').divide(10000)
            nir = image.select('B8').divide(10000)
            ndvi = nir.subtract(red).divide(nir.add(red))

            ndvi_mean = ndvi.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=roi,
                scale=10
            )

            return image.set({
                'system:time_start': image.get('system:time_start'),
                'ndvi': ndvi_mean.get('B8')
            })

        ndvi_collection = sentinel2.map(calculate_ndvi)

        # Extract results
        results = ndvi_collection.aggregate_array('ndvi').getInfo()
        dates = ndvi_collection.aggregate_array('system:time_start').getInfo()

        time_series = []
        for date_ms, ndvi_val in zip(dates, results):
            if ndvi_val is not None:
                # Convert milliseconds to date
                import datetime
                date_str = datetime.datetime.fromtimestamp(
                    date_ms / 1000
                ).strftime('%Y-%m-%d')

                time_series.append({
                    'date': date_str,
                    'ndvi': float(ndvi_val)
                })

        logger.info(f"✅ Retrieved {len(time_series)} NDVI observations")
        return time_series

    except Exception as e:
        logger.error(f"❌ Time series error: {e}")
        return []

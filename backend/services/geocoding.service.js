const axios = require('axios');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const ENABLE_MOCK_GEOCODING = process.env.ENABLE_MOCK_GEOCODING === 'true';

function canUseMockGeocoding() {
  return ENABLE_MOCK_GEOCODING || (!GOOGLE_MAPS_API_KEY && process.env.NODE_ENV !== 'production');
}

function buildMockLocationFromAddress(address) {
  // Deterministic fallback near Jaipur for local/dev testing when API credentials are unavailable.
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash * 31 + address.charCodeAt(i)) | 0;
  }
  const normalized = Math.abs(hash % 10000) / 10000;
  const lat = 26.85 + normalized * 0.05;
  const lng = 75.6 + normalized * 0.05;
  return { lat, lng };
}

/**
 * Geocode an address to get coordinates
 * @param {string} address - Full address
 * @param {number} areaAcres - Area in acres (used to estimate bounds)
 * @returns {Promise<object>} - Coordinates and polygon
 */
async function geocodeAddressToPolygon(address, areaAcres) {
  try {
    if (canUseMockGeocoding()) {
      const { lat, lng } = buildMockLocationFromAddress(address);
      return {
        latitude: lat,
        longitude: lng,
        polygon: {
          type: 'Polygon',
          coordinates: [calculatePolygonFromAcres(lat, lng, areaAcres)],
        },
        formattedAddress: `Mock geocoded address: ${address}`,
      };
    }

    // Geocode the address
    const geocodeResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      {
        params: {
          address: address,
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (geocodeResponse.data.results.length === 0) {
      throw new Error(`Address not found: ${address}`);
    }

    const location = geocodeResponse.data.results[0].geometry.location;
    const lat = location.lat;
    const lng = location.lng;

    // Calculate polygon based on acres
    const polygonCoordinates = calculatePolygonFromAcres(lat, lng, areaAcres);

    return {
      latitude: lat,
      longitude: lng,
      polygon: {
        type: 'Polygon',
        coordinates: [polygonCoordinates],
      },
      formattedAddress: geocodeResponse.data.results[0].formatted_address,
    };
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw new Error(`Failed to geocode address: ${error.message}`);
  }
}

/**
 * Calculate a polygon boundary based on area in acres
 * Assumes a roughly square plot
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} acres - Area in acres
 * @returns {array} - Array of [lng, lat] coordinates forming a polygon
 */
function calculatePolygonFromAcres(lat, lng, acres) {
  // 1 acre = 4046.86 sq meters
  // Calculate side length for square: sqrt(area_in_sq_meters)
  const areaInSqMeters = acres * 4046.86;
  const sideMeters = Math.sqrt(areaInSqMeters);

  // Convert meters to degrees (approximate at given latitude)
  // 1 degree latitude ≈ 111 km
  // 1 degree longitude ≈ 111 km * cos(latitude)
  const latDelta = (sideMeters / 2) / 111000;
  const lngDelta = (sideMeters / 2) / (111000 * Math.cos((lat * Math.PI) / 180));

  // Create a rectangular polygon around the center point
  const polygon = [
    [lng - lngDelta, lat - latDelta], // Southwest
    [lng + lngDelta, lat - latDelta], // Southeast
    [lng + lngDelta, lat + latDelta], // Northeast
    [lng - lngDelta, lat + latDelta], // Northwest
    [lng - lngDelta, lat - latDelta], // Close the polygon
  ];

  return polygon;
}

/**
 * Reverse geocode coordinates to get address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} - Address
 */
async function reverseGeocodeCoordinates(lat, lng) {
  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      {
        params: {
          latlng: `${lat},${lng}`,
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (response.data.results.length === 0) {
      throw new Error(`No address found for coordinates: ${lat}, ${lng}`);
    }

    return response.data.results[0].formatted_address;
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    throw new Error(`Failed to reverse geocode coordinates: ${error.message}`);
  }
}

/**
 * Validate if coordinates are within expected bounds for given address
 * @param {string} address - Address
 * @param {number} lat - Latitude to validate
 * @param {number} lng - Longitude to validate
 * @returns {Promise<boolean>} - True if coordinates match address
 */
async function validateCoordinatesForAddress(address, lat, lng) {
  try {
    const geocoded = await geocodeAddressToPolygon(address, 1);

    // Check if coordinates are close to geocoded location (within 1km)
    const R = 6371; // Earth's radius in km
    const dLat = ((geocoded.latitude - lat) * Math.PI) / 180;
    const dLng = ((geocoded.longitude - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((geocoded.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance < 1; // Within 1 km
  } catch (error) {
    console.error('Coordinate validation error:', error.message);
    return false;
  }
}

module.exports = {
  geocodeAddressToPolygon,
  reverseGeocodeCoordinates,
  validateCoordinatesForAddress,
  calculatePolygonFromAcres,
};

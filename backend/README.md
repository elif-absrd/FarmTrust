# FarmTrust Backend

Node.js + Express.js backend for FarmTrust application with PostgreSQL database and NDVI satellite integration.

## Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- Python (v3.8+) for NDVI service

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. PostgreSQL Setup

Install PostgreSQL and create a database:

```bash
# On Windows (if using PostgreSQL installation)
# Start PostgreSQL service

# Create database
psql -U postgres
CREATE DATABASE farmtrust;
\q
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and update values:

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

PORT=5000
NODE_ENV=development

JWT_SECRET=your_jwt_secret_key_change_this
JWT_EXPIRE=7d

NDVI_SERVICE_URL=http://localhost:8000

FRONTEND_URL=http://192.168.x.x:8081
```

**Important**: Replace `192.168.x.x` with your actual local IP address (get it via `ipconfig` on Windows).

### 4. Start Development Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:5000`

## API Endpoints

### Authentication

- **POST** `/api/auth/register` - Register new user
  ```json
  {
    "email": "farmer@example.com",
    "password": "password123",
    "farmerName": "John Doe",
    "phone": "+91-9876543210",
    "walletAddress": "0x123..."
  }
  ```

- **POST** `/api/auth/login` - Login user
  ```json
  {
    "email": "farmer@example.com",
    "password": "password123"
  }
  ```

### Farms (Requires JWT Token)

- **GET** `/api/farms` - Get all farms for user
- **POST** `/api/farms` - Create new farm
  ```json
  {
    "farmName": "North Field",
    "gpsPolygon": [
      {"lat": 28.5355, "lon": 77.3910},
      {"lat": 28.5360, "lon": 77.3920},
      {"lat": 28.5365, "lon": 77.3915}
    ]
  }
  ```
- **GET** `/api/farms/:farmId` - Get farm details
- **PUT** `/api/farms/:farmId` - Update farm

### Claims (Requires JWT Token)

- **GET** `/api/claims` - Get all claims for user
- **POST** `/api/claims/submit` - Submit disease claim with NDVI verification
  ```json
  {
    "farmId": 1,
    "policyId": 1,
    "diseaseImageHash": "QmXxxx...",
    "diseaseType": "Rice Blast",
    "diseaseSeverity": 0.85
  }
  ```
- **GET** `/api/claims/:claimId` - Get claim details

### Health Check

- **GET** `/api/health` - Backend status

## Database Schema

### users
- id, wallet_address, email, password_hash, phone, farmer_name, region, created_at, updated_at

### farms
- id, owner_id, farm_name, gps_polygon (JSONB), baseline_ndvi, baseline_date, created_at, updated_at

### ndvi_history
- id, farm_id, ndvi_value, fetch_date, created_at

### policies
- id, owner_id, farm_id, crop_type, coverage_amount, premium, severity_threshold, status, start_date, end_date, created_at, updated_at

### claims
- id, farm_id, policy_id, disease_image_hash, disease_type, disease_severity, ndvi_verified, ndvi_baseline, ndvi_current, ndvi_drop_percentage, status, created_at, updated_at

## Integration with NDVI Service

When a disease claim is submitted with severity > 0.6:

1. Backend sends farm ID to NDVI service
2. NDVI service fetches satellite data
3. NDVI result stored with claim
4. Claim marked as verified or flagged

The NDVI service should be running on `http://localhost:8000`

## Testing

### With cURL

Register:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "farmerName": "Test Farmer"
  }'
```

### From Expo Frontend

Update `app.json` API base URL to your local IP:
```javascript
const API_BASE_URL = 'http://192.168.x.x:5000';
```

Then use fetch:
```javascript
fetch(`${API_BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', password: 'test123' })
})
```

## Troubleshooting

- **postgres connection error**: Ensure PostgreSQL is running and credentials are correct
- **NDVI service not found**: Make sure NDVI service is running on port 8000
- **CORS errors**: Update CORS config with your IP address in server.js
- **Database tables not created**: Run `npm run start` which initializes DB automatically

## Scripts

- `npm run dev` - Development server with nodemon
- `npm start` - Production server
- `npm test` - Run tests (when configured)

## License

GPL-3.0

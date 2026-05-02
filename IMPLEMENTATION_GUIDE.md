# FarmTrust Implementation Guide - Advanced Features

## Overview
This document provides comprehensive details on the newly implemented advanced features for the FarmTrust platform, including orchard registration enhancements, admin review system, and trust engine integration.

---

## 1. Orchard Registration Enhancements

### 1.1 New Fields Added
**Database Schema Updates (`OrchardRegistration` model):**
- `areaAcres` (Decimal): Land area in acres
- `accountNumber` (String): Bank account number
- `accountName` (String): Account holder name
- `bankName` (String): Financial institution name

### 1.2 Automatic Perimeter Capture
**Feature:** Address-based GPS polygon generation

**Implementation:**
- Frontend captures user-entered: address, city, district, state, area in acres
- Calls `/api/farms/geocode-address` endpoint
- Backend uses Google Maps Geocoding API to:
  - Convert address to latitude/longitude
  - Calculate perimeter polygon based on acreage
  - Return formatted address and polygon coordinates
- Fallback: If geocoding fails, uses current device location

**Files Modified:**
- `app/pages/OrchardRegistration.tsx`: Added banking fields and geocoding UI
- `backend/services/geocoding.service.js`: New service for address geocoding
- `backend/routes/farms.js`: Added `/geocode-address` endpoint and updated registration handler

**API Endpoints:**
```
POST /api/farms/geocode-address
Body: { address: string, areaAcres: number }
Response: { latitude, longitude, polygon, formattedAddress }
```

---

## 2. Admin Review System

### 2.1 Admin Authentication & Role Management
**Database User Model:**
- `role` enum: `FARMER | PROVIDER | ADMIN`
- Admin users have access to review dashboard and claim management

**Middleware:** `requireAdmin` middleware enforces admin-only access

### 2.2 Admin Dashboard Page
**File:** `app/pages/AdminDashboard.tsx`

**Features:**
- **Dashboard Statistics:**
  - Total, pending, approved, rejected, surveyed-pending claims
  - Average trust score across all claims
  
- **Claims List:**
  - Filter by status (PENDING, UNDER_REVIEW, APPROVED, REJECTED)
  - Display farmer name, orchard name, trust score, disease type
  - Quick-view cards with key metrics

- **Detailed Review View:**
  - Complete farmer profile and banking details
  - Orchard information with GPS polygon
  - Disease analysis (type, severity, NDVI metrics)
  - Trust engine results with component scores breakdown
  - Full audit trail

- **Action Buttons:**
  - **Approve:** Approve claim for payout
  - **Reject:** Reject with mandatory reason
  - **Survey:** Mark as pending field survey

### 2.3 Admin API Routes
**File:** `backend/routes/admin.routes.js`

**Endpoints:**

#### Get Pending Claims
```
GET /api/admin/claims-pending-review?status=PENDING&page=1&limit=20
Response: {
  claims: [{
    id, claimId, farmerDetails, orchardDetails, claimDetails,
    trustEngine, status, createdAt
  }],
  pagination: { page, limit, total, pages }
}
```

#### Get Claim Details
```
GET /api/admin/claims/:claimId/details
Response: Complete claim data including audit trail and NDVI history
```

#### Approve Claim
```
POST /api/admin/claims/:claimId/approve
Body: { remarks?: string }
Response: Updated claim with status='APPROVED'
```

#### Reject Claim
```
POST /api/admin/claims/:claimId/reject
Body: { rejectionReason: string, remarks?: string }
Response: Updated claim with status='REJECTED'
```

#### Mark for Survey
```
POST /api/admin/claims/:claimId/survey
Body: { remarks?: string }
Response: Updated claim with status='SURVEYED_PENDING'
```

#### Dashboard Statistics
```
GET /api/admin/dashboard-stats
Response: {
  stats: {
    totalClaims, pendingClaims, approvedClaims,
    rejectedClaims, surveyPendingClaims, averageTrustScore
  }
}
```

---

## 3. Trust Engine Integration & IPFS Upload

### 3.1 Claim Status Workflow
```
Claim Submission
    ↓
Disease Detection (ML Model)
    ↓
Trust Engine Processing
    ↓
Status: PENDING (awaiting admin review)
    ↓
Admin Review Dashboard
    ↓
Approve/Reject/Survey Decision
    ↓
Status: APPROVED/REJECTED/SURVEYED_PENDING
```

### 3.2 Trust Engine Results Processing
**Endpoint:** `POST /api/claims/:claimId/trust-engine-results`

**Functionality:**
1. Receive trust engine results:
   - `trustScore`: Overall trust score (0-1)
   - `componentScores`: Individual component scores
   - File paths for: disease image, NDVI report, threshold report

2. Upload files to IPFS via Pinata API:
   - `diseaseImage` → `imageIpfsHash`
   - `ndviReport` → `ndviReportIpfsHash`
   - `thresholdReport` → `thresholdReportIpfsHash`

3. Store in database:
   - **Claim table:** `trustScore`, `componentScores`, `ipfsHashes`, status→PENDING
   - **AuditLog table:** All IPFS hashes, component scores, approval details

**Files Modified:**
- `backend/routes/claims.js`: Added trust engine result handler
- `backend/services/pinata.service.js`: New IPFS upload service

### 3.3 IPFS Integration Service
**File:** `backend/services/pinata.service.js`

**Functions:**
```javascript
uploadFileToPinata(filePath, fileName)
  → Returns IPFS hash

uploadJSONToPinata(data, name)
  → Returns IPFS hash for JSON data

uploadClaimFiles(claimFiles)
  → Upload multiple claim files
  → Returns { imageIpfsHash, ndviReportIpfsHash, thresholdReportIpfsHash }

getIPFSUrl(ipfsHash)
  → Convert hash to gateway URL

verifyIPFSHash(ipfsHash)
  → Verify file availability on IPFS
```

### 3.4 Database Schema Updates
**ClaimStatus Enum:**
```
PENDING          - Initial submission, awaiting admin review
UNDER_REVIEW     - Admin is reviewing
APPROVED         - Admin approved for payout
REJECTED         - Admin rejected
SURVEYED_PENDING - Field survey required
PAID             - Payout completed
```

**Claim Table New Fields:**
- `trustScore`: Decimal(5,3) - Overall trust engine score
- `componentScores`: JSON - Individual component scores
  ```json
  {
    "diseaseConfidence": 0.95,
    "ndviValidation": 0.87,
    "weatherMatch": 0.92,
    "neighborMatch": 0.78
  }
  ```
- `ipfsHashes`: JSON - IPFS hashes for uploaded files
  ```json
  {
    "imageIpfsHash": "QmXxxx...",
    "ndviReportIpfsHash": "QmYyyy...",
    "thresholdReportIpfsHash": "QmZzzz..."
  }
  ```
- `txHash`: String - Blockchain transaction hash
- `status`: ClaimStatus enum
- `approvedAt`: DateTime - Approval timestamp
- `approvedBy`: Int - Admin user ID
- `rejectionReason`: Text

**AuditLog Table:**
```
id                      - Primary key
claimId                 - Foreign key to Claim
action                  - TRUST_ENGINE_PROCESSED, APPROVED, REJECTED, etc.
imageIpfsHash           - Disease image hash
ndviReportIpfsHash      - NDVI report hash
thresholdReportIpfsHash - Threshold report hash
trustScore              - Trust score at time of audit
componentScores         - Component scores at time of audit
approvedBy              - Admin user ID
remarks                 - Approval/rejection remarks
createdAt               - Audit timestamp
```

---

## 4. Claim Approval Workflow

### 4.1 Complete Workflow
```
1. Farmer submits claim with disease image
   → ML model processes image
   
2. Trust Engine analyzes:
   → Disease confidence from ML
   → NDVI drop validation
   → Weather correlation
   → Neighboring farm patterns
   
3. Results uploaded to IPFS:
   → Disease image, NDVI report, threshold report
   → IPFS hashes stored in Claim & AuditLog
   
4. Claim status → PENDING
   → Admin notified
   
5. Admin reviews on Dashboard:
   → Views all claim details
   → Checks trust engine breakdown
   → Sees farming account info
   
6. Admin decides:
   APPROVE → Status: APPROVED
   REJECT → Status: REJECTED + reason
   SURVEY → Status: SURVEYED_PENDING
   
7. After Approval:
   → Smart contract triggered (when ready)
   → Payout executed via blockchain
   → Immutable record created: (farmId + claimId + threshold + txHash)
   → Status: PAID
```

### 4.2 Payment Finalization
**Endpoint:** `POST /api/claims/:claimId/finalize-payment`

**Functionality:**
1. Verify claim status = APPROVED
2. Update claim with blockchain tx_hash
3. Create immutable record on Polygon Ledger:
   ```
   Format: farmId + claimId + Threshold + tx_hash
   Stored in: AuditLog with action='PAYMENT_FINALIZED'
   ```
4. Update status to PAID

---

## 5. Environment Variables Required

### Backend (.env)
```
# Google Maps API
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Pinata IPFS
PINATA_API_KEY=your_pinata_key
PINATA_API_SECRET=your_pinata_secret
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/farmtrust

# Services
NDVI_SERVICE_URL=http://localhost:8000
BLOCKCHAIN_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/...
```

---

## 6. Component Files Structure

### Frontend Components
```
app/
├── pages/
│   ├── OrchardRegistration.tsx      - Updated with geocoding & banking fields
│   ├── AdminDashboard.tsx           - New admin review dashboard
│   └── Claims.tsx                   - Existing claims page
├── components/
│   └── ui/
│       └── Badge.tsx                - Updated for status-based styling
```

### Backend Services & Routes
```
backend/
├── services/
│   ├── geocoding.service.js        - Google Maps integration
│   └── pinata.service.js           - IPFS upload service
├── routes/
│   ├── admin.routes.js             - Admin API endpoints
│   ├── claims.js                   - Updated with trust engine integration
│   └── farms.js                    - Updated geocoding endpoint
└── prisma/
    └── schema.prisma               - Updated models
```

---

## 7. Key Features Summary

### For Farmers
✅ Automatic GPS polygon generation from address & acreage
✅ Bank account details capture during registration
✅ View claim submission status and trust engine results
✅ Track payment history

### For Admins
✅ Centralized review dashboard
✅ View all pending claims with detailed information
✅ Review trust engine component scores individually
✅ View farmer banking details for payout
✅ Approve, reject, or request field survey
✅ Add remarks during approval/rejection
✅ Dashboard with real-time statistics
✅ Filter claims by status

### System Features
✅ Automatic address-to-coordinates conversion
✅ IPFS integration for document immutability
✅ Comprehensive audit trail
✅ Component-wise trust score breakdown
✅ Multi-status claim workflow
✅ Blockchain transaction recording

---

## 8. Testing Guide

### Test the Geocoding Endpoint
```bash
curl -X POST http://localhost:5000/api/farms/geocode-address \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "address": "123 Main St, Springfield, IL 62701",
    "areaAcres": 50
  }'
```

### Test Admin Routes
```bash
# Get pending claims
curl http://localhost:5000/api/admin/claims-pending-review \
  -H "Authorization: Bearer <admin_token>"

# Get dashboard stats
curl http://localhost:5000/api/admin/dashboard-stats \
  -H "Authorization: Bearer <admin_token>"

# Approve a claim
curl -X POST http://localhost:5000/api/admin/claims/1/approve \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"remarks": "Claim looks good"}'
```

---

## 9. Future Enhancements

1. **Field Survey Module:** GPS-enabled field verification by surveyors
2. **Automated Payout:** Smart contract integration for automatic claim settlement
3. **Weather API Integration:** Real-time weather correlation
4. **Neighbor Analytics:** Automated neighboring farm analysis
5. **Report Generation:** PDF claim reports with full audit trail
6. **Notifications:** Email/SMS alerts for claim status updates
7. **Insurance Provider Portal:** Portal for insurance companies to view approved claims

---

## 10. Troubleshooting

### Geocoding Fails
- Verify Google Maps API key is set in .env
- Check API quotas in Google Cloud Console
- Ensure address format is valid (street, city, state, zip)

### IPFS Upload Fails
- Verify Pinata credentials in .env
- Check Pinata account quotas
- Ensure files exist at specified paths
- Check file permissions

### Admin Dashboard Not Loading
- Verify user role is set to ADMIN in database
- Check backend logs for auth errors
- Ensure admin routes are registered in server.js

---

## Migration Steps

1. **Update Database:**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

2. **Install Dependencies:**
   ```bash
   npm install form-data axios
   ```

3. **Set Environment Variables:**
   - Add Google Maps API key
   - Add Pinata API credentials

4. **Restart Backend:**
   ```bash
   npm start
   ```

5. **Access Admin Dashboard:**
   - User must have role='ADMIN'
   - Navigate to Admin Dashboard page

---

**Implementation Complete!** All features are ready for testing and deployment.

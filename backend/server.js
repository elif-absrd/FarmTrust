require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const prisma = require('./config/prisma');
const { startNdviSyncScheduler } = require('./services/ndviSync');

// Import routes
const authRoutes = require('./routes/auth');
const farmsRoutes = require('./routes/farms');
const claimsRoutes = require('./routes/claims');

const app = express();
const PORT = process.env.PORT || 5000;
const NDVI_SERVICE_URL = process.env.NDVI_SERVICE_URL || 'http://localhost:8000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8082';

// Parse CORS origins from environment variable or use defaults
const getCorsOrigins = () => {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map(url => url.trim());
  }
  return [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    FRONTEND_URL,
    'http://localhost:3000', // For testing/development
  ];
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS configuration
app.use(cors({
  origin: getCorsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/farms', farmsRoutes);
app.use('/api/claims', claimsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🔄 Connecting to PostgreSQL via Prisma...');
    await prisma.$connect();

    app.listen(PORT, () => {
      console.log(`\n✅ FarmTrust Backend running on http://localhost:${PORT}`);
      console.log(`📄 Health check: http://localhost:${PORT}/api/health`);
      console.log('\n📡 Available endpoints:');
      console.log('  POST   /api/auth/register');
      console.log('  POST   /api/auth/login');
      console.log('  GET    /api/auth/me');
      console.log('  GET    /api/farms');
      console.log('  POST   /api/farms');
      console.log('  POST   /api/farms/register-orchard');
      console.log('  GET    /api/farms/:farmId');
      console.log('  PUT    /api/farms/:farmId');
      console.log('  GET    /api/farms/:farmId/ndvi-current');
      console.log('  GET    /api/claims');
      console.log('  POST   /api/claims/submit');
      console.log('  GET    /api/claims/:claimId');
      console.log(`\n💡 NDVI Service: ${NDVI_SERVICE_URL}`);
      console.log(`   Frontend URL: ${FRONTEND_URL}\n`);
      
      // Start NDVI sync scheduler if enabled
      if (process.env.NDVI_SYNC_ON_START === 'true') {
        console.log('🔄 Starting NDVI sync scheduler...');
        startNdviSyncScheduler();
      } else {
        console.log('⏭️  NDVI sync scheduler disabled (set NDVI_SYNC_ON_START=true to enable)');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initializeDatabase = require('./config/init-db');

// Import routes
const authRoutes = require('./routes/auth');
const farmsRoutes = require('./routes/farms');
const claimsRoutes = require('./routes/claims');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration for Expo and local development
app.use(cors({
  origin: [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:8081',
    'http://localhost:3000',
    // Add your Expo IP here: 'http://192.168.x.x:8081'
  ],
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
    console.log('🔄 Initializing database...');
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`\n✅ FarmTrust Backend running on http://localhost:${PORT}`);
      console.log(`📄 Health check: http://localhost:${PORT}/api/health`);
      console.log('\n📡 Available endpoints:');
      console.log('  POST   /api/auth/register');
      console.log('  POST   /api/auth/login');
      console.log('  GET    /api/farms');
      console.log('  POST   /api/farms');
      console.log('  GET    /api/farms/:farmId');
      console.log('  PUT    /api/farms/:farmId');
      console.log('  GET    /api/claims');
      console.log('  POST   /api/claims/submit');
      console.log('  GET    /api/claims/:claimId');
      console.log('\n💡 Make sure NDVI service is running on http://localhost:8000\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

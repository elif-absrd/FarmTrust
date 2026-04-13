const pool = require('./database');

const initializeDatabase = async () => {
  try {
    // Create Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        phone VARCHAR(20),
        farmer_name VARCHAR(255),
        region VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create Farms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS farms (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        farm_name VARCHAR(255),
        gps_polygon JSONB,
        baseline_ndvi DECIMAL(5,3),
        baseline_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create NDVI History table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ndvi_history (
        id SERIAL PRIMARY KEY,
        farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
        ndvi_value DECIMAL(5,3),
        fetch_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create Policies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS policies (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
        crop_type VARCHAR(255),
        coverage_amount DECIMAL(12,2),
        premium DECIMAL(12,2),
        severity_threshold DECIMAL(3,2),
        status VARCHAR(50),
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create Claims table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY,
        farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
        policy_id INTEGER REFERENCES policies(id),
        disease_image_hash VARCHAR(255),
        disease_type VARCHAR(255),
        disease_severity DECIMAL(3,2),
        ndvi_verified BOOLEAN DEFAULT FALSE,
        ndvi_baseline DECIMAL(5,3),
        ndvi_current DECIMAL(5,3),
        ndvi_drop_percentage DECIMAL(5,2),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
};

module.exports = initializeDatabase;

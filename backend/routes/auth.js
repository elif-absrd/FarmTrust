const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { authenticateToken, generateToken } = require('../middleware/auth');

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    // Accept multiple common field names from different clients
    const {
      email,
      password,
      farmerName,
      farmer_name,
      name,
      phone,
      phoneNumber,
      walletAddress,
      wallet_address,
      region,
    } = req.body;

    const finalFarmerName = farmerName || farmer_name || name;
    const finalPhone = phone || phoneNumber || null;
    const finalWallet = walletAddress || wallet_address || null;

    const missing = [];
    if (!email) missing.push('email');
    if (!password) missing.push('password');
    if (!finalFarmerName) missing.push('farmerName');

    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', missing });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        farmerName: finalFarmerName,
        phone: finalPhone,
        walletAddress: finalWallet,
        region: region || null,
        role: 'FARMER',
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'ACTIVE',
        onboardingCompleted: false,
      },
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        farmer_name: user.farmerName,
        wallet_address: user.walletAddress,
        role: user.role,
        subscription_plan: user.subscriptionPlan,
        subscription_status: user.subscriptionStatus,
        onboarding_completed: user.onboardingCompleted,
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare passwords
    const isPasswordValid = user.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        farmer_name: user.farmerName,
        wallet_address: user.walletAddress,
        role: user.role,
        subscription_plan: user.subscriptionPlan,
        subscription_status: user.subscriptionStatus,
        onboarding_completed: user.onboardingCompleted,
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        farmerName: true,
        walletAddress: true,
        region: true,
        role: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        onboardingCompleted: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        farmer_name: user.farmerName,
        wallet_address: user.walletAddress,
        region: user.region,
        role: user.role,
        subscription_plan: user.subscriptionPlan,
        subscription_status: user.subscriptionStatus,
        onboarding_completed: user.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;

const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

async function ensureAdminUser() {
  if (process.env.SEED_ADMIN_ON_START !== 'true') {
    return false;
  }

  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'Admin').trim();
  const walletAddress = (process.env.ADMIN_WALLET_ADDRESS || '').trim() || null;

  if (!email || !password) {
    console.warn('[admin-seed] Skipped: set ADMIN_EMAIL and ADMIN_PASSWORD (and SEED_ADMIN_ON_START=true).');
    return false;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      farmerName: name,
      walletAddress,
      role: 'ADMIN',
      subscriptionPlan: 'FREE',
      subscriptionStatus: 'ACTIVE',
      onboardingCompleted: true,
    },
    update: {
      passwordHash,
      farmerName: name,
      walletAddress,
      role: 'ADMIN',
      onboardingCompleted: true,
    },
  });

  console.log(`[admin-seed] Admin ensured: ${email}`);
  return true;
}

module.exports = { ensureAdminUser };

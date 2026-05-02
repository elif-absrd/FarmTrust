/**
 * test-payout-flow.js
 * -------------------------------------------------------
 * End-to-end test of the FarmTrust payout workflow:
 *   1. Find (or seed) a Farm + User in the DB
 *   2. Create a qualifying Claim (severity=0.85, trustScore=0.80)
 *   3. Approve the Claim via approveClaimForPayout()
 *   4. Confirm the Payout via confirmPayoutForApprovedClaim()
 *      → Calls MockINR.mint (simulated) → MockInsurance.triggerPayout (simulated)
 *      → Writes tx_hash to the Claims table
 *
 * Usage:
 *   node scripts/test-payout-flow.js
 *   node scripts/test-payout-flow.js --claimId=42   # use an existing claim
 *   node scripts/test-payout-flow.js --farmId=12    # seed claim on a specific farm
 * -------------------------------------------------------
 */

require('dotenv').config();
const prisma = require('../config/prisma');
const { approveClaimForPayout, confirmPayoutForApprovedClaim } = require('../services/claim-approval.service');

// ─── Config ───────────────────────────────────────────
const PAYOUT_POL_AMOUNT = 0.01;    // Amount in POL to transfer
const ADMIN_EMAIL       = process.env.ADMIN_EMAIL || 'admin@farmtrust.com';
const DEFAULT_FARM_ID   = 13;      // Farm #13 — test2's farm


// Parse CLI args: --claimId=42  --farmId=12
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.replace('--', '').split('='); return [k, v]; })
);

// ─── Helpers ──────────────────────────────────────────
function log(emoji, msg) { console.log(`${emoji}  ${msg}`); }
function divider() { console.log('─'.repeat(60)); }

async function getAdmin() {
  const admin = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL } });
  if (!admin) throw new Error(`Admin not found (email: ${ADMIN_EMAIL}). Make sure SEED_ADMIN_ON_START=true and the server has run once.`);
  return admin;
}

async function getOrSeedFarm(farmId) {
  if (farmId) {
    const farm = await prisma.farm.findUnique({ where: { id: Number(farmId) } });
    if (!farm) throw new Error(`Farm #${farmId} not found in DB.`);
    log('🌿', `Using existing Farm #${farm.id} — "${farm.farmName}"`);
    return farm;
  }

  // Find any farm in the DB
  const farm = await prisma.farm.findFirst();
  if (!farm) throw new Error('No farms in DB. Please register a farm via the app first.');
  log('🌿', `Using first farm in DB: Farm #${farm.id} — "${farm.farmName}"`);
  return farm;
}

async function seedQualifyingClaim(farm) {
  log('🌱', `Seeding qualifying test claim on Farm #${farm.id}...`);

  const claim = await prisma.claim.create({
    data: {
      farm: { connect: { id: farm.id } },
      farmTokenId: parseInt(farm.farmTokenId, 10) || 0,
      farmerWalletAddress: farm.farmerWalletAddress || '',
      // Qualifying values — these pass SEVERITY_THRESHOLD(0.20) and TRUST_THRESHOLD(0.65)
      diseaseType: 'Wheat Rust (Test)',
      diseaseSeverity: 0.85,   // 85% — well above the 20% threshold
      trustScore: 0.80,   // 80% — well above the 65% threshold
      componentScores: { n: 0.90, g: 0.75, t: 0.80, w: 0.70, p: 0.65 },
      routingTier: 'FAST TRACK',
      status: 'PENDING',
      ndviVerified: true,
      ndviBaseline: 0.65,
      ndviCurrent: 0.35,
      ndviDropPercentage: 46.15,
      diseaseImageHash: 'test-image-hash-' + Date.now(),
      ipfsHashes: { thresholdReportIpfsHash: null },
      trustReportJson: {
        scores: { n: 0.90, g: 0.75, t: 0.80, w: 0.70, p: 0.65, trustScore: 0.80 },
        routingTier: 'FAST TRACK',
        status: 'Pending for Admin Review',
      },
    },
  });

  log('✅', `Seeded Claim #${claim.id} (status: ${claim.status}, trustScore: ${claim.trustScore}, severity: ${claim.diseaseSeverity})`);
  return claim;
}

// ─── Main ─────────────────────────────────────────────
async function main() {
  divider();
  log('🚀', 'FarmTrust Payout Workflow Test — Farm #13 (test2)');
  divider();


  const admin = await getAdmin();
  log('👤', `Admin: ${admin.email} (ID: ${admin.id})`);

  // ── Step 1: Get or create a claim ──
  let claimId = args.claimId ? parseInt(args.claimId, 10) : null;
  let claim;

  if (claimId) {
    claim = await prisma.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new Error(`Claim #${claimId} not found.`);
    log('📋', `Using existing Claim #${claim.id} (status: ${claim.status}, severity: ${claim.diseaseSeverity}, trustScore: ${claim.trustScore})`);

    if (claim.status === 'PAID') {
      log('⚠️ ', `Claim #${claim.id} is already PAID. Aborting.`);
      return;
    }

    // If it's already APPROVED, skip the approve step
    if (claim.status === 'APPROVED') {
      log('ℹ️ ', 'Claim already APPROVED — skipping approval step.');
    }
  } else {
    const farm = await getOrSeedFarm(args.farmId || DEFAULT_FARM_ID);
    claim = await seedQualifyingClaim(farm);
    claimId = claim.id;
  }


  divider();

  // ── Step 2: Approve the claim ──
  if (claim.status !== 'APPROVED') {
    log('📝', `Step 2: Approving Claim #${claimId}...`);
    try {
      const approveResult = await approveClaimForPayout({
        claimId,
        adminId: admin.id,
        remarks: 'Approved via test-payout-flow.js',
      });

      if (approveResult.status === 'ESCALATED') {
        log('⚠️ ', `Claim was escalated instead of approved!`);
        log('ℹ️ ', `Reason: ${approveResult.reason}`);
        log('ℹ️ ', `severity=${Number(claim.diseaseSeverity).toFixed(2)}, threshold=${approveResult.threshold}`);
        log('💡', 'Tip: Pass an existing claimId with trustScore >= 0.65 and severity >= 0.20, or let this script seed a fresh claim.');
        return;
      }

      log('✅', `Claim APPROVED. Status: ${approveResult.status}`);
      log('📊', `Threshold source: ${approveResult.thresholdSource}, value: ${approveResult.threshold}`);
    } catch (err) {
      log('❌', `Approval failed: ${err.message}`);
      throw err;
    }
  }

  divider();

  // ── Step 3: Confirm payout ──
  log('💸', `Step 3: Confirming Payout of ${PAYOUT_POL_AMOUNT} POL for Claim #${claimId}...`);
  log('ℹ️ ', `MockINR address: ${process.env.MOCK_INR_ADDRESS || '(not set — using mock hash)'}`);
  log('ℹ️ ', `MockInsurance address: ${process.env.MOCK_INSURANCE_ADDRESS || '(not set — using mock hash)'}`);

  try {
    const payoutResult = await confirmPayoutForApprovedClaim({
      claimId,
      adminId: admin.id,
      amount: PAYOUT_POL_AMOUNT,
      remarks: 'Payout confirmed via test-payout-flow.js',
    });

    divider();
    log('🎉', 'PAYOUT COMPLETE!');
    log('📦', `Claim Status: ${payoutResult.status}`);
    log('🔗', `TX Hash: ${payoutResult.txHash}`);
    log('🌐', `Polygonscan: ${payoutResult.polygonscanUrl}`);
    log('💱', `RAMP conversion: ${JSON.stringify(payoutResult.ramp, null, 2)}`);
    divider();
  } catch (err) {
    const msg = err?.message || err?.toString() || JSON.stringify(err);
    log('❌', `Payout failed: ${msg}`);
    console.error('[Full error object]', err);
    throw err;
  }
}

main()
  .catch((err) => {
    const msg = err?.message || err?.toString() || JSON.stringify(err);
    console.error('\n💥 Test failed:', msg);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

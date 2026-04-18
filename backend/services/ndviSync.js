const cron = require('node-cron');
const { Prisma } = require('@prisma/client');
const axios = require('axios');
const prisma = require('../config/prisma');

async function syncFarmNdvi(farm) {
  const ndviResponse = await axios.get(
    `${process.env.NDVI_SERVICE_URL || 'http://localhost:8000'}/api/ndvi/current/${farm.id}`,
    { timeout: 30000 }
  );

  const ndviValue = Number(ndviResponse.data.ndvi);
  if (!Number.isFinite(ndviValue)) {
    throw new Error(`Invalid NDVI for farm ${farm.id}`);
  }

  await prisma.$transaction([
    prisma.ndviHistory.create({
      data: {
        farmId: farm.id,
        ndviValue: new Prisma.Decimal(ndviValue.toFixed(3)),
        fetchDate: new Date(),
      },
    }),
    prisma.farm.update({
      where: { id: farm.id },
      data: {
        ndviScore: new Prisma.Decimal(ndviValue.toFixed(3)),
        ndviScoredAt: new Date(),
      },
    }),
  ]);
}

async function runNdviSyncJob() {
  const farms = await prisma.farm.findMany({
    where: { gpsPolygon: { not: Prisma.JsonNull } },
    select: { id: true },
  });

  for (const farm of farms) {
    try {
      await syncFarmNdvi(farm);
      console.log(`NDVI sync success for farm ${farm.id}`);
    } catch (error) {
      console.warn(`NDVI sync failed for farm ${farm.id}: ${error.message}`);
    }
  }
}

function startNdviSyncScheduler() {
  // Every 5 days at 00:00 server time.
  cron.schedule('0 0 */5 * *', async () => {
    console.log('Starting scheduled NDVI sync job...');
    await runNdviSyncJob();
  });

  if (process.env.NDVI_SYNC_ON_START === 'true') {
    runNdviSyncJob().catch((error) => {
      console.warn('Initial NDVI sync failed:', error.message);
    });
  }
}

module.exports = {
  startNdviSyncScheduler,
  runNdviSyncJob,
};

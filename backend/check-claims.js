const prisma = require('./config/prisma');

async function main() {
  const claims = await prisma.claim.findMany();
  console.log('Claims:', claims.map(c => ({ id: c.id, status: c.status, approvedBy: c.approvedBy })));
}

main().catch(console.error).finally(() => prisma.$disconnect());

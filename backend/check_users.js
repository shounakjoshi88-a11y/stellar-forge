const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ select: { email: true, role: true } }).then(users => {
  console.log('Users in DB:', JSON.stringify(users, null, 2));
  return p.$disconnect();
});

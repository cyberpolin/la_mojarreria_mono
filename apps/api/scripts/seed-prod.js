const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SUPERADMIN_EMAIL = "cyberpolin@gmail.com";
const SUPERADMIN_PASSWORD = "changeme";
const SUPERADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";
const SUPERADMIN_NAME = "Super Admin";
const SUPERADMIN_PHONE = "521999999999";
const SUPERADMIN_PIN = process.env.SUPERADMIN_PIN || "1234";

async function main() {
  const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { id: SUPERADMIN_USER_ID },
    update: {
      name: SUPERADMIN_NAME,
      phone: SUPERADMIN_PHONE,
      role: "ADMIN",
      active: true,
    },
    create: {
      id: SUPERADMIN_USER_ID,
      name: SUPERADMIN_NAME,
      phone: SUPERADMIN_PHONE,
      role: "ADMIN",
      active: true,
    },
  });

  await prisma.auth.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: {
      password: hashedPassword,
      userId: SUPERADMIN_USER_ID,
      pin: SUPERADMIN_PIN,
    },
    create: {
      email: SUPERADMIN_EMAIL,
      password: hashedPassword,
      userId: SUPERADMIN_USER_ID,
      pin: SUPERADMIN_PIN,
    },
  });

  console.log("Production seed completed.");
  console.log(`Super admin: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`);
  console.log(`Super admin PIN: ${SUPERADMIN_PIN}`);
}

main()
  .catch((error) => {
    console.error("Production seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

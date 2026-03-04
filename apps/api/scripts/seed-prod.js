const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const {
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
  SUPERADMIN_USER_ID,
  SUPERADMIN_NAME,
  SUPERADMIN_PHONE,
  SUPERADMIN_PIN,
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const superAdminEmail = requireEnv("SUPERADMIN_EMAIL", SUPERADMIN_EMAIL);
const superAdminPassword = requireEnv(
  "SUPERADMIN_PASSWORD",
  SUPERADMIN_PASSWORD,
);
const superAdminUserId = requireEnv("SUPERADMIN_USER_ID", SUPERADMIN_USER_ID);
const superAdminName = requireEnv("SUPERADMIN_NAME", SUPERADMIN_NAME);
const superAdminPhone = requireEnv("SUPERADMIN_PHONE", SUPERADMIN_PHONE);
const superAdminPin = requireEnv("SUPERADMIN_PIN", SUPERADMIN_PIN);

async function main() {
  const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

  await prisma.user.upsert({
    where: { id: superAdminUserId },
    update: {
      name: superAdminName,
      phone: superAdminPhone,
      role: "ADMIN",
      active: true,
    },
    create: {
      id: superAdminUserId,
      name: superAdminName,
      phone: superAdminPhone,
      role: "ADMIN",
      active: true,
    },
  });

  await prisma.auth.upsert({
    where: { email: superAdminEmail },
    update: {
      password: hashedPassword,
      userId: superAdminUserId,
      pin: superAdminPin,
    },
    create: {
      email: superAdminEmail,
      password: hashedPassword,
      userId: superAdminUserId,
      pin: superAdminPin,
    },
  });

  console.log("Production seed completed.");
  console.log(`Super admin: ${superAdminEmail}`);
}

main()
  .catch((error) => {
    console.error("Production seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

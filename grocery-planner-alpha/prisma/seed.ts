import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    console.error("Set SEED_PASSWORD env var: SEED_PASSWORD=yourpassword npx prisma db seed");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: "admin@grocery-planner.local" },
    update: {},
    create: {
      email: "admin@grocery-planner.local",
      name: "Admin",
      password: hashedPassword,
      householdSize: 1,
      mealsPerDay: 3,
      cookingTimePreference: "moderate",
    },
  });

  console.log("Seeded user:", user.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

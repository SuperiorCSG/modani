import "dotenv/config";
import { db } from "@/lib/db";
import { hashAdminPassword } from "@/lib/auth";

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD to create or update an admin");
  }

  const passwordHash = await hashAdminPassword(password);
  const admin = await db.admin.upsert({
    where: { email },
    update: { passwordHash, name, status: "active" },
    create: { email, passwordHash, name, status: "active" }
  });

  console.log(`Admin ready: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

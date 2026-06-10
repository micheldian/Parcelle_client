/**
 * Seed : crée le compte ADMIN initial s'il n'existe pas.
 * Identifiants pilotés par ADMIN_EMAIL / ADMIN_PASSWORD (.env).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@agriconnect.local";
  const password = process.env.ADMIN_PASSWORD ?? "changez-moi";

  const existant = await prisma.user.findUnique({ where: { email } });
  if (existant) {
    console.log(`✔ Compte admin déjà présent : ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      role: "ADMIN",
    },
  });
  console.log(`✔ Compte admin créé : ${email} (pensez à changer le mot de passe)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

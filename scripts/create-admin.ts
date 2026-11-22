/**
 * Creates an admin account, or makes an existing account an admin, in the
 * database DATABASE_URL points at (local or hosted).
 *
 *   npm run admin:create -- --email findvarsity@gmail.com
 *       asks for the password (8+ characters) when it creates the account
 *   npm run admin:create -- --email findvarsity@gmail.com --generate-password
 *       makes a strong password and prints it once
 *   npm run admin:create -- --email someone@example.com --reset-password
 *       also replaces the password of an account that already exists
 *
 * The password is never taken on the command line, so it stays out of shell
 * history.
 */
import "dotenv/config";
import { randomInt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

/** 4 groups of 4 from an alphabet without look-alikes (no 0/O, 1/l/I). */
function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("")).join("-");
}

async function askPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Password for the admin account (8+ characters): ");
  rl.close();
  return password;
}

async function main() {
  const email = arg("email")?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Pass the admin's email: --email you@example.com");
  }
  const name = arg("name")?.trim() || "Admin";
  const generate = flag("generate-password");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    const needsPassword = !existing || flag("reset-password") || generate;
    let password: string | null = null;
    if (needsPassword) {
      password = generate ? generatePassword() : await askPassword();
      if (password.length < 8) throw new Error("The password must be at least 8 characters; nothing changed.");
    }
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN", ...(passwordHash ? { passwordHash } : {}) } })
      : await prisma.user.create({ data: { email, name, role: "ADMIN", passwordHash, emailVerified: new Date() } });

    const host = new URL(process.env.DATABASE_URL ?? "postgres://unknown").hostname;
    console.log(`${existing ? "Made an admin" : "Created admin"}: ${user.email} (database host ${host})`);
    if (generate && password) console.log(`Password (shown once): ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

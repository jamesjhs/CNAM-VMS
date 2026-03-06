/**
 * scripts/set-initial-password.ts
 *
 * One-time run-once script that sets the root user password to "password"
 * and marks the account as requiring an immediate password change.
 *
 * Usage:
 *   npx ts-node --project tsconfig.seed.json scripts/set-initial-password.ts
 *
 * OR via npm:
 *   npm run db:set-initial-password
 *
 * The script is idempotent — it can safely be run multiple times.
 * It will ALWAYS reset the root user's password to the default and set the
 * mustChangePassword flag, so subsequent runs will re-lock the account.
 */

import { PrismaClient } from '@prisma/client';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${hash.toString('hex')}.${salt}`;
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const rootEmail = (process.env.ROOT_USER_EMAIL ?? 'jrowson@gmail.com').toLowerCase().trim();
    const defaultPassword = process.env.INITIAL_PASSWORD ?? 'password';

    console.log(`\n🔑  Setting initial password for: ${rootEmail}`);

    const user = await prisma.user.findUnique({ where: { email: rootEmail } });

    if (!user) {
      console.error(`\n❌  User not found: ${rootEmail}`);
      console.error('    Make sure the root user exists in the database (run the seed first).');
      process.exit(1);
    }

    const hash = await hashPassword(defaultPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        mustChangePassword: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_BY_SCRIPT',
        resource: 'User',
        resourceId: user.id,
        detail: { note: 'Initial password set via set-initial-password script' },
      },
    });

    console.log(`\n✅  Password set successfully.`);
    console.log(`    The account will require a password change on first login.`);
    console.log(`\n    Sign in at /auth/signin with:`);
    console.log(`      Email:    ${rootEmail}`);
    console.log(`      Password: ${defaultPassword}`);
    console.log(`\n    ⚠️  Change this password immediately after signing in!\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

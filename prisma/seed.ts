import { PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const CAPABILITIES = [
  { key: 'admin:users.read', description: 'View all users' },
  { key: 'admin:users.write', description: 'Create, update, delete users' },
  { key: 'admin:roles.read', description: 'View roles and capabilities' },
  { key: 'admin:roles.write', description: 'Create, update, delete roles' },
  { key: 'admin:audit.read', description: 'View audit logs' },
  { key: 'admin:files.read', description: 'View all uploaded files' },
  { key: 'admin:files.write', description: 'Upload and manage files' },
  { key: 'admin:theme.write', description: 'Manage site theme and settings' },
  { key: 'volunteer:tasks.read', description: 'View tasks' },
  { key: 'volunteer:tasks.write', description: 'Create and update tasks' },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Create capabilities
  for (const cap of CAPABILITIES) {
    await prisma.capability.upsert({
      where: { key: cap.key },
      update: { description: cap.description },
      create: { key: cap.key, description: cap.description },
    });
  }
  console.log(`✅ Created ${CAPABILITIES.length} capabilities`);

  // Create root role with all capabilities
  const allCapabilities = await prisma.capability.findMany();
  const rootRole = await prisma.role.upsert({
    where: { name: 'Root' },
    update: { description: 'Superadmin with all capabilities', isSystem: true },
    create: {
      name: 'Root',
      description: 'Superadmin with all capabilities',
      isSystem: true,
    },
  });

  // Assign all capabilities to root role
  for (const cap of allCapabilities) {
    await prisma.roleCapability.upsert({
      where: { roleId_capabilityId: { roleId: rootRole.id, capabilityId: cap.id } },
      update: {},
      create: { roleId: rootRole.id, capabilityId: cap.id },
    });
  }
  console.log(`✅ Root role configured with ${allCapabilities.length} capabilities`);

  // Create volunteer role with limited capabilities
  const volunteerRole = await prisma.role.upsert({
    where: { name: 'Volunteer' },
    update: { description: 'Standard volunteer', isSystem: true },
    create: {
      name: 'Volunteer',
      description: 'Standard volunteer',
      isSystem: true,
    },
  });

  const volunteerCapKeys = ['volunteer:tasks.read'];
  for (const key of volunteerCapKeys) {
    const cap = allCapabilities.find((c) => c.key === key);
    if (cap) {
      await prisma.roleCapability.upsert({
        where: { roleId_capabilityId: { roleId: volunteerRole.id, capabilityId: cap.id } },
        update: {},
        create: { roleId: volunteerRole.id, capabilityId: cap.id },
      });
    }
  }
  console.log(`✅ Volunteer role configured`);

  // Create root user
  const rootEmail = process.env.ROOT_USER_EMAIL;
  const rootName = process.env.ROOT_USER_NAME ?? 'Root Admin';

  if (!rootEmail) {
    console.log('⚠️  ROOT_USER_EMAIL not set, skipping root user creation');
    return;
  }

  const normalizedEmail = rootEmail.toLowerCase().trim();
  const rootUser = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { name: rootName, status: UserStatus.ACTIVE },
    create: {
      email: normalizedEmail,
      name: rootName,
      status: UserStatus.ACTIVE,
    },
  });

  // Assign root role to root user
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: rootUser.id, roleId: rootRole.id } },
    update: {},
    create: { userId: rootUser.id, roleId: rootRole.id },
  });

  console.log(`✅ Root user created/updated: ${normalizedEmail}`);
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

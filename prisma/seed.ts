import { PrismaClient, UserStatus } from '@prisma/client';
import { CAPABILITIES } from '../src/lib/capabilities';

const prisma = new PrismaClient();

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

  // Create admin role with user/team/role management capabilities
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: { description: 'Administrator with user management rights', isSystem: true },
    create: {
      name: 'Admin',
      description: 'Administrator with user management rights',
      isSystem: true,
    },
  });

  const adminCapKeys = [
    'admin:users.read',
    'admin:users.write',
    'admin:roles.read',
    'admin:teams.read',
    'admin:teams.write',
    'admin:audit.read',
  ];
  for (const key of adminCapKeys) {
    const cap = allCapabilities.find((c) => c.key === key);
    if (cap) {
      await prisma.roleCapability.upsert({
        where: { roleId_capabilityId: { roleId: adminRole.id, capabilityId: cap.id } },
        update: {},
        create: { roleId: adminRole.id, capabilityId: cap.id },
      });
    }
  }
  console.log(`✅ Admin role configured`);

  // Create default teams
  const defaultTeams = [
    { name: 'Aircraft Restoration', description: 'Restoring and maintaining the museum aircraft collection' },
    { name: 'Visitor Services', description: 'Front-of-house and visitor experience' },
    { name: 'Education & Outreach', description: 'School visits and community engagement' },
    { name: 'Grounds & Facilities', description: 'Site maintenance and facilities management' },
    { name: 'Events & Fundraising', description: 'Special events and fundraising activities' },
  ];

  for (const team of defaultTeams) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: { description: team.description },
      create: team,
    });
  }
  console.log(`✅ ${defaultTeams.length} default teams created`);

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

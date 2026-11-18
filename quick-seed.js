const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://authenticator:npg_LF1XpaWK5ADk@ep-little-shadow-azj0b69n.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function main() {
  console.log('🌱 Seeding database...\n');

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Default Workspace',
      slug: 'default',
      settings: {}
    }
  });
  console.log('✅ Workspace created');

  // Create admin user
  const hashedPassword = await bcrypt.hash('ChangeMe-Dev-Only-123', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@crm.test',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
      workspaceId: workspace.id
    }
  });
  console.log('✅ Admin user created');

  // Create default team
  const team = await prisma.team.create({
    data: {
      name: 'Sales Team',
      workspaceId: workspace.id
    }
  });
  console.log('✅ Team created');

  // Add admin to team
  await prisma.teamMember.create({
    data: {
      userId: admin.id,
      teamId: team.id,
      role: 'LEADER'
    }
  });
  console.log('✅ Admin added to team');

  console.log('\n🎉 Seeding complete!');
  console.log('\n🔐 Login credentials:');
  console.log('   Email:    admin@crm.test');
  console.log('   Password: ChangeMe-Dev-Only-123\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

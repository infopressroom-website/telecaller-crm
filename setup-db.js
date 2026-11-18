const { execSync } = require('child_process');

console.log('🔧 Setting up database...\n');

try {
  // Set environment variable
  process.env.DATABASE_URL = 'postgresql://authenticator:npg_LF1XpaWK5ADk@ep-little-shadow-azj0b69n.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  
  console.log('Step 1: Pushing schema to database...');
  execSync('npx prisma db push --skip-generate --accept-data-loss', { 
    stdio: 'inherit',
    timeout: 60000
  });
  
  console.log('\n✅ Schema pushed!\n');
  
  console.log('Step 2: Seeding database...');
  execSync('npm run db:seed', { 
    stdio: 'inherit',
    timeout: 30000
  });
  
  console.log('\n✅ Database ready!');
  console.log('\n🎉 Setup complete!');
  console.log('\n🔐 Login at: https://telecaller-crm-iota.vercel.app/login');
  console.log('   Email: admin@crm.test');
  console.log('   Password: ChangeMe-Dev-Only-123\n');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}

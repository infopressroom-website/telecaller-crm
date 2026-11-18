// Quick database connection test
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    console.log('🔍 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT current_database(), version();`;
    console.log('📊 Database info:', result);
    
    // Check if tables exist
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `;
    console.log(`📋 Found ${tables.length} tables in database`);
    
    return { success: true, tables: tables.length };
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}

testConnection()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

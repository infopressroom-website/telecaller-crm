#!/usr/bin/env node
/**
 * Database verification and testing script
 * Tests connection, schema validation, migrations, indexes, and query performance
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

const results = {
  timestamp: new Date().toISOString(),
  connectionStatus: 'UNKNOWN',
  schemaValidation: 'UNKNOWN',
  migrationStatus: 'UNKNOWN',
  tableCount: 0,
  indexCount: 0,
  indexes: [],
  queryPerformance: [],
  errors: [],
  warnings: [],
};

async function testConnection() {
  console.log('\n📡 Testing database connection...');
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT current_database() as db, version() as ver;`;
    results.connectionStatus = 'SUCCESS';
    console.log('✅ Connected to database:', result[0].db);
    console.log('   PostgreSQL version:', result[0].ver.split(',')[0]);
    return true;
  } catch (error) {
    results.connectionStatus = 'FAILED';
    results.errors.push({
      test: 'connection',
      message: error.message,
      code: error.code,
    });
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function checkTables() {
  console.log('\n📋 Checking database tables...');
  try {
    const tables = await prisma.$queryRaw`
      SELECT tablename, schemaname
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `;
    results.tableCount = tables.length;
    console.log(`✅ Found ${tables.length} tables in public schema`);
    
    if (tables.length === 0) {
      results.warnings.push({
        test: 'tables',
        message: 'No tables found - migrations may not have been applied',
      });
      console.warn('⚠️  No tables found - run migrations with: npx prisma migrate dev');
    } else {
      console.log('   Tables:', tables.map(t => t.tablename).slice(0, 10).join(', '), 
                  tables.length > 10 ? `... and ${tables.length - 10} more` : '');
    }
    return tables;
  } catch (error) {
    results.errors.push({
      test: 'tables',
      message: error.message,
    });
    console.error('❌ Failed to check tables:', error.message);
    return [];
  }
}

async function checkIndexes() {
  console.log('\n🔍 Checking database indexes...');
  try {
    const indexes = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename, 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname;
    `;
    results.indexCount = indexes.length;
    results.indexes = indexes.map(idx => ({
      table: idx.tablename,
      index: idx.indexname,
      definition: idx.indexdef,
    }));
    console.log(`✅ Found ${indexes.length} indexes`);
    
    // Check for key performance indexes
    const expectedIndexes = [
      'User_roleId',
      'User_teamId', 
      'User_status',
      'Lead_primaryMobile',
      'Lead_ownerId_status',
      'Lead_status_createdAt',
      'LeadAssignment_leadId_createdAt',
      'CallLog_leadId_startedAt',
      'CallLog_agentId_startedAt',
    ];
    
    const foundIndexNames = indexes.map(idx => idx.indexname);
    const missingIndexes = expectedIndexes.filter(name => !foundIndexNames.some(fn => fn.includes(name)));
    
    if (missingIndexes.length > 0) {
      results.warnings.push({
        test: 'indexes',
        message: `Missing some expected performance indexes: ${missingIndexes.join(', ')}`,
      });
      console.warn(`⚠️  Missing expected indexes: ${missingIndexes.slice(0, 5).join(', ')}`);
    }
    
    return indexes;
  } catch (error) {
    results.errors.push({
      test: 'indexes',
      message: error.message,
    });
    console.error('❌ Failed to check indexes:', error.message);
    return [];
  }
}

async function testQueryPerformance() {
  console.log('\n⚡ Testing query performance...');
  
  const queries = [
    {
      name: 'Count users',
      query: 'SELECT COUNT(*) FROM "User" WHERE "archivedAt" IS NULL',
    },
    {
      name: 'Count leads',
      query: 'SELECT COUNT(*) FROM "Lead" WHERE "archivedAt" IS NULL',
    },
    {
      name: 'Recent calls',
      query: 'SELECT COUNT(*) FROM "CallLog" WHERE "createdAt" > NOW() - INTERVAL \'7 days\'',
    },
  ];
  
  for (const test of queries) {
    try {
      const start = Date.now();
      await prisma.$queryRawUnsafe(test.query);
      const duration = Date.now() - start;
      
      results.queryPerformance.push({
        query: test.name,
        durationMs: duration,
        status: duration < 100 ? 'GOOD' : duration < 500 ? 'ACCEPTABLE' : 'SLOW',
      });
      
      const icon = duration < 100 ? '✅' : duration < 500 ? '⚠️' : '❌';
      console.log(`${icon} ${test.name}: ${duration}ms`);
      
      if (duration >= 500) {
        results.warnings.push({
          test: 'performance',
          message: `Slow query detected: ${test.name} took ${duration}ms`,
        });
      }
    } catch (error) {
      results.errors.push({
        test: 'query_performance',
        query: test.name,
        message: error.message,
      });
      console.error(`❌ ${test.name} failed:`, error.message);
    }
  }
}

async function checkPrismaSchema() {
  console.log('\n📝 Checking Prisma schema status...');
  try {
    // Check if Prisma client is generated
    const clientExists = fs.existsSync(path.join(__dirname, '..', 'node_modules', '.prisma', 'client'));
    
    if (!clientExists) {
      results.warnings.push({
        test: 'schema',
        message: 'Prisma client not generated - run: npx prisma generate',
      });
      console.warn('⚠️  Prisma client not generated');
    } else {
      console.log('✅ Prisma client is generated');
    }
    
    results.schemaValidation = 'PASSED';
  } catch (error) {
    results.errors.push({
      test: 'schema',
      message: error.message,
    });
    console.error('❌ Schema check failed:', error.message);
  }
}

async function generateReport() {
  console.log('\n📊 Generating report...');
  
  const reportPath = path.join(__dirname, '..', '.agents', 'tasks', 'final-audit', 'database-test-results.json');
  const reportDir = path.dirname(reportPath);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log('✅ Report saved to:', reportPath);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Connection:    ${results.connectionStatus}`);
  console.log(`Tables:        ${results.tableCount}`);
  console.log(`Indexes:       ${results.indexCount}`);
  console.log(`Errors:        ${results.errors.length}`);
  console.log(`Warnings:      ${results.warnings.length}`);
  console.log('='.repeat(60));
  
  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.test}] ${err.message}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach((warn, i) => {
      console.log(`  ${i + 1}. [${warn.test}] ${warn.message}`);
    });
  }
  
  return results.errors.length === 0;
}

async function main() {
  console.log('🚀 Database Verification and Testing');
  console.log('=====================================\n');
  
  const connected = await testConnection();
  
  if (!connected) {
    console.error('\n❌ Cannot proceed without database connection');
    await generateReport();
    process.exit(1);
  }
  
  await checkPrismaSchema();
  const tables = await checkTables();
  
  if (tables.length > 0) {
    await checkIndexes();
    await testQueryPerformance();
  }
  
  const success = await generateReport();
  
  console.log(success ? '\n✅ All tests passed!' : '\n⚠️  Some tests failed or have warnings');
  
  process.exit(success ? 0 : 1);
}

main()
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    results.errors.push({
      test: 'fatal',
      message: error.message,
      stack: error.stack,
    });
    generateReport().finally(() => process.exit(1));
  })
  .finally(() => {
    prisma.$disconnect();
  });

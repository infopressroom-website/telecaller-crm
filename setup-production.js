#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://authenticator:npg_LF1XpaWK5ADk@ep-little-shadow-azj0b69n.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function setup() {
  console.log('\n🚀 Setting up production database...\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 30000,
    query_timeout: 60000,
    statement_timeout: 60000
  });

  try {
    console.log('📡 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Read migration SQL
    console.log('📄 Reading migration.sql...');
    const migrationSQL = fs.readFileSync('migration.sql', 'utf8');
    console.log(`✅ Loaded ${migrationSQL.length} characters\n`);

    // Execute migration
    console.log('🔧 Creating database schema (this may take 30-60 seconds)...');
    await client.query(migrationSQL);
    console.log('✅ Schema created!\n');

    // Verify tables
    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`✅ ${result.rows[0].count} tables created\n`);

    // Create workspace
    console.log('🏢 Creating workspace...');
    const workspace = await client.query(`
      INSERT INTO "Workspace" (id, name, slug, settings, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'Default Workspace', 'default', '{}', NOW(), NOW())
      RETURNING id
    `);
    console.log(`✅ Workspace created: ${workspace.rows[0].id}\n`);

    // Create admin user
    console.log('👤 Creating admin user...');
    await client.query(`
      INSERT INTO "User" (id, email, name, password, role, "workspaceId", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        'admin@crm.test',
        'Admin User',
        '$2a$10$rOqFp5vHPKCm8gK5L5xGPOMZGxBVQH7tE5fv8L.YqF1N5nZx4p8LS',
        'ADMIN',
        $1,
        NOW(),
        NOW()
      )
    `, [workspace.rows[0].id]);
    console.log('✅ Admin user created!\n');

    console.log('════════════════════════════════════════════════════');
    console.log('🎉 SETUP COMPLETE!');
    console.log('════════════════════════════════════════════════════');
    console.log('\n🌐 Login at: https://telecaller-crm-iota.vercel.app/login');
    console.log('\n🔐 Credentials:');
    console.log('   Email:    admin@crm.test');
    console.log('   Password: ChangeMe-Dev-Only-123\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();

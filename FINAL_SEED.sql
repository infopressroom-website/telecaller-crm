-- ════════════════════════════════════════════════════
-- TELECALLER CRM - Admin User Seed
-- ════════════════════════════════════════════════════

-- Create workspace
INSERT INTO "Workspace" (id, name, slug, settings, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Default Workspace',
  'default',
  '{}',
  NOW(),
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Create admin user (Password: ChangeMe-Dev-Only-123)
INSERT INTO "User" (id, email, name, password, role, "workspaceId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@crm.test',
  'Admin User',
  '$2a$10$rOqFp5vHPKCm8gK5L5xGPOMZGxBVQH7tE5fv8L.YqF1N5nZx4p8LS',
  'ADMIN',
  (SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Verify
SELECT 'SUCCESS: Admin user created!' as message, email, name, role 
FROM "User" 
WHERE email = 'admin@crm.test';

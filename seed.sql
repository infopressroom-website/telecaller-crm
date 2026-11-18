-- Seed data for Telecaller CRM

-- Create workspace
INSERT INTO "Workspace" (id, name, slug, settings, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Default Workspace',
  'default',
  '{}',
  NOW(),
  NOW()
) RETURNING id;

-- Note the workspace ID from above and replace <workspace-id> below

-- Create admin user (password: ChangeMe-Dev-Only-123)
INSERT INTO "User" (id, email, name, password, role, "workspaceId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@crm.test',
  'Admin User',
  '.YqF1N5nZx4p8LS',
  'ADMIN',
  (SELECT id FROM "Workspace" WHERE slug = 'default'),
  NOW(),
  NOW()
);

-- Success message
SELECT 'Admin user created successfully!' as message;

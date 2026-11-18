-- ════════════════════════════════════════════════════
-- COMPLETE DATABASE RESET
-- ════════════════════════════════════════════════════

-- Step 1: Drop ALL existing tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;

-- Step 2: Now run the migration.sql content manually
-- (Copy migration.sql content and paste after this)

SELECT 'Schema reset complete! Now paste migration.sql content below this line.' as status;

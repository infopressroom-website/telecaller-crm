-- ════════════════════════════════════════════════════
-- SIMPLE SEED - Check what tables actually exist
-- ════════════════════════════════════════════════════

-- First, let's see what tables we have
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('User', 'Workspace', 'Team', 'Lead')
ORDER BY table_name;

-- If you see these tables listed, then we can seed
-- If NOT, the migration didn't work properly

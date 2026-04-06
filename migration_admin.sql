-- ============================================================
-- MIGRATION: Admin Panel + Landing Page
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Campos extras em profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS seller_status  TEXT DEFAULT 'pending'
    CHECK (seller_status IN ('pending','approved','rejected','suspended')),
  ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'active'
    CHECK (status IN ('active','suspended','banned','warning')),
  ADD COLUMN IF NOT EXISTS ban_reason     TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url     TEXT,
  ADD COLUMN IF NOT EXISTS bio            TEXT,
  ADD COLUMN IF NOT EXISTS username       TEXT UNIQUE;

-- 2. Vendedores existentes aprovados automaticamente
UPDATE profiles SET seller_status = 'approved' WHERE role = 'vendedor' AND seller_status IS NULL;
UPDATE profiles SET status = 'active' WHERE status IS NULL;

-- 3. Tabela de configurações do site (banner etc)
CREATE TABLE IF NOT EXISTS site_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insere banner padrão
INSERT INTO site_config (key, value)
VALUES ('banner', '{"active":false,"text":"","icon":"📢","color":"#1e40af","bg":"#EFF6FF","border":"#BFDBFE","link":"","linkText":"Ver mais"}')
ON CONFLICT (key) DO NOTHING;

-- 4. RLS para site_config — leitura pública, escrita só service_role
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_config" ON site_config
  FOR SELECT USING (TRUE);

CREATE POLICY "service_write_config" ON site_config
  FOR ALL TO service_role USING (TRUE);

-- 5. Índices úteis
CREATE INDEX IF NOT EXISTS idx_profiles_seller_status ON profiles(seller_status);
CREATE INDEX IF NOT EXISTS idx_profiles_status        ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role          ON profiles(role);

-- ============================================================
-- DONE ✅
-- ============================================================

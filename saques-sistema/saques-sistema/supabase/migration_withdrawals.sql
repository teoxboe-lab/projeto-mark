-- ============================================================
-- MIGRATION: Sistema de Saques com Stripe Connect
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Adiciona campos na tabela profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_done  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS balance_available        NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_pending          NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned             NUMERIC(10,2) DEFAULT 0;

-- 2. Cria tabela de saques
CREATE TABLE IF NOT EXISTS withdrawals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','paid','failed','cancelled')),
  stripe_payout_id TEXT,
  stripe_tf_id    TEXT,          -- transfer id do Stripe
  failure_reason  TEXT,
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Cria tabela de transações da carteira (ledger)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('sale','withdrawal','refund','fee','adjustment')),
  amount          NUMERIC(10,2) NOT NULL,   -- positivo = crédito, negativo = débito
  balance_after   NUMERIC(10,2) NOT NULL,
  description     TEXT,
  reference_id    UUID,                     -- purchase_id ou withdrawal_id
  reference_type  TEXT,                     -- 'purchase' | 'withdrawal'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_withdrawals_seller_id  ON withdrawals(seller_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status     ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_seller_id    ON wallet_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_at   ON wallet_transactions(created_at DESC);

-- 5. Trigger: atualiza updated_at em withdrawals
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS withdrawals_updated_at ON withdrawals;
CREATE TRIGGER withdrawals_updated_at
  BEFORE UPDATE ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Função: credita saldo do vendedor quando uma compra é completada
--    Chame esta função manualmente OU via trigger em purchases
CREATE OR REPLACE FUNCTION credit_seller_on_sale(
  p_purchase_id   UUID,
  p_seller_id     UUID,
  p_gross_amount  NUMERIC,       -- valor bruto pago pelo comprador
  p_platform_fee  NUMERIC DEFAULT 0.10  -- 10% de taxa da plataforma
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_net       NUMERIC;
  v_balance   NUMERIC;
BEGIN
  v_net := ROUND(p_gross_amount * (1 - p_platform_fee), 2);

  -- Atualiza saldo do vendedor
  UPDATE profiles
     SET balance_available = balance_available + v_net,
         balance_pending   = GREATEST(balance_pending - v_net, 0),
         total_earned      = total_earned + v_net
   WHERE id = p_seller_id
   RETURNING balance_available INTO v_balance;

  -- Registra no ledger
  INSERT INTO wallet_transactions(seller_id, type, amount, balance_after, description, reference_id, reference_type)
  VALUES (p_seller_id, 'sale', v_net, v_balance,
          FORMAT('Venda · taxa %.0f%%', p_platform_fee * 100),
          p_purchase_id, 'purchase');
END;
$$;

-- 7. Função: debita saldo quando saque é solicitado
CREATE OR REPLACE FUNCTION request_withdrawal(
  p_seller_id UUID,
  p_amount    NUMERIC
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_avail     NUMERIC;
  v_wid       UUID;
  v_balance   NUMERIC;
BEGIN
  SELECT balance_available INTO v_avail FROM profiles WHERE id = p_seller_id FOR UPDATE;

  IF v_avail IS NULL THEN RAISE EXCEPTION 'Vendedor não encontrado'; END IF;
  IF p_amount > v_avail THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  IF p_amount < 10 THEN RAISE EXCEPTION 'Valor mínimo de saque é R$ 10,00'; END IF;

  -- Debita saldo
  UPDATE profiles
     SET balance_available = balance_available - p_amount
   WHERE id = p_seller_id
   RETURNING balance_available INTO v_balance;

  -- Cria registro de saque
  INSERT INTO withdrawals(seller_id, amount, status)
  VALUES (p_seller_id, p_amount, 'pending')
  RETURNING id INTO v_wid;

  -- Registra no ledger
  INSERT INTO wallet_transactions(seller_id, type, amount, balance_after, description, reference_id, reference_type)
  VALUES (p_seller_id, 'withdrawal', -p_amount, v_balance,
          'Saque solicitado', v_wid, 'withdrawal');

  RETURN v_wid;
END;
$$;

-- 8. RLS Policies
ALTER TABLE withdrawals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Vendedor vê apenas seus próprios saques
CREATE POLICY "seller_own_withdrawals" ON withdrawals
  FOR ALL USING (auth.uid() = seller_id);

-- Vendedor vê apenas suas transações
CREATE POLICY "seller_own_wallet_tx" ON wallet_transactions
  FOR ALL USING (auth.uid() = seller_id);

-- Service role (API) pode tudo
CREATE POLICY "service_role_withdrawals" ON withdrawals
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "service_role_wallet_tx" ON wallet_transactions
  FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- DONE ✅ Execute e confirme sem erros antes de prosseguir
-- ============================================================

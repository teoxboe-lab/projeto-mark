-- ══════════════════════════════════════
-- GGMAX MARKET — Migration 002
-- Adiciona suporte a Stripe e melhorias
-- Execute após a migration 001
-- ══════════════════════════════════════

-- Adiciona coluna stripe_session_id em purchases
alter table public.purchases
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text;

-- Indice para busca por session
create index if not exists purchases_stripe_session_idx
  on public.purchases(stripe_session_id);

-- Funcao auxiliar para incrementar sales_count de forma atomica
-- (usada opcionalmente, o webhook faz isso diretamente)
create or replace function public.increment_sales(listing_id uuid)
returns void as $$
  update public.listings
  set sales_count = coalesce(sales_count, 0) + 1
  where id = listing_id;
$$ language sql security definer;

-- View publica de anuncios com dados do vendedor (facilita queries)
create or replace view public.listings_with_seller as
  select
    l.*,
    p.nome    as seller_nome,
    p.role    as seller_role,
    p.created_at as seller_since
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.status = 'live';

-- Permissao de leitura na view
grant select on public.listings_with_seller to anon, authenticated;

-- Adiciona NEXT_PUBLIC_SITE_URL como config (lembre de colocar na Vercel)
-- Esta migration nao faz nada com isso, e apenas documentacao:
-- NEXT_PUBLIC_SITE_URL = https://seu-dominio.vercel.app

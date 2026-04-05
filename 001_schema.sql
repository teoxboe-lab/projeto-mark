-- ══════════════════════════════════════
-- GGMAX MARKET — Schema de produção
-- Execute no SQL Editor do Supabase
-- ══════════════════════════════════════

-- Habilita extensão de UUID
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────
-- TABELA: profiles
-- Criada automaticamente no signup via trigger
-- ──────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  nome         text not null default '',
  role         text not null default 'comprador' check (role in ('comprador','vendedor')),
  avatar_url   text,
  created_at   timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
create policy "Perfil público para leitura" on public.profiles for select using (true);
create policy "Usuário edita o próprio perfil" on public.profiles for update using (auth.uid() = id);

-- Trigger: cria profile ao cadastrar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nome, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'comprador')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────
-- TABELA: listings (anúncios)
-- ──────────────────────────────────────
create table if not exists public.listings (
  id             uuid primary key default uuid_generate_v4(),
  seller_id      uuid not null references public.profiles(id) on delete cascade,
  title          text not null,
  description    text not null default '',
  price          numeric(10,2) not null default 0,
  price_old      numeric(10,2),
  category       text not null default 'outros',
  niche          text not null default 'outros',
  emoji          text not null default '📦',
  tags           text[] default '{}',
  media_url      text,
  thumbnail_url  text,
  html_url       text,
  status         text not null default 'live' check (status in ('draft','live','paused','sold')),
  rating         numeric(3,2) default 5.0,
  reviews_count  int default 0,
  sales_count    int default 0,
  created_at     timestamptz default now()
);

-- Índices para performance
create index if not exists listings_seller_id_idx on public.listings(seller_id);
create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_niche_idx on public.listings(niche);
create index if not exists listings_created_at_idx on public.listings(created_at desc);

-- RLS
alter table public.listings enable row level security;
create policy "Anúncios live visíveis para todos" on public.listings
  for select using (status = 'live');
create policy "Vendedor vê todos os próprios" on public.listings
  for select using (auth.uid() = seller_id);
create policy "Vendedor cria anúncios" on public.listings
  for insert with check (auth.uid() = seller_id);
create policy "Vendedor edita próprios" on public.listings
  for update using (auth.uid() = seller_id);
create policy "Vendedor deleta próprios" on public.listings
  for delete using (auth.uid() = seller_id);

-- ──────────────────────────────────────
-- TABELA: purchases (compras)
-- ──────────────────────────────────────
create table if not exists public.purchases (
  id          uuid primary key default uuid_generate_v4(),
  buyer_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id  uuid not null references public.listings(id) on delete cascade,
  amount      numeric(10,2) not null,
  status      text not null default 'completed' check (status in ('pending','completed','refunded')),
  created_at  timestamptz default now()
);

create index if not exists purchases_buyer_id_idx on public.purchases(buyer_id);
create index if not exists purchases_listing_id_idx on public.purchases(listing_id);

alter table public.purchases enable row level security;
create policy "Comprador vê as próprias compras" on public.purchases
  for select using (auth.uid() = buyer_id);
create policy "Vendedor vê vendas dos próprios anúncios" on public.purchases
  for select using (
    exists (
      select 1 from public.listings
      where listings.id = purchases.listing_id
      and listings.seller_id = auth.uid()
    )
  );
create policy "Usuário autenticado pode comprar" on public.purchases
  for insert with check (auth.uid() = buyer_id);

-- ──────────────────────────────────────
-- STORAGE: bucket para mídias dos anúncios
-- Execute separadamente no dashboard se necessário
-- ──────────────────────────────────────
-- insert into storage.buckets (id, name, public) values ('listings-media', 'listings-media', true);
-- create policy "Mídias públicas para leitura" on storage.objects for select using (bucket_id = 'listings-media');
-- create policy "Vendedor autentic. faz upload" on storage.objects for insert with check (bucket_id = 'listings-media' and auth.role() = 'authenticated');

-- ──────────────────────────────────────
-- DADOS SEED — produtos iniciais de exemplo
-- ──────────────────────────────────────
-- (Adicione manualmente via painel ou via script seed após criar conta admin)

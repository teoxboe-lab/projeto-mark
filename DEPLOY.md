# 🚀 GGMAX Market — Guia Completo de Deploy em Produção
## Supabase + Vercel — Passo a Passo

---

## ✅ ETAPA 1 — Criar projeto no Supabase

1. Acesse **https://supabase.com** → **New Project**
2. Dê um nome: `ggmax-market`
3. Defina uma senha forte para o banco
4. Região: **South America (São Paulo)** ← mais rápido para usuários BR
5. Clique em **Create new project** e aguarde ~2 min

---

## ✅ ETAPA 2 — Configurar banco de dados

1. No painel Supabase → **SQL Editor** → **New Query**
2. Cole **todo** o conteúdo do arquivo:
   ```
   supabase/migrations/001_schema.sql
   ```
3. Clique em **Run** ✓

---

## ✅ ETAPA 3 — Criar bucket de Storage

1. No painel Supabase → **Storage** → **New Bucket**
2. Nome: `listings-media`
3. Marque: ✅ **Public bucket**
4. Clique em **Save**

5. Vá em **Storage** → **Policies** → adicione as políticas abaixo:

### Política: Leitura pública
```sql
CREATE POLICY "Mídias públicas para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'listings-media');
```

### Política: Upload para autenticados
```sql
CREATE POLICY "Vendedor autenticado faz upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'listings-media'
  AND auth.role() = 'authenticated'
);
```

### Política: Deleção pelo dono
```sql
CREATE POLICY "Vendedor deleta próprias mídias"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'listings-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## ✅ ETAPA 4 — Criar usuários demo (opcional)

No SQL Editor, execute:

```sql
-- Cria conta demo de comprador
SELECT auth.create_user(
  '{"email": "comprador@demo.com", "password": "demo123",
    "email_confirm": true,
    "user_metadata": {"nome": "Comprador Demo", "role": "comprador"}}'::jsonb
);

-- Cria conta demo de vendedor
SELECT auth.create_user(
  '{"email": "vendedor@demo.com", "password": "demo123",
    "email_confirm": true,
    "user_metadata": {"nome": "Vendedor Demo", "role": "vendedor"}}'::jsonb
);
```

---

## ✅ ETAPA 5 — Copiar chaves do Supabase

No painel Supabase → **Settings** → **API**:

Copie:
- `Project URL` → ex: `https://abcxyz123.supabase.co`
- `anon` / `public` key
- `service_role` key ← **⚠️ nunca exponha no frontend!**

---

## ✅ ETAPA 6 — Configurar Autenticação no Supabase

No painel → **Authentication** → **URL Configuration**:

- **Site URL**: `https://seu-projeto.vercel.app`
- **Redirect URLs** (adicione todos):
  ```
  https://seu-projeto.vercel.app/api/auth/callback
  http://localhost:3000/api/auth/callback
  ```

---

## ✅ ETAPA 7 — Deploy na Vercel

### Opção A — Via GitHub (recomendado)

1. Suba o projeto para o GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: GGMAX Market inicial"
   git remote add origin https://github.com/SEU_USER/ggmax-market.git
   git push -u origin main
   ```

2. Acesse **https://vercel.com** → **Add New Project**
3. Importe o repositório do GitHub
4. Framework: **Next.js** (detectado automaticamente)
5. Clique em **Environment Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://SEU_ID.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sua_anon_key` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sua_service_role_key` |

6. Clique em **Deploy** ✓

### Opção B — Via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

---

## ✅ ETAPA 8 — Variáveis de ambiente (.env.local para dev local)

Copie o arquivo `.env.local.example` para `.env.local` e preencha:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

---

## ✅ ETAPA 9 — Testar localmente

```bash
npm install
npm run dev
```

Acesse: `http://localhost:3000`

---

## ✅ ETAPA 10 — Rotas da aplicação

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/` | Redireciona para vitrine | Público |
| `/auth` | Login e cadastro | Público |
| `/vitrine` | Marketplace principal | Público |
| `/upload` | Painel do vendedor | 🔒 Vendedor |
| `/dashboard` | Biblioteca e compras | 🔒 Autenticado |
| `/api/auth/callback` | Callback OAuth | Sistema |
| `/api/listings` | CRUD anúncios | API |
| `/api/purchases` | Registrar compras | API |

---

## 🏗️ Estrutura do projeto

```
ggmax/
├── app/
│   ├── api/
│   │   ├── auth/callback/route.ts   ← Confirmação de e-mail
│   │   ├── listings/route.ts        ← API de anúncios
│   │   └── purchases/route.ts       ← API de compras
│   ├── auth/page.tsx                ← Login/Cadastro
│   ├── dashboard/page.tsx           ← Biblioteca do usuário
│   ├── upload/page.tsx              ← 🌟 PAINEL DO VENDEDOR
│   ├── vitrine/page.tsx             ← 🌟 VITRINE PÚBLICA
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                     ← Redirect → /vitrine
├── components/
│   ├── CheckoutModal.tsx            ← Modal de compra
│   ├── Header.tsx                   ← Navegação global
│   ├── ProductCard.tsx              ← Card do produto
│   └── ToastRoot.tsx                ← Notificações
├── lib/
│   ├── supabase/
│   │   ├── client.ts                ← Browser client
│   │   ├── server.ts                ← Server client
│   │   └── middleware.ts            ← Auth session
│   └── types.ts                     ← TypeScript types
├── supabase/
│   └── migrations/001_schema.sql   ← 🌟 SCHEMA COMPLETO
├── middleware.ts                    ← Proteção de rotas
├── .env.local.example
└── DEPLOY.md
```

---

## ⚡ Fluxo completo: Vendedor → Vitrine

```
1. Vendedor faz cadastro (role: vendedor)
   ↓
2. Redirecionado para /upload
   ↓
3. Preenche formulário + faz upload de mídia
   ↓
4. Clica "Publicar na Vitrine"
   ↓
5. Arquivo vai para Supabase Storage
   ↓
6. Registro criado em public.listings (status: live)
   ↓
7. Vitrine em /vitrine mostra o produto via Realtime
   ↓
8. Comprador clica "Comprar"
   ↓
9. Checkout → registro em public.purchases
   ↓
10. Produto aparece na /dashboard do comprador
```

---

## 🔒 Segurança (RLS configurado)

- Anúncios `live` são visíveis para todos
- Vendedor só edita/deleta os próprios anúncios
- Comprador só vê as próprias compras
- Service Role Key nunca exposta ao frontend
- Middleware protege `/upload` e `/dashboard`

---

## 🌐 Após o deploy

Sua URL será algo como:
`https://ggmax-market.vercel.app`

Configure ela no Supabase → Authentication → URL Configuration.

---

## ✅ ETAPA 11 — Configurar Stripe (Pagamentos)

### 11.1 Criar conta e obter chaves

1. Acesse **https://dashboard.stripe.com**
2. Vá em **Developers** → **API Keys**
3. Copie:
   - `Secret key` → `STRIPE_SECRET_KEY`
   - Para testes use `sk_test_...`, para produção `sk_live_...`

### 11.2 Configurar Webhook

1. No Stripe → **Developers** → **Webhooks** → **Add endpoint**
2. URL: `https://seu-projeto.vercel.app/api/stripe/webhook`
3. Eventos a escutar:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Clique em **Add endpoint**
5. Copie o **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 11.3 Adicionar variáveis na Vercel

| Variável | Valor |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `NEXT_PUBLIC_SITE_URL` | `https://seu-projeto.vercel.app` |

### 11.4 Testar localmente com Stripe CLI

```bash
# Instala Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Escuta webhooks locais
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Simula pagamento em outro terminal
stripe trigger checkout.session.completed
```

### Fluxo de pagamento

```
Comprador clica "COMPRAR"
        ↓
POST /api/stripe/checkout
        ↓
Stripe cria sessao de checkout
        ↓
Comprador preenche cartao no Stripe
        ↓
Stripe envia webhook checkout.session.completed
        ↓
POST /api/stripe/webhook registra purchase no Supabase
        ↓
Comprador e redirecionado para /pagamento/sucesso
        ↓
Produto aparece em /dashboard
```

---

**Pronto! 🎉 GGMAX Market com Stripe rodando em producao.**

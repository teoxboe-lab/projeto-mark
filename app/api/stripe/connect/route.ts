// app/api/stripe/connect/route.ts
// Stripe Connect: onboarding de vendedores

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/stripe/connect — cria conta Express e retorna link de onboarding
export async function POST(req: NextRequest) {
  try {
    const { userId, email, nome } = await req.json()

    // Busca se já tem conta Stripe
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_done')
      .eq('id', userId)
      .single()

    let accountId = profile?.stripe_account_id

    // Cria conta Express se não existir
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        email,
        capabilities: { transfers: { requested: true } },
        business_type: 'individual',
        metadata: { supabase_user_id: userId },
      })
      accountId = account.id

      await supabase
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', userId)
    }

    // Gera link de onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?stripe=refresh`,
      return_url:  `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?stripe=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: any) {
    console.error('[stripe/connect]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/stripe/connect?userId=xxx — verifica status da conta
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_done')
      .eq('id', userId)
      .single()

    if (!profile?.stripe_account_id) {
      return NextResponse.json({ connected: false, onboarding_done: false })
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id)
    const done = account.details_submitted && account.charges_enabled

    if (done && !profile.stripe_onboarding_done) {
      await supabase
        .from('profiles')
        .update({ stripe_onboarding_done: true })
        .eq('id', userId)
    }

    return NextResponse.json({
      connected: true,
      onboarding_done: done,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      account_id: profile.stripe_account_id,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
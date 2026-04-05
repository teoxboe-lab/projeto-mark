// app/api/withdrawals/route.ts
// Processa solicitações de saque e executa via Stripe Transfer

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/withdrawals — solicita saque
export async function POST(req: NextRequest) {
  try {
    const { userId, amount } = await req.json()

    if (!userId || !amount) {
      return NextResponse.json({ error: 'userId e amount são obrigatórios' }, { status: 400 })
    }

    const amountNum = Number(amount)
    if (isNaN(amountNum) || amountNum < 10) {
      return NextResponse.json({ error: 'Valor mínimo de saque é R$ 10,00' }, { status: 400 })
    }

    // Busca dados do vendedor
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_done, balance_available')
      .eq('id', userId)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    if (!profile.stripe_account_id || !profile.stripe_onboarding_done) {
      return NextResponse.json({
        error: 'Conta Stripe não configurada. Complete o cadastro primeiro.',
        code: 'STRIPE_NOT_CONNECTED'
      }, { status: 400 })
    }

    if (profile.balance_available < amountNum) {
      return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })
    }

    // Debita saldo e cria withdrawal no banco via RPC
    const { data: withdrawalId, error: rpcErr } = await supabase
      .rpc('request_withdrawal', { p_seller_id: userId, p_amount: amountNum })

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 })
    }

    // Executa Transfer no Stripe (BRL em centavos)
    const amountCents = Math.round(amountNum * 100)

    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: 'brl',
      destination: profile.stripe_account_id,
      metadata: {
        withdrawal_id: withdrawalId,
        supabase_user_id: userId,
      },
    })

    // Atualiza withdrawal com stripe transfer id
    await supabase
      .from('withdrawals')
      .update({
        status: 'processing',
        stripe_tf_id: transfer.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId)

    return NextResponse.json({
      success: true,
      withdrawal_id: withdrawalId,
      transfer_id: transfer.id,
      amount: amountNum,
    })

  } catch (err: any) {
    console.error('[withdrawals POST]', err)

    // Se falhou no Stripe, reverter o saldo no banco
    // (em produção: usar fila/job para garantir idempotência)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/withdrawals?userId=xxx — lista saques do vendedor
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ withdrawals: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

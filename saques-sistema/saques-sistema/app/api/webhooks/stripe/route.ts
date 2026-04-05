// app/api/webhooks/stripe/route.ts
// Processa eventos do Stripe: payout.paid, transfer.failed, account.updated

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[webhook] Signature invalid:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      // Transfer chegou na conta do vendedor
      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer
        const wid = transfer.metadata?.withdrawal_id
        if (wid) {
          await supabase.from('withdrawals')
            .update({ status: 'processing', stripe_tf_id: transfer.id })
            .eq('id', wid)
        }
        break
      }

      // Payout pago com sucesso
      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout
        // Busca withdrawal pelo stripe_payout_id ou pelo transfer
        await supabase.from('withdrawals')
          .update({ status: 'paid', stripe_payout_id: payout.id, paid_at: new Date().toISOString() })
          .eq('stripe_payout_id', payout.id)
        break
      }

      // Payout falhou — estorna saldo
      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout
        const { data: withdrawal } = await supabase
          .from('withdrawals')
          .select('seller_id, amount')
          .eq('stripe_payout_id', payout.id)
          .single()

        if (withdrawal) {
          // Estorna o saldo
          await supabase.rpc('sql', {
            query: `
              UPDATE profiles
                SET balance_available = balance_available + ${withdrawal.amount}
              WHERE id = '${withdrawal.seller_id}';
            `
          })

          await supabase.from('withdrawals')
            .update({
              status: 'failed',
              failure_reason: payout.failure_message || 'Falha no payout',
            })
            .eq('stripe_payout_id', payout.id)
        }
        break
      }

      // Onboarding do vendedor completado
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        if (account.details_submitted && account.charges_enabled) {
          await supabase.from('profiles')
            .update({ stripe_onboarding_done: true })
            .eq('stripe_account_id', account.id)
        }
        break
      }

      default:
        // Ignora eventos não tratados
        break
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[webhook] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

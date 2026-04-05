import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
})

// Webhook usa service role para contornar RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET nao configurado')
    return NextResponse.json({ error: 'Webhook nao configurado' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('[Webhook] Assinatura invalida:', err.message)
    return NextResponse.json({ error: 'Assinatura invalida' }, { status: 400 })
  }

  // ─── Processa eventos relevantes ───
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      // Extrai metadados
      const buyer_id = session.metadata?.buyer_id
      const listing_id = session.metadata?.listing_id
      const amount = (session.amount_total || 0) / 100 // reais

      if (!buyer_id || !listing_id) {
        console.error('[Webhook] Metadados ausentes', session.id)
        break
      }

      // Verifica se compra ja existe (idempotencia)
      const { data: existing } = await supabaseAdmin
        .from('purchases')
        .select('id')
        .eq('buyer_id', buyer_id)
        .eq('listing_id', listing_id)
        .eq('status', 'completed')
        .single()

      if (existing) {
        console.log('[Webhook] Compra ja registrada:', existing.id)
        break
      }

      // Registra a compra
      const { error: purchaseErr } = await supabaseAdmin
        .from('purchases')
        .insert({
          buyer_id,
          listing_id,
          amount,
          status: 'completed',
          stripe_session_id: session.id,
        })

      if (purchaseErr) {
        console.error('[Webhook] Erro ao registrar compra:', purchaseErr)
        return NextResponse.json({ error: 'Erro ao registrar compra' }, { status: 500 })
      }

      // Incrementa contador de vendas
      const { data: listing } = await supabaseAdmin
        .from('listings')
        .select('sales_count')
        .eq('id', listing_id)
        .single()

      if (listing) {
        await supabaseAdmin
          .from('listings')
          .update({ sales_count: (listing.sales_count || 0) + 1 })
          .eq('id', listing_id)
      }

      console.log(`[Webhook] Compra registrada: buyer=${buyer_id} listing=${listing_id} valor=R$${amount}`)
      break
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent
      console.log('[Webhook] Pagamento falhou:', intent.id)
      break
    }

    case 'charge.refunded': {
      // Marca compra como reembolsada se necessario
      const charge = event.data.object as Stripe.Charge
      const sessionId = charge.metadata?.session_id
      if (sessionId) {
        await supabaseAdmin
          .from('purchases')
          .update({ status: 'refunded' })
          .eq('stripe_session_id', sessionId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

// Necessario para receber o body raw do Stripe
export const runtime = 'nodejs'

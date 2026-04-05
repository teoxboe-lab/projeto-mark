import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Inicializa Stripe - a chave vem da env STRIPE_SECRET_KEY
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
})

export async function POST(request: NextRequest) {
  // 1. Verifica autenticação
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  // 2. Valida chave Stripe configurada
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Pagamento nao configurado. Adicione STRIPE_SECRET_KEY.' }, { status: 500 })
  }

  try {
    const { listing_id } = await request.json()
    if (!listing_id) {
      return NextResponse.json({ error: 'listing_id obrigatorio' }, { status: 400 })
    }

    // 3. Busca o anuncio
    const { data: listing, error: listingErr } = await supabase
      .from('listings')
      .select('*, profiles(nome, email)')
      .eq('id', listing_id)
      .eq('status', 'live')
      .single()

    if (listingErr || !listing) {
      return NextResponse.json({ error: 'Anuncio nao encontrado' }, { status: 404 })
    }

    // 4. Nao pode comprar o proprio anuncio
    if (listing.seller_id === user.id) {
      return NextResponse.json({ error: 'Voce nao pode comprar seu proprio anuncio' }, { status: 400 })
    }

    // 5. Verifica se ja comprou
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('listing_id', listing_id)
      .eq('status', 'completed')
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Voce ja possui este produto' }, { status: 400 })
    }

    // 6. Monta a URL base
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // 7. Cria sessao de checkout no Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: listing.title,
              description: listing.description?.slice(0, 500) || '',
              images: listing.thumbnail_url ? [listing.thumbnail_url] : [],
              metadata: {
                listing_id: listing.id,
                niche: listing.niche,
              },
            },
            unit_amount: Math.round(Number(listing.price) * 100), // centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}&listing_id=${listing_id}`,
      cancel_url: `${origin}/anuncio/${listing_id}?cancelado=1`,
      customer_email: user.email,
      metadata: {
        buyer_id: user.id,
        listing_id: listing.id,
        seller_id: listing.seller_id,
      },
      // Suporte a Pix (Brasil)
      payment_method_options: {
        card: {
          installments: { enabled: true },
        },
      },
    })

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (err: any) {
    console.error('[Stripe Checkout Error]', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

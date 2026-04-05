import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listing_id } = await request.json()

  // Busca o produto
  const { data: listing, error: listingErr } = await supabase
    .from('listings').select('*').eq('id', listing_id).eq('status', 'live').single()
  if (listingErr || !listing) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  // Cria compra
  const { data, error } = await supabase.from('purchases').insert({
    buyer_id: user.id,
    listing_id,
    amount: listing.price,
    status: 'completed',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Incrementa sales_count
  await supabase.from('listings')
    .update({ sales_count: (listing.sales_count || 0) + 1 })
    .eq('id', listing_id)

  return NextResponse.json(data, { status: 201 })
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const niche  = searchParams.get('niche')
  const search = searchParams.get('q')
  const limit  = parseInt(searchParams.get('limit') || '60')

  let query = supabase
    .from('listings')
    .select('*, profiles(id, nome, role)')
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (niche)  query = query.eq('niche', niche)
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase.from('listings').insert({ ...body, seller_id: user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export type Profile = {
  id: string
  email: string
  nome: string
  role: 'comprador' | 'vendedor'
  avatar_url: string | null
  created_at: string
}

export type Listing = {
  id: string
  seller_id: string
  title: string
  description: string
  price: number
  price_old: number | null
  category: string
  niche: string
  emoji: string
  tags: string[]
  media_url: string | null
  thumbnail_url: string | null
  html_url: string | null
  status: 'draft' | 'live' | 'paused' | 'sold'
  rating: number
  reviews_count: number
  sales_count: number
  created_at: string
  profiles?: Profile
}

export type Purchase = {
  id: string
  buyer_id: string
  listing_id: string
  amount: number
  status: 'pending' | 'completed' | 'refunded'
  created_at: string
  listings?: Listing
}

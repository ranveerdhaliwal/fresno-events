export interface SupabaseEventRow {
  id: string;
  slug: string;
  source: string;
  source_event_id: string | null;
  source_refs: unknown;
  title: string;
  description_html: string | null;
  description_text: string | null;
  posted_at: string | null;
  last_verified_at: string | null;
  source_sync_id: string | null;
  venue_id: string;
  start_ts: string;
  end_ts: string | null;
  timezone: string | null;
  doors_ts: string | null;
  category: string | null;
  subcategories: string[] | null;
  tags: string[] | null;
  price_min: number | string | null;
  price_max: number | string | null;
  currency: string | null;
  is_free: boolean | null;
  ticket_url: string | null;
  age_restriction: string | null;
  status: string | null;
  hero_image_id: string | null;
  gallery_image_ids: string[] | null;
  primary_artist_id: string | null;
  all_artist_ids: string[] | null;
  external_url: string | null;
  dedupe_hash: string | null;
  confidence_score: number | null;
  last_seen_at: string | null;
  priority: number | null;
  series_id: string | null;
  series_name: string | null;
  lineup: unknown;
  map_pin_emoji: string | null;
  created_at: string;
  updated_at: string;
  venue: SupabaseVenueRow | null;
  hero_image: SupabaseImageRow | null;
}

export interface SupabaseVenueRow {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  city: string;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  website: string | null;
  phone: string | null;
  socials: unknown;
  hero_image_id: string | null;
  description: string | null;
  primary_category: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseImageRow {
  id: string;
  storage_key: string;
  cdn_url: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  dominant_color: string | null;
  alt_text: string | null;
  source_url: string | null;
  license: string | null;
  created_at: string;
}

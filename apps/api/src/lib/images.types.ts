export interface RegisteredImage {
  id: string;
  storage_key: string;
  cdn_url: string;
}

export interface ImageInsert {
  storage_key: string;
  cdn_url: string;
  source_url: string;
  alt_text: string | null;
}

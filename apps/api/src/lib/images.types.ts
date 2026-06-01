export interface MirroredImage {
  id: string;
  storage_key: string;
  cdn_url: string;
}

export interface DownloadedImage {
  bytes: Uint8Array;
  contentType: string;
}

export interface ImageInsert {
  storage_key: string;
  cdn_url: string;
  source_url: string;
  alt_text: string | null;
}

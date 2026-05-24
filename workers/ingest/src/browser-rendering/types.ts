export interface BrCrawlRequestBody {
  url: string;
  limit: number;
  depth: number;
  render: boolean;
  formats: string[];
  rejectResourceTypes: string[];
  crawlPurposes: string[];
  options: {
    includeExternalLinks: boolean;
    includeSubdomains: boolean;
  };
  modifiedSince?: number;
}

export interface BrCrawlRecord {
  url: string;
  status: string;
  markdown?: string;
}

export interface BrCrawlJob {
  status: string;
  records?: BrCrawlRecord[];
  cursor?: string;
}

export interface BrApiEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ message: string }>;
  result_info?: { cursor?: string };
}

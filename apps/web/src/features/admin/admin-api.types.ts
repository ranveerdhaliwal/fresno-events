import type { EventCandidate, NormalizedEvent } from "@fresno-events/shared";

export type CandidateStatusFilter = EventCandidate["status"];

export type ReviewQueueTab = "new" | "updates" | "approved" | "rejected";

export interface ApproveBody {
  event?: Partial<NormalizedEvent>;
  notes?: string;
  reviewedBy?: string;
  priority?: number;
}

export interface RejectBody {
  notes?: string;
  reviewedBy?: string;
}

export interface BulkApproveBody {
  ids?: string[];
  notes?: string;
  reviewedBy?: string;
  priority?: number;
  status?: "pending_review";
  limit?: number;
}

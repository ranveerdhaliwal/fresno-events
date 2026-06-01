import type { EventCandidate, LinkedEventCandidate, SeriesSiblingCandidate } from "@fresno-events/shared";

import type { ReviewQueueTab } from "../admin/admin-api";

import styles from "./AdminReviewWorkspace.module.css";

export const btnClickable = "cursor-pointer disabled:cursor-not-allowed";

export const inputClass = styles.input;

export const PRIMARY_TABS: Array<{ id: ReviewQueueTab; label: string }> = [
  { id: "new", label: "New" },
  { id: "updates", label: "Updates" }
];

export const SECONDARY_TABS: Array<{ id: ReviewQueueTab; label: string }> = [
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" }
];

export const TAB_COPY: Record<ReviewQueueTab, { title: string; subtitle: string }> = {
  new: {
    title: "Review queue",
    subtitle: "New events from ingest. Approve to publish on the calendar."
  },
  updates: {
    title: "Updates",
    subtitle: "Source changed since last approval. Live site is unchanged until you approve."
  },
  approved: {
    title: "Approved",
    subtitle: "Candidates already linked to published events."
  },
  rejected: {
    title: "Rejected",
    subtitle: "Rejected by admin or AI enrichment."
  }
};

export const AUTH_FAILURE_MESSAGE = "That token was rejected. Check ADMIN_REVIEW_TOKEN and try again.";

export type ReviewWorkspaceProps = {
  token: string;
  activeTab: ReviewQueueTab;
  onActiveTabChange: (value: ReviewQueueTab) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeToken: () => void;
  onAuthFailure: () => void;
};

export type CandidateDetailProps = {
  token: string;
  candidate: EventCandidate;
  linkedCandidates: LinkedEventCandidate[];
  seriesSiblings?: SeriesSiblingCandidate[];
  displayPriority: number;
  onPriorityChange: (candidateId: string, priority: number) => void;
  onAfterDecision: (candidateId?: string) => void;
};

export type TokenGateProps = {
  authError: string | null;
  onAuthenticate: (token: string) => void;
};

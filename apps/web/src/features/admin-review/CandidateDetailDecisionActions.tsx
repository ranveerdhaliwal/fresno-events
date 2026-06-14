import { CheckCircle2, Loader2, X } from "lucide-react";

import { Button } from "@/components/Button/Button";

import styles from "./AdminReviewWorkspace.module.css";

export interface CandidateDetailDecisionActionsProps {
  isBusy: boolean;
  hasEdits: boolean;
  onReject: () => void;
  onApprove: () => void;
  approveLabel?: string;
  approveWithEditsLabel?: string;
  hideReject?: boolean;
  approveDisabled?: boolean;
}

export function CandidateDetailDecisionActions({
  isBusy,
  hasEdits,
  onReject,
  onApprove,
  approveLabel = "Approve",
  approveWithEditsLabel = "Approve with edits",
  hideReject = false,
  approveDisabled = false
}: CandidateDetailDecisionActionsProps) {
  const approveText = hasEdits ? approveWithEditsLabel : approveLabel;

  return (
    <>
      {hideReject ? null : (
        <Button variant="reject" disabled={isBusy} onClick={onReject}>
          <X className="size-4" aria-hidden />
          Reject
        </Button>
      )}
      <Button variant="approve" disabled={isBusy || approveDisabled} onClick={onApprove}>
        {isBusy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden />
        )}
        {approveText}
      </Button>
    </>
  );
}

export function CandidateDetailDecisionBar({
  className,
  ...props
}: CandidateDetailDecisionActionsProps & { className?: string }) {
  return (
    <div className={className}>
      <div className={styles.detailActionsPrimary}>
        <CandidateDetailDecisionActions {...props} />
      </div>
    </div>
  );
}

import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/Button/Button";
import { TextInput } from "@/components/TextInput/TextInput";
import { AdminApiError, isAdminAuthError, verifyAdminToken } from "../admin/admin-api";

import { AUTH_FAILURE_MESSAGE, type TokenGateProps } from "./AdminReviewWorkspace.types";
import styles from "./TokenGate.module.css";

export function TokenGate({ authError, onAuthenticate }: TokenGateProps) {
  const [value, setValue] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const displayError = submitError ?? authError;

  return (
    <div className={styles.gate}>
      <div className={styles.head}>
        <div className={styles.iconWrap}>
          <KeyRound size={16} aria-hidden />
        </div>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>Enter the review token</h1>
        </div>
      </div>
      <p className={styles.hint}>
        Paste your <code className={styles.code}>ADMIN_REVIEW_TOKEN</code>. It is held in this browser tab only and
        never sent anywhere except the review API.
      </p>
      {displayError ? (
        <div className={styles.errorBox}>
          <div className={styles.errorRow}>
            <ShieldAlert size={16} aria-hidden />
            <span>{displayError}</span>
          </div>
        </div>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = value.trim();
          if (!trimmed || isVerifying) {
            return;
          }

          void (async () => {
            setIsVerifying(true);
            setSubmitError(null);
            try {
              await verifyAdminToken(trimmed);
              onAuthenticate(trimmed);
            } catch (error) {
              setSubmitError(
                isAdminAuthError(error)
                  ? AUTH_FAILURE_MESSAGE
                  : error instanceof AdminApiError
                    ? error.message
                    : "Could not reach the review API."
              );
            } finally {
              setIsVerifying(false);
            }
          })();
        }}
        className={styles.form}
      >
        <TextInput
          autoFocus
          type="password"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (submitError) {
              setSubmitError(null);
            }
          }}
          placeholder="paste token"
          disabled={isVerifying}
        />
        <Button type="submit" variant="approve" disabled={isVerifying || !value.trim()} className={styles.submit}>
          {isVerifying ? <Loader2 size={16} className={styles.spin} aria-hidden /> : null}
          {isVerifying ? "Checking token…" : "Connect to review API"}
        </Button>
      </form>
    </div>
  );
}

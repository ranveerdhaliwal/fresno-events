import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { AdminApiError, isAdminAuthError, verifyAdminToken } from "../admin/admin-api";

import { AUTH_FAILURE_MESSAGE, btnClickable, type TokenGateProps } from "./AdminReviewWorkspace.types";
import styles from "./AdminReviewWorkspace.module.css";

export function TokenGate({ authError, onAuthenticate }: TokenGateProps) {
  const [value, setValue] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const displayError = submitError ?? authError;

  return (
    <div className={styles.tokenGate}>
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-300">
          <KeyRound className="size-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-neutral-400">Admin</p>
          <h1 className="text-lg font-semibold">Enter the review token</h1>
        </div>
      </div>
      <p className="text-sm text-neutral-300">
        Paste your <code className="rounded bg-neutral-800 px-1 py-0.5 text-xs">ADMIN_REVIEW_TOKEN</code>. It is held
        in this browser tab only and never sent anywhere except the review API.
      </p>
      {displayError ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          <div className="flex items-center gap-2 text-rose-200">
            <ShieldAlert className="size-4 shrink-0" />
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
        className="space-y-3"
      >
        <input
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
          className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-sm focus:border-amber-300 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isVerifying || !value.trim()}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-semibold text-neutral-900 transition hover:bg-amber-200",
            btnClickable,
            "disabled:opacity-60"
          )}
        >
          {isVerifying ? <Loader2 className="size-4 animate-spin" /> : null}
          {isVerifying ? "Checking token…" : "Connect to review API"}
        </button>
      </form>
    </div>
  );
}

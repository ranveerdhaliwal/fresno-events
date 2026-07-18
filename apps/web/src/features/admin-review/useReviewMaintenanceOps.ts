import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import type { ReviewQueueAuditResponse } from "@fresno-events/shared";

import {
  AdminApiError,
  fetchPreApproveAudit,
  runOccurrenceRelinkOps,
  runPriorityRerankOps,
  runPublishedOrphanCleanupOps,
  runVenueAddressBackfillOps,
  runVenueGeocodeOps
} from "../admin/admin-api";
import { adminKeys } from "../admin/admin.queryKeys";
import type { MaintenanceOpKind, MaintenanceOpResult } from "./AdminMaintenancePanel";

/**
 * Queue-maintenance operations (relink, orphan cleanup, address backfill,
 * priority rerank, geocode) plus the pre-approve audit — each with dry-run
 * "check" and confirmed "apply" flows.
 */
export function useReviewMaintenanceOps(token: string) {
  const queryClient = useQueryClient();
  const [maintenanceOp, setMaintenanceOp] = useState<MaintenanceOpKind | null>(null);
  const [maintenanceResult, setMaintenanceResult] = useState<MaintenanceOpResult | null>(null);
  const [geocodeProgress, setGeocodeProgress] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<ReviewQueueAuditResponse | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const preApproveAuditMutation = useMutation({
    mutationFn: () => fetchPreApproveAudit(token),
    onSuccess: (result) => {
      setAuditResult(result);
      setAuditError(null);
    },
    onError: (error: unknown) => {
      setAuditResult(null);
      setAuditError(error instanceof AdminApiError ? error.message : "Pre-approve check failed.");
    }
  });

  const relinkOpsMutation = useMutation({
    mutationFn: (dryRun: boolean) => runOccurrenceRelinkOps(token, dryRun),
    onMutate: (dryRun) => {
      setMaintenanceOp("relink");
      setMaintenanceResult({ kind: "relink", dryRun });
    },
    onSuccess: (relink, dryRun) => {
      setMaintenanceResult({ kind: "relink", dryRun, relink });
      void queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
    },
    onError: (error: unknown, dryRun) => {
      setMaintenanceResult({
        kind: "relink",
        dryRun,
        error: error instanceof AdminApiError ? error.message : "Occurrence relink failed."
      });
    },
    onSettled: () => {
      setMaintenanceOp(null);
    }
  });

  const orphanCleanupMutation = useMutation({
    mutationFn: (dryRun: boolean) => runPublishedOrphanCleanupOps(token, dryRun),
    onMutate: (dryRun) => {
      setMaintenanceOp("orphans");
      setMaintenanceResult({ kind: "orphans", dryRun });
    },
    onSuccess: (orphans, dryRun) => {
      setMaintenanceResult({ kind: "orphans", dryRun, orphans });
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "published-events"] });
    },
    onError: (error: unknown, dryRun) => {
      setMaintenanceResult({
        kind: "orphans",
        dryRun,
        error: error instanceof AdminApiError ? error.message : "Published orphan cleanup failed."
      });
    },
    onSettled: () => {
      setMaintenanceOp(null);
    }
  });

  const addressBackfillMutation = useMutation({
    mutationFn: (dryRun: boolean) => runVenueAddressBackfillOps(token, dryRun),
    onMutate: (dryRun) => {
      setMaintenanceOp("addresses");
      setMaintenanceResult({ kind: "addresses", dryRun });
    },
    onSuccess: (addresses, dryRun) => {
      setMaintenanceResult({ kind: "addresses", dryRun, addresses });
      void queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
    },
    onError: (error: unknown, dryRun) => {
      setMaintenanceResult({
        kind: "addresses",
        dryRun,
        error: error instanceof AdminApiError ? error.message : "Venue address cleanup failed."
      });
    },
    onSettled: () => {
      setMaintenanceOp(null);
    }
  });

  const priorityRerankMutation = useMutation({
    mutationFn: (dryRun: boolean) => runPriorityRerankOps(token, dryRun),
    onMutate: (dryRun) => {
      setMaintenanceOp("priority");
      setMaintenanceResult({ kind: "priority", dryRun });
    },
    onSuccess: (priority, dryRun) => {
      setMaintenanceResult({ kind: "priority", dryRun, priority });
      void queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "published-events"] });
    },
    onError: (error: unknown, dryRun) => {
      setMaintenanceResult({
        kind: "priority",
        dryRun,
        error: error instanceof AdminApiError ? error.message : "Priority rerank failed."
      });
    },
    onSettled: () => {
      setMaintenanceOp(null);
    }
  });

  const geocodeOpsMutation = useMutation({
    mutationFn: (dryRun: boolean) =>
      runVenueGeocodeOps(token, {
        dryRun,
        ...(dryRun
          ? {}
          : {
              onProgress: (progress) => {
                setGeocodeProgress(
                  `Batch ${progress.batch}: ${progress.totalGeocoded} geocoded (${progress.totalScanned} scanned)…`
                );
              }
            })
      }),
    onMutate: (dryRun) => {
      setMaintenanceOp("geocode");
      setMaintenanceResult({ kind: "geocode", dryRun });
      if (!dryRun) {
        setGeocodeProgress("Starting geocode run…");
      }
    },
    onSuccess: (geocode, dryRun) => {
      setMaintenanceResult({ kind: "geocode", dryRun, geocode });
    },
    onError: (error: unknown, dryRun) => {
      setMaintenanceResult({
        kind: "geocode",
        dryRun,
        error: error instanceof AdminApiError ? error.message : "Venue geocode failed."
      });
    },
    onSettled: () => {
      setMaintenanceOp(null);
      setGeocodeProgress(null);
    }
  });

  const maintenanceLoading =
    relinkOpsMutation.isPending ||
    orphanCleanupMutation.isPending ||
    addressBackfillMutation.isPending ||
    priorityRerankMutation.isPending ||
    geocodeOpsMutation.isPending;

  const handleMaintenanceCheck = useCallback(
    (kind: MaintenanceOpKind) => {
      if (kind === "relink") {
        relinkOpsMutation.mutate(true);
        return;
      }
      if (kind === "orphans") {
        orphanCleanupMutation.mutate(true);
        return;
      }
      if (kind === "addresses") {
        addressBackfillMutation.mutate(true);
        return;
      }
      if (kind === "geocode") {
        geocodeOpsMutation.mutate(true);
        return;
      }
      priorityRerankMutation.mutate(true);
    },
    [
      addressBackfillMutation,
      geocodeOpsMutation,
      orphanCleanupMutation,
      priorityRerankMutation,
      relinkOpsMutation
    ]
  );

  const handleMaintenanceApply = useCallback(
    (kind: MaintenanceOpKind) => {
      if (kind === "relink") {
        if (
          window.confirm(
            "Run occurrence relink? This updates occurrence keys and cross-source duplicate links."
          )
        ) {
          relinkOpsMutation.mutate(false);
        }
        return;
      }
      if (kind === "orphans") {
        if (
          window.confirm(
            "Delete published orphan events? This removes scheduled rows that duplicate another published show (same title, venue, and start time)."
          )
        ) {
          orphanCleanupMutation.mutate(false);
        }
        return;
      }
      if (kind === "addresses") {
        if (
          window.confirm(
            "Fix venue addresses? This normalizes mailing-line addresses on candidates and published venues."
          )
        ) {
          addressBackfillMutation.mutate(false);
        }
        return;
      }
      if (kind === "geocode") {
        if (
          window.confirm(
            "Geocode all missing coordinates on venues and review candidates? This runs in rate-limited batches until finished and may take several minutes."
          )
        ) {
          geocodeOpsMutation.mutate(false);
        }
        return;
      }
      if (
        window.confirm(
          "Apply priority rerank? This patches suggested_priority on pending primaries and priority on published events (excluding manual) when the shared rules match."
        )
      ) {
        priorityRerankMutation.mutate(false);
      }
    },
    [addressBackfillMutation, geocodeOpsMutation, orphanCleanupMutation, priorityRerankMutation, relinkOpsMutation]
  );

  const dismissMaintenanceResult = useCallback(() => {
    setMaintenanceResult(null);
  }, []);

  const dismissAudit = useCallback(() => {
    setAuditResult(null);
    setAuditError(null);
  }, []);

  const isPending = maintenanceLoading || preApproveAuditMutation.isPending;

  return {
    maintenanceOp,
    maintenanceResult,
    maintenanceLoading,
    geocodeProgress,
    auditResult,
    auditError,
    preApproveAuditMutation,
    handleMaintenanceCheck,
    handleMaintenanceApply,
    dismissMaintenanceResult,
    dismissAudit,
    isPending
  };
}

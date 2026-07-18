import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { act, renderHook, waitFor } from "@/tests/render";

const fetchPreApproveAudit = vi.fn();
const runOccurrenceRelinkOps = vi.fn();
const runPublishedOrphanCleanupOps = vi.fn();
const runVenueAddressBackfillOps = vi.fn();
const runPriorityRerankOps = vi.fn();
const runVenueGeocodeOps = vi.fn();

vi.mock("../admin/admin-api", () => ({
  AdminApiError: class AdminApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AdminApiError";
    }
  },
  fetchPreApproveAudit: (...args: unknown[]) => fetchPreApproveAudit(...args),
  runOccurrenceRelinkOps: (...args: unknown[]) => runOccurrenceRelinkOps(...args),
  runPublishedOrphanCleanupOps: (...args: unknown[]) => runPublishedOrphanCleanupOps(...args),
  runVenueAddressBackfillOps: (...args: unknown[]) => runVenueAddressBackfillOps(...args),
  runPriorityRerankOps: (...args: unknown[]) => runPriorityRerankOps(...args),
  runVenueGeocodeOps: (...args: unknown[]) => runVenueGeocodeOps(...args)
}));

import { useReviewMaintenanceOps } from "./useReviewMaintenanceOps";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useReviewMaintenanceOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPreApproveAudit.mockResolvedValue({ ok: true, issues: [] });
    runOccurrenceRelinkOps.mockResolvedValue({ scanned: 1 });
  });

  it("runs a dry-run maintenance check without confirm", async () => {
    const { result } = renderHook(() => useReviewMaintenanceOps("token"), {
      wrapper: createWrapper()
    });

    await act(async () => {
      result.current.handleMaintenanceCheck("relink");
    });

    expect(runOccurrenceRelinkOps).toHaveBeenCalledWith("token", true);
  });

  it("requires confirm before applying maintenance", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useReviewMaintenanceOps("token"), {
      wrapper: createWrapper()
    });

    act(() => {
      result.current.handleMaintenanceApply("relink");
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(runOccurrenceRelinkOps).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("dismisses audit state", async () => {
    const { result } = renderHook(() => useReviewMaintenanceOps("token"), {
      wrapper: createWrapper()
    });

    await act(async () => {
      result.current.preApproveAuditMutation.mutate();
    });

    await waitFor(() => {
      expect(result.current.auditResult).toEqual({ ok: true, issues: [] });
    });

    act(() => {
      result.current.dismissAudit();
    });
    expect(result.current.auditResult).toBeNull();
    expect(result.current.auditError).toBeNull();
  });
});

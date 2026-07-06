export interface ErrorBannerContent {
  message: string;
  status?: number;
}

export function formatErrorBannerContent(error: unknown): ErrorBannerContent {
  const message = error instanceof Error ? error.message : "Something went wrong.";

  const status =
    error != null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;

  return status !== undefined ? { message, status } : { message };
}

import { ShieldAlert } from "lucide-react";

import { formatErrorBannerContent } from "./ErrorBanner.utils";

export function ErrorBanner({ error }: { error: unknown }) {
  const { message, status } = formatErrorBannerContent(error);

  return (
    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
      <div className="flex items-center gap-2 text-rose-200">
        <ShieldAlert className="size-4" />
        <span className="font-medium">Request failed</span>
      </div>
      <p className="mt-1">
        {message}
        {status ? ` (HTTP ${status})` : ""}
      </p>
    </div>
  );
}

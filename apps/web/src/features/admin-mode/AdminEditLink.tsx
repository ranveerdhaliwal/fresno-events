import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { useCanAdminEdit } from "./useCanAdminEdit";

export interface AdminEditLinkProps {
  eventId: string;
  className?: string | undefined;
  children?: ReactNode;
}

export function AdminEditLink({ eventId, className, children }: AdminEditLinkProps) {
  const canAdminEdit = useCanAdminEdit();

  if (!canAdminEdit) {
    return null;
  }

  return (
    <Link
      to="/admin/events/$eventId"
      params={{ eventId }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200 transition hover:bg-amber-300/20",
        className
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {children ?? (
        <>
          <Pencil className="size-3" aria-hidden />
          Edit
        </>
      )}
    </Link>
  );
}

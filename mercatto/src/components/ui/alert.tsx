import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  info: { box: "border-info-600/25 bg-info-50 text-info-700", icon: Info },
  success: { box: "border-success-600/25 bg-success-50 text-success-700", icon: CheckCircle2 },
  warning: { box: "border-warning-600/30 bg-warning-50 text-warning-700", icon: AlertTriangle },
  danger: { box: "border-danger-600/25 bg-danger-50 text-danger-700", icon: XCircle },
} as const;

export function Alert({ tone = "info", title, children, action, className }: { tone?: keyof typeof styles; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const { box, icon: Icon } = styles[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-card border p-3.5 text-sm", box, className)}>
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("text-fg-muted [&_a]:font-semibold [&_a]:underline", title && "mt-0.5")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

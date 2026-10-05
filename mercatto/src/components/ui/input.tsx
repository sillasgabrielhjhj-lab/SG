"use client";

import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFieldControl } from "@/components/ui/field";

export const controlClasses =
  "w-full rounded-field border border-line-strong bg-surface text-sm text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 hover:border-fg-subtle focus:border-brand-600 focus:shadow-focus focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-subtle aria-[invalid=true]:border-danger-600 aria-[invalid=true]:focus:shadow-[0_0_0_3px_oklch(0.575_0.205_27/0.2)]";

function useControlProps<T extends { id?: string; "aria-describedby"?: string; "aria-invalid"?: React.AriaAttributes["aria-invalid"]; required?: boolean }>(props: T) {
  const field = useFieldControl();
  return {
    ...props,
    id: props.id ?? field?.id,
    "aria-describedby": props["aria-describedby"] ?? field?.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid ? true : undefined),
    required: props.required ?? field?.required,
  };
}

export type InputProps = Omit<ComponentProps<"input">, "prefix"> & { leading?: ReactNode; trailing?: ReactNode; state?: "success" };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, leading, trailing, state, ...props }, ref) {
  const control = useControlProps(props);
  if (!leading && !trailing) {
    return <input ref={ref} className={cn(controlClasses, "h-11 px-3", state === "success" && "border-success-600", className)} {...control} />;
  }
  return (
    <div className={cn("relative flex items-center", className)}>
      {leading ? <span className="pointer-events-none absolute left-3 flex items-center text-fg-subtle">{leading}</span> : null}
      <input ref={ref} className={cn(controlClasses, "h-11", leading ? "pl-10" : "pl-3", trailing ? "pr-11" : "pr-3", state === "success" && "border-success-600")} {...control} />
      {trailing ? <span className="absolute right-2 flex items-center">{trailing}</span> : null}
    </div>
  );
});

export type TextareaProps = ComponentProps<"textarea"> & { showCount?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, showCount, maxLength, value, defaultValue, ...props }, ref) {
  const control = useControlProps(props);
  const length = String(value ?? defaultValue ?? "").length;
  return (
    <div className="relative">
      <textarea ref={ref} maxLength={maxLength} value={value} defaultValue={defaultValue} className={cn(controlClasses, "min-h-24 px-3 py-2.5 leading-relaxed", className)} {...control} />
      {showCount && maxLength ? (
        <span className="pointer-events-none absolute right-2 bottom-2 text-2xs text-fg-subtle tabular" aria-hidden>
          {length}/{maxLength}
        </span>
      ) : null}
    </div>
  );
});

export type SelectProps = ComponentProps<"select">;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, children, ...props }, ref) {
  const control = useControlProps(props);
  return (
    <div className={cn("relative", className)}>
      <select ref={ref} className={cn(controlClasses, "h-11 appearance-none pr-10 pl-3")} {...control}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
    </div>
  );
});

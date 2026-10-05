"use client";

import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<ComponentProps<"input">, "type"> & { label?: ReactNode; description?: ReactNode };

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, id, ...props }, ref) {
  return (
    <label className={cn("group flex cursor-pointer items-start gap-2.5 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60", className)} htmlFor={id}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="peer mt-0.5 size-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-surface bg-center bg-no-repeat transition-colors checked:border-brand-700 checked:bg-brand-700 checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3.5 8.5l3 3 6-7%22/></svg>')] hover:border-brand-600 focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed"
        {...props}
      />
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="text-fg">{label}</span> : null}
          {description ? <span className="text-xs text-fg-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
});

export type RadioProps = Omit<ComponentProps<"input">, "type"> & { label?: ReactNode; description?: ReactNode };

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ label, description, className, ...props }, ref) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60", className)}>
      <input
        ref={ref}
        type="radio"
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface transition-[border] checked:border-[6px] checked:border-brand-700 hover:border-brand-600 focus-visible:shadow-focus focus-visible:outline-none"
        {...props}
      />
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="text-fg">{label}</span> : null}
          {description ? <span className="text-xs text-fg-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
});

/** Opção em formato de cartão (frete, pagamento, endereço). */
export const RadioCard = forwardRef<HTMLInputElement, RadioProps & { aside?: ReactNode }>(function RadioCard({ label, description, aside, className, children, ...props }, ref) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-card border border-line bg-surface p-3.5 transition-[border-color,box-shadow,background-color] hover:border-brand-400 has-checked:border-brand-600 has-checked:bg-brand-50/60 has-checked:shadow-[inset_0_0_0_1px_var(--color-brand-600)] has-focus-visible:shadow-focus has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className,
      )}
    >
      <input ref={ref} type="radio" className="size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface transition-[border] checked:border-[6px] checked:border-brand-700 focus-visible:outline-none" {...props} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {label ? <span className="text-sm font-semibold text-fg">{label}</span> : null}
        {description ? <span className="text-xs text-fg-muted">{description}</span> : null}
        {children}
      </span>
      {aside ? <span className="shrink-0 text-right">{aside}</span> : null}
    </label>
  );
});

export type SwitchProps = Omit<ComponentProps<"input">, "type"> & { label?: ReactNode; description?: ReactNode };

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch({ label, description, className, ...props }, ref) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60", className)}>
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="font-medium text-fg">{label}</span> : null}
          {description ? <span className="text-xs text-fg-muted">{description}</span> : null}
        </span>
      ) : null}
      <span className="relative inline-flex shrink-0">
        <input ref={ref} type="checkbox" role="switch" className="peer h-6 w-11 cursor-pointer appearance-none rounded-full bg-line-strong transition-colors checked:bg-brand-700 focus-visible:shadow-focus focus-visible:outline-none" {...props} />
        <span className="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out-soft peer-checked:translate-x-5" />
      </span>
    </label>
  );
});

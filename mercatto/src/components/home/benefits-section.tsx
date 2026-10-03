import { benefits } from "@/lib/mock-data";
import { iconMap } from "@/components/home/icon-map";

export function BenefitsSection() {
  return (
    <section className="container-page mt-12">
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
        {benefits.map((benefit) => {
          const Icon = iconMap[benefit.icon];
          return (
            <div key={benefit.title} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                {Icon && <Icon className="size-5" />}
              </span>
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground">
                  {benefit.title}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

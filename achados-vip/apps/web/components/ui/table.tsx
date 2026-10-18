import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Tabela com rolagem horizontal segura em telas pequenas. `caption` fica acessível (sr-only). */
export function Table({ caption, children, className }: { caption: string; children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className={cn('w-full min-w-full border-collapse text-sm', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
export const THead = ({ children }: { children: ReactNode }) => (
  <thead className="border-b border-line bg-surface-2/60">{children}</thead>
);
export const TBody = ({ children }: { children: ReactNode }) => <tbody className="divide-y divide-line">{children}</tbody>;
export const Tr = ({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('align-top hover:bg-surface-2/40', className)} {...rest} />;
export const Th = ({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th scope="col" className={cn('whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted', className)} {...rest} />
);
export const Td = ({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-3 py-3 text-fg', className)} {...rest} />;

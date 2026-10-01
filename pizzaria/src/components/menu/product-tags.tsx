import { Flame, Leaf, Sparkles, Star, ChefHat } from 'lucide-react';
import { tagLabels } from '@/lib/menu';
import { cn } from '@/lib/utils';
import type { ProductTag } from '@/types/menu';

const tagStyles: Record<ProductTag, { icon: typeof Flame; className: string }> = {
  'mais-pedido': { icon: Star, className: 'bg-gold-300/30 text-[#7a5410]' },
  vegetariano: { icon: Leaf, className: 'bg-basil-50 text-basil-700' },
  picante: { icon: Flame, className: 'bg-tomato-50 text-tomato-700' },
  novidade: { icon: Sparkles, className: 'bg-ink-900 text-cream-50' },
  chef: { icon: ChefHat, className: 'bg-cream-200 text-ink-700' },
};

export function ProductTags({ tags, className, size = 'sm' }: { tags?: ProductTag[]; className?: string; size?: 'xs' | 'sm' }) {
  if (!tags?.length) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Labels">
      {tags.map((tag) => {
        const { icon: Icon, className: tone } = tagStyles[tag];
        return (
          <li
            key={tag}
            className={cn(
              'inline-flex items-center gap-1 rounded-full font-semibold',
              size === 'xs' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-2.5 py-1 text-xs',
              tone,
            )}
          >
            <Icon className={size === 'xs' ? 'size-3' : 'size-3.5'} aria-hidden />
            {tagLabels[tag]}
          </li>
        );
      })}
    </ul>
  );
}

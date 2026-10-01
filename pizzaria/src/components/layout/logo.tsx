import Image from 'next/image';
import { siteConfig } from '@/config/site';
import { asset } from '@/lib/asset';
import { cn } from '@/lib/utils';

export function Logo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={asset('/brand/logo.png')}
      alt={siteConfig.name}
      width={316}
      height={152}
      unoptimized
      preload={priority}
      className={cn('h-10 w-auto', className)}
    />
  );
}

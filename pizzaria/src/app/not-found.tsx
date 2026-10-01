import Link from 'next/link';
import { buttonStyles } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="grain flex min-h-dvh flex-col items-center justify-center bg-ink-950 px-6 text-center text-cream-50">
      <p className="text-display text-8xl font-light text-tomato-400 italic">404</p>
      <h1 className="text-display mt-4 text-3xl sm:text-4xl">This slice doesn’t exist.</h1>
      <p className="mt-3 max-w-sm text-cream-100/70">The page you’re looking for already left the oven — or never went in.</p>
      <Link href="/" className={buttonStyles({ size: 'lg', className: 'mt-9' })}>
        Back to the menu
      </Link>
    </main>
  );
}

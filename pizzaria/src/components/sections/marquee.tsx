import { marqueeItems } from '@/data/content';

/** Faixa decorativa com os sabores, em movimento lento. */
export function Marquee() {
  const row = (
    <ul className="flex shrink-0 items-center">
      {marqueeItems.map((item) => (
        <li key={item} className="flex items-center">
          <span className="text-display px-6 text-2xl font-normal italic sm:text-3xl">{item}</span>
          <span className="text-lg text-cream-50/50">✦</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div aria-hidden className="overflow-hidden bg-tomato-600 py-4 text-cream-50 select-none sm:py-5">
      <div className="animate-marquee flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}

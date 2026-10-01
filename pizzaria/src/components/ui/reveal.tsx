'use client';

import { m } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Distância vertical inicial, em px. */
  y?: number;
  as?: 'div' | 'li' | 'article';
}

/** Revela o conteúdo suavemente quando entra na tela (uma única vez). */
export function Reveal({ children, className, delay = 0, y = 24, as = 'div' }: RevealProps) {
  const Component = as === 'li' ? m.li : as === 'article' ? m.article : m.div;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}

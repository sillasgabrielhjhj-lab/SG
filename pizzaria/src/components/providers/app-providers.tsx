'use client';

import { LazyMotion, MotionConfig } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { isWhatsAppPlaceholder } from '@/config/site';
import { useCart } from '@/store/cart';
import { useUI } from '@/store/ui';

const loadFeatures = () => import('./motion-features').then((mod) => mod.default);

// Painéis mais pesados só são baixados quando o cliente interage.
const ProductDialog = dynamic(() => import('@/components/product/product-dialog').then((m) => m.ProductDialog), {
  ssr: false,
});
const CartDrawer = dynamic(() => import('@/components/cart/cart-drawer').then((m) => m.CartDrawer), {
  ssr: false,
});

export function AppProviders({ children }: { children: ReactNode }) {
  const hasProduct = useUI((s) => s.product !== null);
  const cartOpen = useUI((s) => s.cartOpen);

  useEffect(() => {
    // Recupera a sacola salva no navegador depois da hidratação.
    void useCart.persist.rehydrate();

    if (process.env.NODE_ENV === 'development' && isWhatsAppPlaceholder) {
      console.warn(
        '[pizzaria] O número de WhatsApp ainda é um placeholder. Configure em src/config/site.ts (contact.whatsapp).',
      );
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        {children}
        <LazyMount when={hasProduct}>
          <ProductDialog />
        </LazyMount>
        <LazyMount when={cartOpen}>
          <CartDrawer />
        </LazyMount>
        <Toaster />
      </LazyMotion>
    </MotionConfig>
  );
}

/** Monta o filho na primeira vez que `when` for verdadeiro e o mantém montado (para animar a saída). */
function LazyMount({ when, children }: { when: boolean; children: ReactNode }) {
  const [active, setActive] = useState(when);
  if (when && !active) setActive(true);
  return active ? children : null;
}

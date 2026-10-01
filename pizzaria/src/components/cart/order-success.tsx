'use client';

import { m } from 'framer-motion';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { WhatsAppIcon } from '@/components/icons/social';
import { Button, LinkButton } from '@/components/ui/button';
import { useUI } from '@/store/ui';

export function OrderSuccess({ onClose }: { onClose: () => void }) {
  const order = useUI((s) => s.lastOrder);
  const setStep = useUI((s) => s.setCartStep);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'error'>('idle');

  const copy = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.message);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
  };

  const newOrder = () => {
    setStep('cart');
    onClose();
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-6 py-10 text-center">
      <m.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="mx-auto inline-flex size-20 items-center justify-center rounded-full bg-basil-500 text-white shadow-[0_16px_40px_-12px_rgb(0_130_74/0.7)]"
      >
        <Check className="size-10" strokeWidth={2.5} aria-hidden />
      </m.span>
      <h3 className="text-display mt-7 text-3xl font-medium">Order ready!</h3>
      {order && (
        <p className="mt-2 text-sm font-semibold tracking-wide text-ink-500">
          Order code <span className="text-ink-900">#{order.code}</span>
        </p>
      )}
      <p className="mx-auto mt-4 max-w-xs leading-relaxed text-ink-500">
        We opened WhatsApp with your order ready to go. <strong className="text-ink-900">Tap send</strong> to
        confirm it with the pizzeria.
      </p>

      {order && (
        <div className="mx-auto mt-8 w-full max-w-xs space-y-3">
          <LinkButton href={order.url} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="lg" className="w-full">
            <WhatsAppIcon className="size-5" /> Open WhatsApp again
          </LinkButton>
          <Button variant="outline" className="w-full" onClick={copy}>
            {copied === 'ok' ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied === 'ok' ? 'Order copied' : 'Copy order summary'}
          </Button>
          <p aria-live="polite" className="text-xs text-ink-500">
            {copied === 'error' && "Couldn't copy. Use the WhatsApp button above."}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={newOrder}
        className="mx-auto mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold text-ink-600 hover:text-ink-900"
      >
        <RotateCcw className="size-4" aria-hidden /> Start a new order
      </button>
    </div>
  );
}

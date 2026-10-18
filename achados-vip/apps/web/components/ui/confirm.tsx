'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/overlay';
import { Notice } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';

/**
 * Diálogo de confirmação. `onConfirm` pode lançar: o erro aparece no próprio diálogo
 * (ex.: 409 explicado) e o diálogo permanece aberto. Fecha sozinho ao concluir com sucesso.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  children,
  onConfirm,
  onClose,
  formatError,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  children?: ReactNode;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  formatError?: (err: unknown) => { title?: string; message: ReactNode };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title?: string; message: ReactNode } | null>(null);

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(formatError ? formatError(e) : { message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={run} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-fg">
        {description ? <div className="text-muted">{description}</div> : null}
        {children}
        {error ? (
          <Notice tone="danger" title={error.title}>
            {error.message}
          </Notice>
        ) : null}
      </div>
    </Modal>
  );
}

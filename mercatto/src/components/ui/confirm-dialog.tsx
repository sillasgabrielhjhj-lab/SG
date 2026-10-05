"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";

/** Confirmação para ações destrutivas (opcionalmente exigindo digitar um texto). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  tone = "danger",
  requireText,
  loading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  requireText?: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const blocked = Boolean(requireText) && typed.trim() !== requireText;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={blocked} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      {children}
      {requireText ? (
        <label className="mt-4 block text-sm">
          Digite <strong>{requireText}</strong> para confirmar
          <Input className="mt-1.5" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
      ) : null}
    </Modal>
  );
}

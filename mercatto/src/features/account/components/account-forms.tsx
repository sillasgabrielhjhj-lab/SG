"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { formatCpf, formatPhone, formatRelative } from "@/lib/format";
import { updateProfileAction, revokeSessionAction } from "@/features/account/actions";
import { changePasswordAction, logoutOtherSessionsAction } from "@/features/auth/actions";
import { PasswordInput, PasswordStrength } from "@/features/auth/components/password-input";

type Errors = Record<string, string[] | undefined>;

export function ProfileForm({ initial }: { initial: { name: string; email: string; cpf: string | null; phone: string | null; birthDate: string | null; marketingOptIn: boolean } }) {
  const [v, setV] = useState({ name: initial.name, cpf: initial.cpf ? formatCpf(initial.cpf) : "", phone: initial.phone ? formatPhone(initial.phone) : "", birthDate: initial.birthDate ?? "", marketingOptIn: initial.marketingOptIn });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateProfileAction(v);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            if (!res.fieldErrors) toast.error(res.error);
            return;
          }
          setErrors({});
          toast.success(res.message ?? "Dados atualizados.");
          router.refresh();
        });
      }}
    >
      <Field label="Nome completo" required error={errors.name} className="sm:col-span-2">
        <Input value={v.name} onChange={set("name")} autoComplete="name" maxLength={120} />
      </Field>
      <Field label="E-mail" hint="Para alterar o e-mail, fale com o suporte." className="sm:col-span-2">
        <Input value={initial.email} readOnly disabled />
      </Field>
      <Field label="CPF" hint={initial.cpf ? "O CPF não pode ser alterado." : "Necessário para emissão de nota fiscal."} error={errors.cpf}>
        <MaskedInput mask="cpf" value={v.cpf} onChange={set("cpf")} readOnly={Boolean(initial.cpf)} disabled={Boolean(initial.cpf)} inputMode="numeric" />
      </Field>
      <Field label="Celular" error={errors.phone}>
        <MaskedInput mask="phone" value={v.phone} onChange={set("phone")} autoComplete="tel-national" inputMode="tel" />
      </Field>
      <Field label="Data de nascimento" error={errors.birthDate}>
        <Input type="date" value={v.birthDate} onChange={set("birthDate")} autoComplete="bday" max={new Date().toISOString().slice(0, 10)} />
      </Field>
      <div className="sm:col-span-2">
        <Checkbox checked={v.marketingOptIn} onChange={set("marketingOptIn")} label="Quero receber ofertas e novidades por e-mail" description="Você pode cancelar quando quiser." />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [v, setV] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  return (
    <form
      noValidate
      className="flex max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await changePasswordAction(v);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? { currentPassword: [res.error] });
            return;
          }
          setErrors({});
          setV({ currentPassword: "", password: "", confirmPassword: "" });
          toast.success(res.message ?? "Senha alterada.");
          router.refresh();
        });
      }}
    >
      <Field label="Senha atual" required error={errors.currentPassword}>
        <PasswordInput value={v.currentPassword} onChange={set("currentPassword")} autoComplete="current-password" />
      </Field>
      <Field label="Nova senha" required error={errors.password} hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput value={v.password} onChange={set("password")} autoComplete="new-password" />
      </Field>
      <PasswordStrength value={v.password} />
      <Field label="Confirme a nova senha" required error={errors.confirmPassword}>
        <PasswordInput value={v.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
      </Field>
      <div>
        <Button type="submit" loading={pending}>
          Alterar senha
        </Button>
      </div>
    </form>
  );
}

export type SessionRow = { id: string; current: boolean; createdAt: string; lastUsedAt: string; ipAddress: string | null; userAgent: string | null };

function describeAgent(ua: string | null) {
  if (!ua) return { label: "Dispositivo desconhecido", mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: `${browser}${os ? ` · ${os}` : ""}`, mobile };
}

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const others = sessions.filter((s) => !s.current).length;
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Pronto.");
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line rounded-card border border-line">
        {sessions.map((s) => {
          const agent = describeAgent(s.userAgent);
          const Icon = agent.mobile ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex items-center gap-3 p-3">
              <Icon className="size-5 shrink-0 text-fg-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {agent.label}
                  {s.current ? <span className="ml-2 rounded-full bg-success-50 px-2 py-0.5 text-2xs font-bold text-success-700">Este dispositivo</span> : null}
                </p>
                <p className="text-xs text-fg-muted">
                  Ativa {formatRelative(s.lastUsedAt)}
                  {s.ipAddress ? ` · IP ${s.ipAddress}` : ""}
                </p>
              </div>
              {!s.current ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeSessionAction({ sessionId: s.id }))}>
                  Encerrar
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {others > 0 ? (
        <div>
          <Button variant="outline" size="sm" leftIcon={<LogOut className="size-4" />} loading={pending} onClick={() => run(() => logoutOtherSessionsAction())}>
            Encerrar todas as outras sessões
          </Button>
        </div>
      ) : null}
    </div>
  );
}

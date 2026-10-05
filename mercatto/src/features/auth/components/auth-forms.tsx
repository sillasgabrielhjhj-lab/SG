"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { PasswordInput, PasswordStrength } from "@/features/auth/components/password-input";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/features/auth/actions";

type Errors = Record<string, string[] | undefined>;

export function LoginForm({ redirect }: { redirect?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        start(async () => {
          const res = await loginAction({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), redirect });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setFormError(res.fieldErrors ? null : res.error);
            return;
          }
          router.replace(res.data.redirectTo);
          router.refresh();
        });
      }}
      className="flex flex-col gap-4"
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label="E-mail" required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" autoFocus />
      </Field>
      <Field label="Senha" required error={errors.password} labelAction={<Link href="/recuperar-senha" className="text-xs font-semibold text-brand-700 hover:underline">Esqueci minha senha</Link>}>
        <PasswordInput name="password" autoComplete="current-password" />
      </Field>
      <Button type="submit" size="lg" fullWidth loading={pending}>
        Entrar
      </Button>
    </form>
  );
}

export function RegisterForm({ redirect }: { redirect?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const res = await registerAction({
            name: String(f.get("name") ?? ""),
            email: String(f.get("email") ?? ""),
            password: String(f.get("password") ?? ""),
            confirmPassword: String(f.get("confirmPassword") ?? ""),
            cpf: String(f.get("cpf") ?? ""),
            phone: String(f.get("phone") ?? ""),
            acceptTerms: f.get("acceptTerms") === "on",
            marketingOptIn: f.get("marketingOptIn") === "on",
            redirect,
          });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setFormError(res.fieldErrors ? null : res.error);
            return;
          }
          router.replace(res.data.redirectTo);
          router.refresh();
        });
      }}
      className="flex flex-col gap-4"
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label="Nome completo" required error={errors.name}>
        <Input name="name" autoComplete="name" autoFocus />
      </Field>
      <Field label="E-mail" required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CPF" error={errors.cpf} hint="Opcional agora; exigido na compra">
          <MaskedInput mask="cpf" name="cpf" placeholder="000.000.000-00" />
        </Field>
        <Field label="Celular" error={errors.phone}>
          <MaskedInput mask="phone" name="phone" placeholder="(11) 99999-9999" />
        </Field>
      </div>
      <Field label="Senha" required error={errors.password} hint="Mínimo de 8 caracteres, com letras e números">
        <PasswordInput name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <PasswordStrength value={password} />
      <Field label="Confirme a senha" required error={errors.confirmPassword}>
        <PasswordInput name="confirmPassword" autoComplete="new-password" />
      </Field>
      <Checkbox
        name="acceptTerms"
        label={
          <>
            Li e aceito os <Link href="/termos" target="_blank" className="font-semibold text-brand-700 underline">Termos de uso</Link> e a <Link href="/privacidade" target="_blank" className="font-semibold text-brand-700 underline">Política de privacidade</Link>
          </>
        }
      />
      {errors.acceptTerms ? <p className="-mt-2 text-xs font-medium text-danger-700">{errors.acceptTerms[0]}</p> : null}
      <Checkbox name="marketingOptIn" label="Quero receber ofertas e novidades por e-mail" />
      <Button type="submit" size="lg" fullWidth loading={pending}>
        Criar conta
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [done, setDone] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck className="size-12 text-brand-700" aria-hidden />
        <p className="text-sm text-fg-muted">{done}</p>
        <Link href="/entrar" className="text-sm font-semibold text-brand-700 hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get("email") ?? "");
        start(async () => {
          const res = await forgotPasswordAction({ email });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setFormError(res.fieldErrors ? null : res.error);
            return;
          }
          setDone(res.message ?? "Verifique seu e-mail.");
        });
      }}
      className="flex flex-col gap-4"
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label="E-mail da conta" required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" autoFocus />
      </Field>
      <Button type="submit" size="lg" fullWidth loading={pending}>
        Enviar link de redefinição
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-12 text-success-600" aria-hidden />
        <p className="text-sm text-fg-muted">Senha redefinida com sucesso. Por segurança, todas as sessões foram encerradas.</p>
        <Link href="/entrar" className="text-sm font-semibold text-brand-700 hover:underline">
          Entrar com a nova senha
        </Link>
      </div>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const res = await resetPasswordAction({ token, password: String(f.get("password") ?? ""), confirmPassword: String(f.get("confirmPassword") ?? "") });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setFormError(res.fieldErrors ? null : res.error);
            return;
          }
          setDone(true);
        });
      }}
      className="flex flex-col gap-4"
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label="Nova senha" required error={errors.password}>
        <PasswordInput name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      </Field>
      <PasswordStrength value={password} />
      <Field label="Confirme a nova senha" required error={errors.confirmPassword}>
        <PasswordInput name="confirmPassword" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" fullWidth loading={pending}>
        Redefinir senha
      </Button>
    </form>
  );
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyBRL(valueInCents: number) {
  return (valueInCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatInstallments(valueInCents: number, maxInstallments = 12) {
  const perInstallment = valueInCents / maxInstallments;
  return `${maxInstallments}x de ${formatCurrencyBRL(perInstallment)} sem juros`;
}

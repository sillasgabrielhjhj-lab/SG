import { formatBRL } from "@/lib/money";
import { resolveAppUrl } from "@/lib/app-url";

/**
 * Templates de e-mail transacional com identidade Mercatto. Todo dado
 * dinâmico passa por escapeHtml. HTML com tabelas + estilos inline
 * (compatibilidade com clientes de e-mail) e versão texto.
 */
export type EmailContent = { subject: string; html: string; text: string; template: string };

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const BRAND = "#0b5c4d";
const appUrl = () => resolveAppUrl();

function layout(opts: { preheader: string; title: string; bodyHtml: string; cta?: { label: string; url: string } }) {
  const cta = opts.cta
    ? `<tr><td style="padding:8px 0 24px"><a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:15px">${escapeHtml(opts.cta.label)}</a></td></tr>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;background:#f2f5f4;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d2b2f">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${BRAND};padding:18px 24px;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px">mercatto</td></tr>
<tr><td style="padding:24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:700;padding-bottom:12px">${escapeHtml(opts.title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;padding-bottom:16px">${opts.bodyHtml}</td></tr>${cta}
</table></td></tr>
<tr><td style="padding:16px 24px;background:#f7f9f8;color:#5b6b70;font-size:12px;line-height:1.5">Você recebeu este e-mail porque possui uma conta na Mercatto. Nunca pedimos senha ou dados de cartão por e-mail.<br>© Mercatto — <a href="${appUrl()}" style="color:${BRAND}">${appUrl().replace(/^https?:\/\//, "")}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const p = (text: string) => `<p style="margin:0 0 10px">${escapeHtml(text)}</p>`;

export function verifyEmailEmail(name: string, url: string): EmailContent {
  return {
    template: "verify_email",
    subject: "Confirme seu e-mail na Mercatto",
    html: layout({ preheader: "Confirme seu e-mail para proteger sua conta.", title: `Olá, ${name.split(" ")[0]}!`, bodyHtml: p("Confirme seu endereço de e-mail para proteger sua conta e receber atualizações dos seus pedidos. O link vale por 48 horas."), cta: { label: "Confirmar e-mail", url } }),
    text: `Olá, ${name}!\n\nConfirme seu e-mail acessando: ${url}\n\nO link vale por 48 horas.`,
  };
}

export function passwordResetEmail(name: string, url: string): EmailContent {
  return {
    template: "password_reset",
    subject: "Redefinição de senha — Mercatto",
    html: layout({ preheader: "Use o link para criar uma nova senha.", title: "Redefinir senha", bodyHtml: p(`Olá, ${name.split(" ")[0]}. Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora e só pode ser usado uma vez.`) + p("Se não foi você, ignore este e-mail — sua senha continua a mesma."), cta: { label: "Criar nova senha", url } }),
    text: `Olá, ${name}.\n\nPara redefinir sua senha acesse: ${url}\nO link vale por 1 hora. Se não foi você, ignore este e-mail.`,
  };
}

export function welcomeEmail(name: string): EmailContent {
  return {
    template: "welcome",
    subject: "Boas-vindas à Mercatto",
    html: layout({ preheader: "Sua conta está pronta.", title: `Boas-vindas, ${name.split(" ")[0]}!`, bodyHtml: p("Sua conta está pronta. Aproveite ofertas oficiais Mercatto, lojas parceiras verificadas, PIX e parcelamento."), cta: { label: "Ver ofertas", url: `${appUrl()}/ofertas` } }),
    text: `Boas-vindas à Mercatto, ${name}! Veja as ofertas: ${appUrl()}/ofertas`,
  };
}

type OrderRef = { number: string; totalCents: number; customerName?: string };
const orderUrl = (o: OrderRef) => `${appUrl()}/minha-conta/pedidos/${encodeURIComponent(o.number)}`;

export function orderPaidEmail(order: OrderRef): EmailContent {
  return {
    template: "order_paid",
    subject: `Pagamento aprovado — pedido ${order.number}`,
    html: layout({ preheader: "Seu pagamento foi aprovado.", title: "Pagamento aprovado!", bodyHtml: p(`Recebemos o pagamento do pedido ${order.number} (${formatBRL(order.totalCents)}). Avisaremos assim que ele for enviado.`), cta: { label: "Acompanhar pedido", url: orderUrl(order) } }),
    text: `Pagamento aprovado do pedido ${order.number} (${formatBRL(order.totalCents)}). Acompanhe: ${orderUrl(order)}`,
  };
}

export function orderShippedEmail(order: OrderRef, tracking?: { code?: string | null; carrier?: string | null; url?: string | null }): EmailContent {
  const info = tracking?.code ? ` Código de rastreio: ${tracking.code}${tracking.carrier ? ` (${tracking.carrier})` : ""}.` : "";
  return {
    template: "order_shipped",
    subject: `Pedido ${order.number} enviado`,
    html: layout({ preheader: "Seu pedido está a caminho.", title: "Seu pedido está a caminho!", bodyHtml: p(`O pedido ${order.number} foi enviado.${info}`), cta: { label: "Rastrear pedido", url: orderUrl(order) } }),
    text: `O pedido ${order.number} foi enviado.${info} ${orderUrl(order)}`,
  };
}

export function orderDeliveredEmail(order: OrderRef): EmailContent {
  return {
    template: "order_delivered",
    subject: `Pedido ${order.number} entregue`,
    html: layout({ preheader: "Conte o que achou da compra.", title: "Pedido entregue!", bodyHtml: p(`O pedido ${order.number} foi entregue. Que tal avaliar sua compra e ajudar outros compradores?`), cta: { label: "Avaliar compra", url: `${appUrl()}/minha-conta/avaliacoes` } }),
    text: `O pedido ${order.number} foi entregue. Avalie: ${appUrl()}/minha-conta/avaliacoes`,
  };
}

export function orderCancelledEmail(order: OrderRef, reason?: string | null): EmailContent {
  return {
    template: "order_cancelled",
    subject: `Pedido ${order.number} cancelado`,
    html: layout({ preheader: "Seu pedido foi cancelado.", title: "Pedido cancelado", bodyHtml: p(`O pedido ${order.number} foi cancelado.${reason ? ` Motivo: ${reason}.` : ""}`) + p("Se houve pagamento, o estorno segue o prazo da forma de pagamento utilizada."), cta: { label: "Ver detalhes", url: orderUrl(order) } }),
    text: `O pedido ${order.number} foi cancelado.${reason ? ` Motivo: ${reason}.` : ""} ${orderUrl(order)}`,
  };
}

export function paymentFailedEmail(order: OrderRef, reason?: string | null): EmailContent {
  return {
    template: "payment_failed",
    subject: `Pagamento não aprovado — pedido ${order.number}`,
    html: layout({ preheader: "Não conseguimos aprovar seu pagamento.", title: "Pagamento não aprovado", bodyHtml: p(`Não foi possível aprovar o pagamento do pedido ${order.number}.${reason ? ` ${reason}` : ""}`) + p("Você pode tentar novamente com outra forma de pagamento."), cta: { label: "Ver pedido", url: orderUrl(order) } }),
    text: `Pagamento não aprovado do pedido ${order.number}. ${reason ?? ""} ${orderUrl(order)}`,
  };
}

export function newOrderSellerEmail(order: OrderRef & { itemsCount: number }): EmailContent {
  const url = `${appUrl()}/vendedor/pedidos`;
  return {
    template: "new_order_seller",
    subject: `Nova venda — pedido ${order.number}`,
    html: layout({ preheader: "Você tem um novo pedido pago.", title: "Você vendeu!", bodyHtml: p(`O pedido ${order.number} (${order.itemsCount} ${order.itemsCount === 1 ? "item" : "itens"}, ${formatBRL(order.totalCents)}) foi pago. Prepare o envio dentro do prazo.`), cta: { label: "Ver pedido", url } }),
    text: `Nova venda: pedido ${order.number} (${formatBRL(order.totalCents)}). ${url}`,
  };
}

export function lowStockEmail(productName: string, variantName: string, stock: number): EmailContent {
  return {
    template: "low_stock",
    subject: `Estoque baixo: ${productName}`,
    html: layout({ preheader: "Reponha o estoque para não perder vendas.", title: "Estoque baixo", bodyHtml: p(`${productName} (${variantName}) está com ${stock} ${stock === 1 ? "unidade" : "unidades"}.`), cta: { label: "Gerenciar estoque", url: `${appUrl()}/vendedor/estoque` } }),
    text: `${productName} (${variantName}) está com ${stock} unidade(s).`,
  };
}

'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import type { QuickPreview } from '@/lib/types';

export function QuickView() {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [coupon, setCoupon] = useState('');
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickPreview | null>(null);
  const [text, setText] = useState('');

  async function generate(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.quickPreview({
        url: url.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(price.trim() ? { price: price.trim() } : {}),
        ...(originalPrice.trim() ? { originalPrice: originalPrice.trim() } : {}),
        ...(coupon.trim() ? { couponCode: coupon.trim() } : {}),
      });
      setResult(r);
      setText(r.whatsapp ?? '');
      if (!r.ok) setManual(true);
      else {
        // preenche os campos com o que foi lido, para o admin poder corrigir
        if (!title.trim() && r.title) setTitle(r.title);
        if (!price.trim() && r.priceCents) setPrice((r.priceCents / 100).toFixed(2).replace('.', ','));
      }
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (await copyText(text)) toast.success('Texto copiado', 'Cole no grupo do WhatsApp.');
    else toast.error('Não foi possível copiar', 'Selecione o texto e copie manualmente.');
  }

  function reset() {
    setUrl('');
    setTitle('');
    setPrice('');
    setOriginalPrice('');
    setCoupon('');
    setResult(null);
    setText('');
    setError(null);
    setManual(false);
  }

  const imageSrc = result?.imageUrl ?? null;
  const proxy = imageSrc ? `/api/quick/image?url=${encodeURIComponent(imageSrc)}&download=1` : null;

  return (
    <div>
      <PageHeader title="Gerar post" description="Cole o seu link de afiliado. O sistema lê o produto e entrega o texto pronto para o WhatsApp e a imagem. O seu link vai no texto exatamente como você colou." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="1. Cole o seu link" />
          <CardBody>
            <form onSubmit={(e) => void generate(e)} className="space-y-4">
              <Field label="Link de afiliado" required hint="Ex.: https://meli.la/… ou https://mercadolivre.com/sec/…">
                <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meli.la/…" autoComplete="off" autoFocus />
              </Field>

              <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setManual((v) => !v)} aria-expanded={manual}>
                {manual ? 'Ocultar campos manuais' : 'Preencher/corrigir manualmente (título, preço, preço original, cupom)'}
              </button>

              {manual ? (
                <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
                  <Field label="Título do produto" hint="Deixe vazio para ler da página.">
                    <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Preço atual (R$)" hint="Obrigatório se o sistema não conseguir ler.">
                      <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49,90" />
                    </Field>
                    <Field label="Preço original (R$)" hint="Opcional. Só informe se for o preço anterior REAL: ele gera o “De/Por” e o % OFF.">
                      <input className="input" inputMode="decimal" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="99,90" />
                    </Field>
                  </div>
                  <Field label="Cupom (opcional)" hint="Só se o cupom existir e for válido.">
                    <input className="input" value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={60} />
                  </Field>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" loading={busy} disabled={!url.trim()}>
                  Gerar post
                </Button>
                {result || url ? (
                  <Button onClick={reset} disabled={busy}>
                    Limpar
                  </Button>
                ) : null}
              </div>
            </form>
            {error ? <Notice tone="danger" className="mt-4">{error}</Notice> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="2. Copie e publique" />
          <CardBody className="space-y-4">
            {!result ? (
              <p className="text-sm text-muted">O texto e a imagem aparecem aqui depois que você gerar.</p>
            ) : (
              <>
                {result.warnings.map((w) => (
                  <Notice key={w} tone="warning">{w}</Notice>
                ))}
                {!result.ok ? (
                  <Notice tone="info" title="Preencha o que faltou">
                    Não consegui ler {result.needsInput.map((n) => (n === 'price' ? 'o preço' : 'o título')).join(' e ')} da página. Informe nos campos manuais ao lado e gere de novo. O sistema nunca inventa esses dados.
                  </Notice>
                ) : null}

                {imageSrc ? (
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc} alt={result.title ?? 'Produto'} className="h-32 w-32 rounded-lg border border-line bg-white object-contain" referrerPolicy="no-referrer" />
                    <div className="text-sm text-muted">
                      <p className="mb-2">Imagem do produto.</p>
                      {proxy ? (
                        <a className={buttonClass('secondary', 'sm')} href={proxy} download="produto">
                          <Icon name="download" size={16} /> Baixar imagem
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : result.ok ? (
                  <Notice tone="info">Não encontrei imagem do produto na página. Você pode salvar a imagem direto no site do Mercado Livre.</Notice>
                ) : null}

                {result.ok ? (
                  <>
                    <Field label="Texto para o WhatsApp" hint="Você pode editar antes de copiar.">
                      <textarea className="input min-h-[260px] text-sm" value={text} onChange={(e) => setText(e.target.value)} />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" onClick={() => void copy()} icon={<Icon name="copy" size={16} />}>
                        Copiar texto
                      </Button>
                      {result.telegram ? (
                        <Button onClick={() => void copyText(result.telegram ?? '').then((ok) => (ok ? toast.success('Versão Telegram (HTML) copiada') : toast.error('Não foi possível copiar')))}>
                          Copiar versão Telegram
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

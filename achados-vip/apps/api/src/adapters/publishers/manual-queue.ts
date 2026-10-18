/**
 * Fila manual do WhatsApp (Modo B). Não envia nada: o serviço de publicação marca a Publication como
 * MANUAL_READY e o administrador publica à mão e confirma ("marcar como publicada").
 * Nunca devolve `confirmed: true` — este canal jamais gera SENT automático.
 */
import type { HealthResult, PublishPayload, PublisherAdapter, SendResult } from '../../domain/types.js';

export class ManualQueuePublisher implements PublisherAdapter {
  readonly type = 'WHATSAPP_MANUAL_QUEUE' as const;
  readonly format = 'whatsapp' as const;
  readonly automatic = false;

  async send(_payload: PublishPayload): Promise<SendResult> {
    return { ok: false, confirmed: false, permanent: true, error: 'Canal manual: nada é enviado automaticamente' };
  }

  async healthCheck(): Promise<HealthResult> {
    return { ok: true, status: 'CONNECTED', detail: 'Fila manual ativa (não depende de integração externa)' };
  }
}

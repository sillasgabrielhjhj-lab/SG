/**
 * SIMULADOR local mínimo da Bot API do Telegram (SOMENTE testes; api.telegram.org nunca é acessado).
 * Responde getMe, getChat, sendMessage e sendPhoto no formato da Bot API e registra o que recebeu.
 */
import { sendJson, startSimServer, type SimServer } from './sim-server.js';

export const SIM_TG_TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0';

export interface TgMessage {
  method: 'sendMessage' | 'sendPhoto';
  chatId: string;
  /** texto (sendMessage) ou legenda (sendPhoto) */
  text: string;
  photo: string | null;
  parseMode: string | null;
  messageId: number;
}

export class TelegramSimulator {
  readonly messages: TgMessage[] = [];
  private seq = 0;
  /** passos roteirizados para sendMessage/sendPhoto (status HTTP + corpo) */
  readonly sendScript: { status: number; body: unknown }[] = [];

  private constructor(
    private readonly server: SimServer,
    readonly token: string,
  ) {}

  static async start(token: string = SIM_TG_TOKEN): Promise<TelegramSimulator> {
    let tg!: TelegramSimulator;
    const server = await startSimServer((req, res) => {
      const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.path);
      if (!m || m[1] !== tg.token) return sendJson(res, 401, { ok: false, error_code: 401, description: 'Unauthorized' });
      const method = m[2]!;
      const body = req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {};
      if (method === 'getMe') return sendJson(res, 200, { ok: true, result: { id: 1, is_bot: true, username: 'achados_vip_bot' } });
      if (method === 'getChat') return sendJson(res, 200, { ok: true, result: { id: -1001234567890, title: 'Canal Achados VIP (teste)', type: 'channel' } });
      if (method === 'sendMessage' || method === 'sendPhoto') {
        const scripted = tg.sendScript.shift();
        if (scripted) return sendJson(res, scripted.status, scripted.body);
        const messageId = ++tg.seq;
        tg.messages.push({
          method,
          chatId: String(body.chat_id ?? ''),
          text: String((method === 'sendPhoto' ? body.caption : body.text) ?? ''),
          photo: typeof body.photo === 'string' ? body.photo : null,
          parseMode: typeof body.parse_mode === 'string' ? body.parse_mode : null,
          messageId,
        });
        return sendJson(res, 200, { ok: true, result: { message_id: messageId, chat: { id: -1001234567890 }, date: Math.floor(Date.now() / 1000) } });
      }
      return sendJson(res, 404, { ok: false, error_code: 404, description: 'Not Found' });
    });
    tg = new TelegramSimulator(server, token);
    return tg;
  }

  get baseUrl(): string {
    return this.server.url;
  }
  /** Todas as chamadas recebidas (método da Bot API na ordem). */
  get calledMethods(): string[] {
    return this.server.requests.map((r) => r.path.split('/').pop() ?? '');
  }
  close(): Promise<void> {
    return this.server.close();
  }
}

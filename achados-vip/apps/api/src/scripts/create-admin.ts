/**
 * Cria (ou atualiza a senha de) o administrador.
 *
 *   ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='senha-com-12+-caracteres' npm run admin:create
 *   npm run admin:create -- voce@exemplo.com 'senha-com-12+-caracteres'
 *   npm run admin:create -- --email voce@exemplo.com --password '...'
 *
 * Prefira as variáveis de ambiente: argumentos de linha de comando ficam visíveis em `ps`/histórico.
 * Se o usuário já existe, a senha é redefinida e TODAS as sessões dele são encerradas.
 */
import { pathToFileURL } from 'node:url';
import { disconnectDb } from '../lib/db.js';
import { AppError } from '../lib/errors.js';
import { createOrUpdateAdmin } from '../services/auth.js';

export function parseAdminArgs(argv: string[], envVars: Record<string, string | undefined> = process.env): { email?: string; password?: string } {
  let email = envVars.ADMIN_EMAIL;
  let password = envVars.ADMIN_PASSWORD;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--email') email = argv[++i];
    else if (a.startsWith('--email=')) email = a.slice('--email='.length);
    else if (a === '--password') password = argv[++i];
    else if (a.startsWith('--password=')) password = a.slice('--password='.length);
    else if (!a.startsWith('--')) positional.push(a);
  }
  if (!email && positional[0]) email = positional[0];
  if (!password && positional[1]) password = positional[1];
  return { ...(email ? { email } : {}), ...(password ? { password } : {}) };
}

async function main(): Promise<number> {
  const { email, password } = parseAdminArgs(process.argv.slice(2));
  if (!email || !password) {
    console.error('Uso: defina ADMIN_EMAIL e ADMIN_PASSWORD (mín. 12 caracteres) ou passe: <email> <senha>');
    return 1;
  }
  try {
    const { created, user } = await createOrUpdateAdmin(email, password);
    console.log(created ? `Administrador criado: ${user.email}` : `Senha do administrador redefinida: ${user.email} (sessões anteriores encerradas)`);
    return 0;
  } catch (err) {
    console.error(err instanceof AppError ? `Erro: ${err.message}` : 'Erro ao criar o administrador (verifique DATABASE_URL e se as migrations foram aplicadas).');
    return 1;
  } finally {
    await disconnectDb();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}

'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 30;
const COOKIE = 'pz_session';

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const [alg, salt, expected] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !expected) return false;
  const hash = await scrypt(password, Buffer.from(salt, 'base64'), 64);
  const expectedBuf = Buffer.from(expected, 'base64');
  return expectedBuf.length === hash.length && crypto.timingSafeEqual(hash, expectedBuf);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_DAYS * 86400000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expiresAt);
  return { token, expiresAt };
}

function sessionUser(db, token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, s.expires_at FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
    )
    .get(sha256(token));
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name };
}

function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(token, expiresAt, secure) {
  const attrs = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (token) attrs.push(`Expires=${new Date(expiresAt).toUTCString()}`);
  else attrs.push('Max-Age=0');
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

function randomPassword() {
  return crypto.randomBytes(6).toString('base64url');
}

module.exports = {
  COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  sessionUser,
  destroySession,
  parseCookies,
  sessionCookie,
  randomPassword,
};

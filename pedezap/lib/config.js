'use strict';

const path = require('node:path');

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'sim'].includes(raw.toLowerCase());
}

const config = {
  port: int('PORT', 3000),
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  appName: process.env.APP_NAME || 'PedeZap',
  baseUrl: (process.env.BASE_URL || '').replace(/\/+$/, ''),
  priceCents: int('PRICE_CENTS', 4990),
  trialDays: int('TRIAL_DAYS', 7),
  goalCents: int('GOAL_CENTS', 10_000_000),
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  supportWhatsapp: (process.env.SUPPORT_WHATSAPP || '').replace(/\D/g, ''),
  billingPix: {
    key: process.env.BILLING_PIX_KEY || '',
    name: process.env.BILLING_PIX_NAME || '',
    city: process.env.BILLING_PIX_CITY || '',
  },
  trustProxy: bool('TRUST_PROXY', true),
  seedDemo: bool('SEED_DEMO', true),
};

module.exports = config;

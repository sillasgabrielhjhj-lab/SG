import type { Role } from "@/generated/prisma/enums";

/**
 * RBAC: permissões são derivadas EXCLUSIVAMENTE do papel persistido no banco.
 * Nunca confie em papéis/permissões enviados pelo cliente.
 */
export const PERMISSIONS = [
  "shop:buy",
  "account:manage",
  "seller:access",
  "seller:products",
  "seller:orders",
  "seller:promotions",
  "admin:access",
  "admin:catalog",
  "admin:inventory",
  "admin:orders",
  "admin:payments",
  "admin:refunds",
  "admin:customers",
  "admin:sellers",
  "admin:marketing",
  "admin:moderation",
  "admin:content",
  "admin:settings",
  "admin:users.roles",
  "admin:audit",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const CUSTOMER: Permission[] = ["shop:buy", "account:manage"];
const SELLER: Permission[] = [...CUSTOMER, "seller:access", "seller:products", "seller:orders", "seller:promotions"];
const SUPPORT: Permission[] = [
  ...CUSTOMER,
  "admin:access",
  "admin:orders",
  "admin:customers",
  "admin:moderation",
];
const ADMIN: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  CUSTOMER: new Set(CUSTOMER),
  SELLER: new Set(SELLER),
  SUPPORT: new Set(SUPPORT),
  ADMIN: new Set(ADMIN),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: "Cliente",
  SELLER: "Vendedor",
  ADMIN: "Administrador",
  SUPPORT: "Suporte",
};

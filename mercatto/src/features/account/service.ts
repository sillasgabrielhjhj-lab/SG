import "server-only";
import { db } from "@/server/db";
import { AppError, conflict, notFound } from "@/server/errors";
import type { AddressInput } from "@/lib/validators/br";
import type { ProfileInput } from "@/features/account/schemas";

const MAX_ADDRESSES = 10;

export async function getProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, cpf: true, phone: true, birthDate: true, marketingOptIn: true, emailVerifiedAt: true, createdAt: true, role: true },
  });
  if (!user) throw notFound("Usuário não encontrado.");
  return user;
}

export async function updateProfile(userId: string, input: ProfileInput) {
  const current = await db.user.findUnique({ where: { id: userId }, select: { cpf: true } });
  if (!current) throw notFound("Usuário não encontrado.");
  // CPF é definitivo depois de informado (evita fraude em pedidos/notas).
  if (current.cpf && input.cpf && input.cpf !== current.cpf) {
    throw new AppError("VALIDATION", "O CPF não pode ser alterado. Fale com o suporte se houver erro.", { fieldErrors: { cpf: ["O CPF não pode ser alterado"] } });
  }
  if (!current.cpf && input.cpf) {
    const taken = await db.user.findFirst({ where: { cpf: input.cpf, id: { not: userId } }, select: { id: true } });
    if (taken) throw conflict("Este CPF já está vinculado a outra conta.");
  }
  await db.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      ...(current.cpf ? {} : { cpf: input.cpf ?? null }),
      phone: input.phone ?? null,
      birthDate: input.birthDate ?? null,
      marketingOptIn: input.marketingOptIn,
    },
  });
}

export async function listAddresses(userId: string) {
  return db.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
}

export async function createAddress(userId: string, input: AddressInput & { isDefault?: boolean }) {
  const count = await db.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) throw new AppError("UNPROCESSABLE", `Você pode cadastrar até ${MAX_ADDRESSES} endereços.`);
  const makeDefault = count === 0 || Boolean(input.isDefault);
  return db.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({
      data: {
        userId,
        label: input.label ?? null,
        recipientName: input.recipientName,
        phone: input.phone ?? null,
        cep: input.cep,
        street: input.street,
        number: input.number,
        complement: input.complement ?? null,
        district: input.district,
        city: input.city,
        state: input.state,
        reference: input.reference ?? null,
        isDefault: makeDefault,
      },
    });
  });
}

export async function updateAddress(userId: string, addressId: string, input: AddressInput & { isDefault?: boolean }) {
  const address = await db.address.findFirst({ where: { id: addressId, userId }, select: { id: true, isDefault: true } });
  if (!address) throw notFound("Endereço não encontrado.");
  return db.$transaction(async (tx) => {
    if (input.isDefault && !address.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.update({
      where: { id: addressId },
      data: {
        label: input.label ?? null,
        recipientName: input.recipientName,
        phone: input.phone ?? null,
        cep: input.cep,
        street: input.street,
        number: input.number,
        complement: input.complement ?? null,
        district: input.district,
        city: input.city,
        state: input.state,
        reference: input.reference ?? null,
        ...(input.isDefault ? { isDefault: true } : {}),
      },
    });
  });
}

export async function deleteAddress(userId: string, addressId: string) {
  const address = await db.address.findFirst({ where: { id: addressId, userId }, select: { id: true, isDefault: true } });
  if (!address) throw notFound("Endereço não encontrado.");
  await db.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: addressId } });
    if (address.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}

export async function setDefaultAddress(userId: string, addressId: string) {
  const address = await db.address.findFirst({ where: { id: addressId, userId }, select: { id: true } });
  if (!address) throw notFound("Endereço não encontrado.");
  await db.$transaction([
    db.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    db.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);
}

/** Resumo do painel "Minha conta". */
export async function getAccountDashboard(userId: string) {
  const [orders, ordersCount, wishlistCount, unreadNotifications, pendingReviews, addressesCount] = await Promise.all([
    db.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        number: true,
        status: true,
        totalCents: true,
        createdAt: true,
        store: { select: { name: true, isOfficial: true } },
        items: { take: 3, select: { productName: true, imageUrl: true, quantity: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where: { userId } }),
    db.wishlistItem.count({ where: { userId } }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.orderItem.count({ where: { reviewed: false, order: { userId, status: "DELIVERED" } } }),
    db.address.count({ where: { userId } }),
  ]);
  return { orders, ordersCount, wishlistCount, unreadNotifications, pendingReviews, addressesCount };
}

/** Favoritos (produtos) com dados de card. */
export async function listWishlistProductIds(userId: string, page = 1, pageSize = 24) {
  const [rows, total] = await Promise.all([
    db.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { productId: true } }),
    db.wishlistItem.count({ where: { userId } }),
  ]);
  return { productIds: rows.map((r) => r.productId), total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listFavoriteStores(userId: string) {
  return db.favoriteStore.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { store: { select: { id: true, name: true, slug: true, logoUrl: true, isOfficial: true, ratingAvg: true, ratingCount: true, salesCount: true } } },
  });
}

export async function listSessions(userId: string) {
  return db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: { id: true, createdAt: true, lastUsedAt: true, ipAddress: true, userAgent: true },
  });
}

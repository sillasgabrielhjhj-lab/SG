import type { CategoryNode } from "@/features/catalog/types";

export type HeaderUser = { name: string; email: string; role: "CUSTOMER" | "SELLER" | "ADMIN" | "SUPPORT"; hasStore: boolean };

export type HeaderData = {
  user: HeaderUser | null;
  cartCount: number;
  unreadNotifications: number;
  categories: CategoryNode[];
  sandbox: boolean;
};

"use server";

import { redirect } from "next/navigation";
import { destroyCurrentSession } from "@/server/auth/session";

/** Encerra a sessão atual e volta para a home. Usar em <form action={logoutAction}>. */
export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/");
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Credenciales = z.object({
  email: z.email(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export type LoginState = { error?: string; info?: string };

export async function autenticar(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = Credenciales.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Revisa el correo y la contraseña (mínimo 8 caracteres)." };

  const supabase = await createClient();
  if (form.get("modo") === "registro") {
    const { data, error } = await supabase.auth.signUp(parsed.data);
    if (error) return { error: error.message };
    if (!data.session) return { info: "Revisa tu correo para confirmar la cuenta." };
  } else {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "Correo o contraseña incorrectos." };
  }
  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

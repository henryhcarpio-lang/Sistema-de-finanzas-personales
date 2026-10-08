import { Ajustes } from "@/components/Ajustes";
import { obtenerAjustes } from "@/lib/queries";
import { requireUser } from "@/lib/supabase/server";

export default async function ConfiguracionPage() {
  const [ajustes, { user }] = await Promise.all([obtenerAjustes(), requireUser()]);
  return (
    <div className="space-y-2 lg:max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
      <Ajustes inicial={ajustes} correo={user.email ?? ""} />
    </div>
  );
}

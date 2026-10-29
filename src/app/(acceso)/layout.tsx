import { Marca } from "@/components/marca";

/** Pantallas sin sesión (entrar, registrarse, recuperar): una tarjeta centrada. */
export default function LayoutAcceso({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Marca grande />
      </div>
      {children}
    </main>
  );
}

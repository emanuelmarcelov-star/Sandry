import { Store } from "lucide-react";
import { textos } from "@/lib/textos";

export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-bold">
      <span
        className={
          grande
            ? "flex size-16 items-center justify-center rounded-2xl bg-green-700 text-white"
            : "flex size-9 items-center justify-center rounded-lg bg-green-700 text-white"
        }
      >
        <Store className={grande ? "size-9" : "size-5"} aria-hidden />
      </span>
      {!grande && <span className="text-xl">{textos.app.nombre}</span>}
    </span>
  );
}

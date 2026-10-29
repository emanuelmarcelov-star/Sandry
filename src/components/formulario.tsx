import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "cn";
import { textos } from "@/lib/textos";

/** Etiqueta + campo + mensaje de error, con letras grandes. */
export function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  opcional,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-base">
        {etiqueta}
        {opcional && <span className="font-normal text-muted-foreground"> {textos.general.opcional}</span>}
      </Label>
      {children}
      {ayuda && !error && <p className="text-sm text-muted-foreground">{ayuda}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const ESTILOS = {
  error: { clase: "border-destructive/40 bg-destructive/10 text-destructive", Icono: CircleAlert },
  exito: { clase: "border-green-600/40 bg-green-600/10 text-green-800 dark:text-green-300", Icono: CircleCheck },
  info: { clase: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200", Icono: Info },
} as const;

/** Recuadro de aviso: error, éxito o información. */
export function Aviso({
  tipo,
  children,
  className,
}: {
  tipo: keyof typeof ESTILOS;
  children: React.ReactNode;
  className?: string;
}) {
  const { clase, Icono } = ESTILOS[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-3 text-base", clase, className)}>
      <Icono className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Lista desplegable nativa (funciona perfecto en celulares). */
export function Selector({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-12 w-full rounded-lg border border-input bg-background px-3 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

/** Casilla de verificación grande. */
export function Casilla({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return <input type="checkbox" className={cn("size-6 shrink-0 accent-primary", className)} {...props} />;
}

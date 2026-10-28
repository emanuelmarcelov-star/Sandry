/**
 * Todos los textos que se ven en la pantalla, en un solo lugar.
 * Para corregir una palabra de la app, se cambia aquí.
 */
export const textos = {
  app: {
    nombre: "Sandry",
    descripcion: "Ventas, inventario y ganancias de la tienda",
  },
  inicio: {
    bienvenida: "Bienvenida a Sandry",
    enConstruccion:
      "La aplicación está en construcción. Pronto podrás vender, registrar compras y ver tus ganancias desde aquí.",
    estadoBaseDatos: "Conexión con la base de datos",
    conectado: "Conectada",
    sinConfigurar: "Falta configurar (ver docs/FASE-1.md)",
    sinRespuesta: "No responde. Revisa la dirección y la clave de Supabase.",
    revisando: "Revisando…",
  },
  conexion: {
    sinInternet:
      "Sin conexión a internet. Lo que estás registrando queda guardado en este dispositivo y se enviará cuando vuelva la señal.",
  },
} as const;

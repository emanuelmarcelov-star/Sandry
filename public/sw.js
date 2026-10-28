// Service worker de Sandry.
// La tienda tiene internet estable, así que no guardamos la app completa sin
// conexión. Solo mostramos una página amable si se abre la app sin señal.
// Lo que se está registrando (carrito, compra en curso) se guarda aparte en el
// dispositivo (src/lib/borradores.ts).

const CACHE = "sandry-v1";
const PAGINA_SIN_CONEXION = "/sin-conexion.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.add(PAGINA_SIN_CONEXION)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(PAGINA_SIN_CONEXION)),
  );
});

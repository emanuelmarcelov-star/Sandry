import { vaciarProyecto } from "../db/ayuda";

/** Antes de las pruebas de flujos: deja la base de pruebas vacía. */
export default async function preparar() {
  await vaciarProyecto();
}

/**
 * Base de las clases de catálogo (estados, zonas, categorías, criticidades).
 *
 * Devolución del 02/06/2026 (ítem 4.5): no se usan enums; cada valor es un
 * registro de una tabla de catálogo y la entidad guarda el objeto (FK id_...).
 */
export class ElementoCatalogo {
  #id;
  #nombre;

  constructor(id, nombre) {
    this.#id = id;
    this.#nombre = nombre;
  }

  get id() { return this.#id; }
  get nombre() { return this.#nombre; }

  esIgualA(otro) {
    return otro instanceof ElementoCatalogo && otro.constructor === this.constructor && otro.id === this.#id;
  }

  toJSON() {
    return { id: this.#id, nombre: this.#nombre };
  }

  /** Valores fijos declarados como static en la subclase (EstadoSolicitud.ABIERTA, ...). */
  static valores() {
    return Object.values(this).filter((v) => v instanceof this);
  }

  static desdeId(id) {
    return ElementoCatalogo.buscar(this.valores(), id, this.name);
  }

  /** Busca un valor fijo del catálogo por id (para reconstruir desde la base). */
  static buscar(valores, id, nombreCatalogo) {
    const encontrado = valores.find((v) => v.id === Number(id));
    if (!encontrado) throw new Error(`Valor desconocido en ${nombreCatalogo}: ${id}`);
    return encontrado;
  }
}

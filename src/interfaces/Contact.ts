export interface Contact {
  id: string;
  nombre: string;
  color: string;
  telefono?: string;
  email?: string;
  notas?: string;
  total_deuda?: number; // (código antiguo) Calculado dinámicamente
  total_servicios?: number; // Cantidad de servicios en los que participa
  /** Pendiente de cobro como cadena decimal exacta, tal como la entrega la API. */
  deuda?: string;
  /** Parte vencida del pendiente. */
  vencido?: string;
  version?: number;
}

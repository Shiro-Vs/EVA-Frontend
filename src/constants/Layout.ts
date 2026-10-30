// Medidas del sistema de diseño de EVA (escala de 4 px). Los componentes compartidos las usan; las pantallas nuevas deberían hacer lo mismo.
// Objetivo: mismo tamaño para lo que cumple la misma función (botón, campo, ficha, tarjeta) en toda la app.

/** Radios: controles 16, tarjetas 24, tarjeta destacada 32, fichas/íconos 12–14, píldora 999. */
export const radius = { xs: 6, sm: 12, tile: 14, md: 16, lg: 24, hero: 32, pill: 999 } as const;

/** Espacios: separación entre elementos (gap) y relleno de tarjetas/pantallas. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Relleno lateral de toda pantalla. */
export const screenPadding = 24;

/** Zona táctil mínima (Material 48 dp / Apple 44 pt): si lo visible es más chico, se amplía con hitSlop. */
export const minTouch = 44;

/** Altura de controles. `compact` = botón en línea o cabecera; `regular` = botón de formulario; `field` = campo de texto. */
export const control = { compact: 44, regular: 56, field: 52 } as const;

/** Tipografía: nada por debajo de 11 (la barra inferior usa 10 por espacio y es la única excepción). */
export const fontSize = { micro: 10, caption: 11, small: 12, body: 14, base: 16, title: 20, display: 24 } as const;

/** Rellena hasta la zona táctil mínima un control visualmente más chico. */
export const hitSlopFor = (visible: number) => {
  const m = Math.max(0, Math.ceil((minTouch - visible) / 2));
  return { top: m, bottom: m, left: m, right: m };
};

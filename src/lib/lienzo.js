// Matemática del lienzo de las TVs (pura, testeada en scripts/check-tvclock-phases.mjs).
export const ANCHO_DISENO = 1920
export const ALTO_MIN = 900

// Pura (testeada en scripts/check-tvclock-phases.mjs): escala y tamaño del lienzo para una
// ventana. Por ancho; si la ventana es tan apaisada que el alto quedaría bajo el mínimo, se
// achica hasta que entre ese alto mínimo y el lienzo se ensancha en vez de recortarse.
export function medidasLienzo(anchoVentana, altoVentana) {
  const escala = Math.min(anchoVentana / ANCHO_DISENO, altoVentana / ALTO_MIN)
  return { escala, ancho: anchoVentana / escala, alto: altoVentana / escala }
}


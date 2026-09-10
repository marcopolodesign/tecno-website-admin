// Formato de plata en pesos argentinos, sin centavos — una sola vez para las pantallas de
// caja en vez de repetir el mismo Intl.NumberFormat en cada componente (MembershipPlans y
// Dashboard ya lo hacen cada uno por su cuenta; esto no los toca, es sólo para no sumar una
// cuarta copia).
export function formatARS(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '-'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

// Qué decirle a un socio que nunca vio esta modalidad, en el minuto de explicación antes de
// que arranque el reloj de la estación. Copy corto, en criollo, sin jerga de coach — lo lee
// alguien parado a dos metros de la TV mientras se acomoda.
import { esPorTiempo } from './formatos'

export function explicacionDeFormato(formato, { rondas, trabajoSeg, descansoSeg, ejerciciosPorMinuto } = {}) {
  const minutos = trabajoSeg ? Math.round(trabajoSeg / 60) : null

  switch (formato) {
    case 'AMRAP':
      return {
        titulo: 'AMRAP',
        texto: `Hacé la mayor cantidad de vueltas posible en ${minutos ?? 6} minutos, sin parar.`,
      }
    case 'EMOM':
      return (ejerciciosPorMinuto || 1) > 1
        ? {
            titulo: 'EMOM · varios por minuto',
            texto: 'Cada minuto hacés estos ejercicios seguidos. Lo que te sobra del minuto es tu descanso.',
          }
        : {
            titulo: 'EMOM · uno por minuto',
            texto: 'Arrancás un ejercicio nuevo cada minuto, en el minuto. Lo que te sobra del minuto es tu descanso.',
          }
    case 'Tabata':
      return {
        titulo: 'Tabata',
        texto: `${trabajoSeg ?? 20} segundos a fondo y ${descansoSeg ?? 10} de descanso, repetido ${rondas ?? 12} veces.`,
      }
    case 'A completar':
      return {
        titulo: 'A completar',
        texto: `Tenés ${minutos ?? 6} minutos para completar todo el trabajo, al orden y ritmo que prefieras.`,
      }
    case 'Series':
    default:
      return {
        titulo: 'Series',
        texto: 'Vos manejás tus tiempos: hacé las series y los descansos a tu ritmo.',
      }
  }
}

export const tieneReloj = (formato) => esPorTiempo(formato)

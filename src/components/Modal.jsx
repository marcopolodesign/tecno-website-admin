import Sidecart from './Sidecart'

/**
 * Compatibilidad: `Modal` ahora es un Sidecart.
 *
 * La plataforma tiene una sola forma de editar algo — un panel que entra por la derecha y flota
 * sobre el contenido. Este archivo existía antes de esa decisión y lo usan siete pantallas
 * (Leads, Coaches, Usuarios, Membresías, Configuración de lista de espera, Sedes, Vendedores),
 * con exactamente la misma API que el Sidecart.
 *
 * Así que en vez de tocar siete llamadas y dejar el archivo muerto, este reenvía. Ninguna
 * pantalla cambia una línea y todas quedan con el mismo panel. Cuando no queden llamadas a
 * `Modal`, este archivo se borra y no se pierde nada.
 *
 * Lo único que se traduce son los tamaños: los del modal describían una caja centrada y eran
 * más chicos, que es justamente el problema que el sidecart vino a resolver.
 */
const TAMANOS = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
  xl: 'md',
  '2xl': 'lg',
  '3xl': 'lg',
}

export default function Modal({ isOpen, onClose, title, subtitle, children, footer, size = 'lg' }) {
  return (
    <Sidecart
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={footer}
      size={TAMANOS[size] ?? 'md'}
    >
      {children}
    </Sidecart>
  )
}

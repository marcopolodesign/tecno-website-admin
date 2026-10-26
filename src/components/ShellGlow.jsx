// El resplandor del marco: cinco elipses ámbar y naranja difuminadas sobre el rojo.
//
// Va detrás del sidebar y del contenedor, así que sólo se ve en la franja del menú y en los
// 10px de canaleta que rodean al contenedor blanco. Ese recorte es lo que hace que el rojo
// sume sin invadir: el contenido nunca se lee sobre color.
//
// Un SVG y no divs con `filter: blur()` porque el blur de CSS se aplica por elemento y en
// Chrome cada capa se promueve a su propia textura de compositor a pantalla completa; acá
// las cinco elipses comparten un solo `feGaussianBlur` sobre el grupo. Además exporta bien
// si alguien imprime o captura la pantalla.
//
// `preserveAspectRatio="none"` a propósito: las manchas se estiran con la ventana y no hay
// nada legible adentro que se deforme.
export default function ShellGlow() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1440 980"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="shell-glow-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="72" />
        </filter>
      </defs>
      <g filter="url(#shell-glow-blur)" opacity="0.38">
        <ellipse cx="40" cy="20" rx="165" ry="120" fill="#F59E0B" />
        <ellipse cx="180" cy="300" rx="115" ry="150" fill="#F97316" />
        <ellipse cx="240" cy="620" rx="210" ry="280" fill="#7A100D" />
        <ellipse cx="10" cy="960" rx="200" ry="155" fill="#EA580C" />
        <ellipse cx="1330" cy="1015" rx="300" ry="120" fill="#F59E0B" />
      </g>
    </svg>
  )
}

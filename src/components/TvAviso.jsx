import { Component } from 'react'


// En la TV el SDK de Sentry no corre (Chrome 47 no tiene Proxy), así que un error de render dejaba
// la pantalla en blanco sin avisar. El boundary se lo pasa al aviso inline de index.html
// (window.__tvReportar), que pinta el cartel a pantalla completa y lo manda a Sentry por XHR.
export class TvErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    if (typeof window !== 'undefined' && window.__tvReportar) window.__tvReportar(error, info && info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    // El cartel lo dibuja el script inline; esto es el respaldo si ese script no está.
    return (
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, background: '#7f1d1d', color: '#fff', padding: 70, fontSize: 40, fontFamily: 'Arial, sans-serif' }}>
        La pantalla tuvo un error: {String(this.state.error && this.state.error.message)}
      </div>
    )
  }
}

// Las mismas pantallas bajo /tv/... en el host del CRM (preview, localhost) con el mismo boundary.
export function ConAvisoTv({ children }) {
  return (
    <TvErrorBoundary>
      <ErrorDePrueba />
      {children}
    </TvErrorBoundary>
  )
}

// ?tv-error-prueba=render — rompe el render a propósito para probar el boundary en la TV.
export function ErrorDePrueba() {
  if (typeof window !== 'undefined' && /[?&]tv-error-prueba=render\b/.test(window.location.search)) {
    throw new Error('Prueba TecnoFit: error forzado en el render')
  }
  return null
}

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'

// ─── Step machine ─────────────────────────────────────────────────────────────
// 'dni' → 'confirm_email' → 'change_email'? → 'create_password' → 'hub'
// or → 'receptionist'

const BRAND = '#F45F37'

function maskEmail(email) {
  const at = email.indexOf('@')
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const visible = local.slice(0, Math.min(6, local.length))
  const hidden = '*'.repeat(local.length - visible.length)
  return `${visible}${hidden}@${domain}`
}

// ─── Hub (post-login landing screen) ─────────────────────────────────────────

function Hub({ member, onShowQR, onScanQR, checkInDone }) {
  const statusActive = member?.membership_status === 'active'

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>T</div>
        <h1 style={styles.title}>Hola, {member?.first_name || 'socio'}</h1>
        {checkInDone && (
          <div style={styles.checkInBanner}>
            ✓ Ingreso registrado
          </div>
        )}

        <div
          style={{
            ...styles.badge,
            background: statusActive ? '#dcfce7' : '#fee2e2',
            color: statusActive ? '#166534' : '#991b1b',
          }}
        >
          {member?.membership_status === 'active'
            ? 'Membresía activa'
            : member?.membership_status === 'cancelled'
              ? 'Membresía cancelada'
              : 'Membresía vencida'}
        </div>

        <div style={styles.hubButtons}>
          <button style={{ ...styles.hubBtn, background: BRAND }} onClick={onShowQR}>
            <QrIcon />
            Mostrar mi QR
          </button>
          <button
            style={{ ...styles.hubBtn, background: '#1f2937' }}
            onClick={onScanQR}
          >
            <ScanIcon />
            Escanear QR
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────

function QRModal({ member, onClose }) {
  const statusActive = member?.membership_status === 'active'

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            ...styles.badge,
            background: statusActive ? '#dcfce7' : '#fee2e2',
            color: statusActive ? '#166534' : '#991b1b',
            marginBottom: 8,
          }}
        >
          {member?.membership_status === 'active'
            ? 'Membresía activa'
            : member?.membership_status === 'cancelled'
              ? 'Membresía cancelada'
              : 'Membresía vencida'}
        </div>
        <p style={styles.memberName}>
          {member?.first_name} {member?.last_name}
        </p>
        <div style={styles.qrWrapper}>
          <QRCodeSVG value={member.id} size={240} />
        </div>
        <p style={styles.hint}>Mostrá este código al ingresar al gimnasio</p>
        <button style={styles.closeBtn} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

function ScannerView({ onBack }) {
  const scannerRef = useRef(null)
  const [result, setResult] = useState(null) // null | { granted, member, reason }
  const [cameraError, setCameraError] = useState('')

  const startScanner = async () => {
    if (scannerRef.current) return
    setCameraError('')
    try {
      const scanner = new Html5Qrcode('member-access-qr-reader')
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}
      )
      scannerRef.current = scanner
    } catch {
      // Try front camera as fallback
      try {
        const scanner = new Html5Qrcode('member-access-qr-reader')
        await scanner.start(
          { facingMode: 'user' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess,
          () => {}
        )
        scannerRef.current = scanner
      } catch (err2) {
        setCameraError('No se pudo acceder a la cámara. Verificá los permisos.')
        console.error('Camera error:', err2)
      }
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {}
      scannerRef.current = null
    }
  }

  useEffect(() => {
    startScanner()
    return () => { stopScanner() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onScanSuccess = async (raw) => {
    // Pause immediately to prevent duplicate scans
    try { scannerRef.current?.pause() } catch {}

    // Extract UUID — handle both raw UUID and full URLs (/acceso?session=… or member QR)
    const uuidMatch = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    const uuid = uuidMatch?.[0]

    if (!uuid) {
      setResult({ granted: false, member: null, reason: 'Código no reconocido' })
      setTimeout(() => { setResult(null); try { scannerRef.current?.resume() } catch {} }, 4000)
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const { data: user, error } = await supabase
      .from('users')
      .select('first_name, last_name, membership_status, membership_end_date, membership_type')
      .eq('id', uuid)
      .single()

    if (error || !user) {
      setResult({ granted: false, member: null, reason: 'Código no reconocido' })
    } else if (user.membership_status === 'active' && user.membership_end_date >= today) {
      setResult({ granted: true, member: user })
    } else if (user.membership_status === 'cancelled') {
      setResult({ granted: false, member: user, reason: 'Membresía cancelada' })
    } else {
      setResult({ granted: false, member: user, reason: 'Membresía vencida' })
    }

    setTimeout(() => {
      setResult(null)
      try { scannerRef.current?.resume() } catch {}
    }, 4000)
  }

  if (result) {
    const bg = result.granted ? '#16a34a' : '#dc2626'
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <span style={{ fontSize: 80 }}>{result.granted ? '✓' : '✗'}</span>
        <h2 style={{ color: 'white', fontSize: 36, fontWeight: 800, margin: 0 }}>
          {result.granted ? 'ACCESO PERMITIDO' : 'ACCESO DENEGADO'}
        </h2>
        {result.member && (
          <p style={{ color: 'white', fontSize: 22, margin: 0 }}>
            {result.member.first_name} {result.member.last_name}
          </p>
        )}
        {result.reason && (
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, margin: 0 }}>
            {result.reason}
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <button style={styles.backBtn} onClick={onBack}>← Volver</button>
        <h2 style={{ ...styles.title, marginBottom: 24 }}>Escanear QR</h2>
        <div id="member-access-qr-reader" style={{ width: '100%' }} />
        {cameraError ? (
          <p style={{ color: '#dc2626', fontSize: 14, textAlign: 'center', marginTop: 16 }}>
            {cameraError}
          </p>
        ) : (
          <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 16 }}>
            Apuntá la cámara al código QR del socio
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// Look up public.users by auth_user_id (fast path) or email (first login),
// and link auth_user_id for future sessions.
async function lookupAndLinkUser(authUserId, email) {
  const SELECT = 'id, first_name, last_name, membership_status, membership_end_date, membership_type'

  // Fast path — already linked
  const { data: byAuth } = await supabase
    .from('users').select(SELECT).eq('auth_user_id', authUserId).single()
  if (byAuth) return byAuth

  // First login — find by email and write the link
  if (!email) return null
  const { data: byEmail } = await supabase
    .from('users').select(SELECT).eq('email', email.toLowerCase()).single()
  if (!byEmail) return null

  await supabase.from('users').update({ auth_user_id: authUserId }).eq('id', byEmail.id)
  return byEmail
}

// Broadcast a check-in event to the /check-in kiosk screen
function broadcastCheckIn(sessionId, memberInfo) {
  if (!sessionId) return Promise.resolve()
  return new Promise((resolve) => {
    const channel = supabase.channel(`checkin:${sessionId}`)
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'checkin',
          payload: {
            first_name: memberInfo.first_name,
            last_name: memberInfo.last_name,
            membership_status: memberInfo.membership_status,
            membership_end_date: memberInfo.membership_end_date ?? null,
            membership_type: memberInfo.membership_type ?? null,
          },
        })
        supabase.removeChannel(channel)
        resolve()
      }
    })
  })
}

export default function MemberAccess() {
  const [step, setStep] = useState('loading') // check session first
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [checkInDone, setCheckInDone] = useState(false)

  // Read ?session= from URL (set by /check-in QR)
  const sessionId = new URLSearchParams(window.location.search).get('session')

  // Form state
  const [dni, setDni] = useState('')
  const [fallbackEmail, setFallbackEmail] = useState('')
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newEmail2, setNewEmail2] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  // ── Check if already signed in ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const user = await lookupAndLinkUser(session.user.id, session.user.email)
        if (user) {
          setMember(user)
          if (sessionId) {
            await broadcastCheckIn(sessionId, user)
            setCheckInDone(true)
          }
          setStep('hub')
          return
        }
      }
      setStep('dni')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 1: DNI lookup ───────────────────────────────────────────────────────
  const handleDniSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'lookup-member-by-dni',
        { body: { dni: dni.trim() } }
      )
      if (fnError || data?.error) {
        setStep('fallback_email')
      } else {
        setMember(data) // { id, email_masked, first_name, membership_status }
        setStep('confirm_email')
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Sign in (returning members) ─────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: signInEmail.trim(),
        password: signInPassword,
      })
      if (signInErr) throw signInErr

      const user = await lookupAndLinkUser(data.user.id, data.user.email)
      if (user) {
        setMember(user)
        if (sessionId) {
          await broadcastCheckIn(sessionId, user)
          setCheckInDone(true)
        }
        setStep('hub')
      } else {
        setError('No encontramos tu perfil. Hablá con recepción.')
      }
    } catch (err) {
      setError(err.message || 'Email o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1b: Email fallback ──────────────────────────────────────────────────
  const handleEmailFallback = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'lookup-member-by-email',
        { body: { email: fallbackEmail.trim(), pending_dni: dni.trim() } }
      )
      if (fnError || data?.error) {
        setError(data?.error || 'No encontramos un socio con ese email. Hablá con recepción.')
      } else {
        setMember(data) // { id, email_masked, first_name, membership_status, source: 'email', pending_dni }
        setStep('confirm_email')
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2b: Change email ────────────────────────────────────────────────────
  const handleEmailChange = async (e) => {
    e.preventDefault()
    setError('')
    if (newEmail !== newEmail2) {
      setError('Los emails no coinciden.')
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ email: newEmail.trim().toLowerCase() })
        .eq('id', member.id)
      if (updateError) throw updateError
      setMember((prev) => ({ ...prev, email: newEmail.trim().toLowerCase() }))
      setStep('create_password')
    } catch {
      setError('No se pudo actualizar el email. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Create password / sign up ────────────────────────────────────────
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setLoading(true)

    // Determine email to use (may have been updated in step 2b)
    const email = member.email || (() => {
      // email_masked isn't the real email — we need it from the DB
      // If they didn't change email, we must fetch it via service-role
      return null
    })()

    try {
      // Fetch actual email if we only have the masked version
      let realEmail = member.email
      if (!realEmail) {
        const { data: userRow } = await supabase
          .from('users')
          .select('email')
          .eq('id', member.id)
          .single()
        realEmail = userRow?.email
      }

      if (!realEmail) {
        setError('No se encontró el email. Hablá con recepción.')
        setLoading(false)
        return
      }

      // Create auth account, or update password if account already exists
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email: realEmail,
          password,
          email_confirm: true,
        })

      if (createErr) {
        // 422 = user already registered — update their password instead
        if (createErr.status === 422 || createErr.message?.toLowerCase().includes('already')) {
          const { data: userRow } = await supabase
            .from('users').select('auth_user_id').eq('id', member.id).single()

          const existingAuthId = userRow?.auth_user_id

          if (existingAuthId) {
            const { error: updateErr } = await supabase.auth.admin.updateUserById(
              existingAuthId, { password }
            )
            if (updateErr) throw updateErr
          } else {
            // auth_user_id not set yet — look it up via admin API by email
            const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
            const authUser = authUsers?.find(u => u.email?.toLowerCase() === realEmail.toLowerCase())
            if (!authUser) throw new Error('No se encontró la cuenta. Hablá con recepción.')
            await supabase.auth.admin.updateUserById(authUser.id, { password })
          }
        } else {
          throw createErr
        }
      }

      // Sign in with the new password
      const { data: signInData, error: signInErr } =
        await supabase.auth.signInWithPassword({ email: realEmail, password })
      if (signInErr) throw signInErr

      // Link auth_user_id + sync DNI/central_cliente_id back to Supabase
      const authUserId = signInData.user?.id
      if (authUserId && member.id) {
        const updatePayload = { auth_user_id: authUserId }
        if (member.source === 'central' && member.dni) {
          updatePayload.dni = member.dni
          if (member.central_cliente_id) updatePayload.central_cliente_id = member.central_cliente_id
        }
        if (member.source === 'email' && member.pending_dni) {
          updatePayload.dni = member.pending_dni
        }
        await supabase.from('users').update(updatePayload).eq('id', member.id)
      }

      // Fetch fresh member data
      const { data: freshUser } = await supabase
        .from('users')
        .select('id, first_name, last_name, membership_status, membership_end_date, membership_type')
        .eq('id', member.id)
        .single()

      setMember(freshUser)
      if (sessionId) {
        await broadcastCheckIn(sessionId, freshUser)
        setCheckInDone(true)
      }
      setStep('hub')
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (showScanner) return <ScannerView onBack={() => setShowScanner(false)} />

  // ── Render ───────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div style={{ ...styles.page, justifyContent: 'center' }}>
        <div style={styles.spinner} />
      </div>
    )
  }

  if (step === 'hub') {
    return (
      <>
        <Hub
          member={member}
          onShowQR={() => setShowQR(true)}
          onScanQR={() => setShowScanner(true)}
          checkInDone={checkInDone}
        />
        {showQR && <QRModal member={member} onClose={() => setShowQR(false)} />}
      </>
    )
  }

  if (step === 'receptionist') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🙋</div>
          <h2 style={styles.title}>Hablá con recepción</h2>
          <p style={{ color: '#6b7280', textAlign: 'center', lineHeight: 1.5 }}>
            Por favor dirigite a la recepción para que podamos actualizar tus datos.
          </p>
          <button style={{ ...styles.btn, marginTop: 24 }} onClick={() => setStep('dni')}>
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>T</div>

        {/* ── Sign in ── */}
        {step === 'sign_in' && (
          <>
            <h1 style={styles.title}>Iniciar sesión</h1>
            <p style={styles.subtitle}>Ingresá con tu email y contraseña</p>
            <form style={styles.form} onSubmit={handleSignIn}>
              <input
                style={styles.input}
                type="email"
                placeholder="tu@email.com"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                required
                autoFocus
              />
              <input
                style={styles.input}
                type="password"
                placeholder="Contraseña"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                required
              />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <button
                type="button"
                style={styles.backBtn}
                onClick={() => { setStep('dni'); setError('') }}
              >
                ← Volver
              </button>
            </form>
          </>
        )}

        {/* ── Email fallback ── */}
        {step === 'fallback_email' && (
          <>
            <h1 style={styles.title}>No encontramos tu DNI</h1>
            <p style={styles.subtitle}>Ingresá el email con el que te registraste</p>
            <form style={styles.form} onSubmit={handleEmailFallback}>
              <input
                style={styles.input}
                type="email"
                placeholder="tu@email.com"
                value={fallbackEmail}
                onChange={(e) => setFallbackEmail(e.target.value)}
                required
                autoFocus
              />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Buscando...' : 'Continuar'}
              </button>
              <button
                type="button"
                style={styles.backBtn}
                onClick={() => { setStep('dni'); setError(''); setFallbackEmail('') }}
              >
                ← Volver a DNI
              </button>
            </form>
          </>
        )}

        {/* ── DNI ── */}
        {step === 'dni' && (
          <>
            <h1 style={styles.title}>Acceso TecnoFit</h1>
            <p style={styles.subtitle}>Ingresá tu DNI para continuar</p>
            <form style={styles.form} onSubmit={handleDniSubmit}>
              <input
                style={styles.input}
                type="text"
                inputMode="numeric"
                placeholder="Ej: 38123456"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                required
                autoFocus
              />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Buscando...' : 'Continuar'}
              </button>
            </form>
            <button
              type="button"
              style={{ ...styles.backBtn, marginTop: 8 }}
              onClick={() => { setStep('sign_in'); setError('') }}
            >
              Ya tengo cuenta →
            </button>
          </>
        )}

        {/* ── Confirm email ── */}
        {step === 'confirm_email' && (
          <>
            <h1 style={styles.title}>¿Es este tu email?</h1>
            <p style={{ ...styles.subtitle, fontWeight: 600, fontSize: 18 }}>
              {member?.email_masked}
            </p>
            <div style={styles.optionList}>
              <button
                style={{ ...styles.optionBtn, borderColor: '#16a34a', color: '#16a34a' }}
                onClick={() => setStep('create_password')}
              >
                Sí, ese es mi email
              </button>
              <button
                style={{ ...styles.optionBtn }}
                onClick={() => setStep('change_email')}
              >
                Sí, pero quiero cambiarlo
              </button>
              <button
                style={{ ...styles.optionBtn, borderColor: '#dc2626', color: '#dc2626' }}
                onClick={() => setStep('receptionist')}
              >
                No es correcto → hablar con recepcionista
              </button>
            </div>
          </>
        )}

        {/* ── Change email ── */}
        {step === 'change_email' && (
          <>
            <h1 style={styles.title}>Nuevo email</h1>
            <form style={styles.form} onSubmit={handleEmailChange}>
              <input
                style={styles.input}
                type="email"
                placeholder="nuevo@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                autoFocus
              />
              <input
                style={styles.input}
                type="email"
                placeholder="Confirmar email"
                value={newEmail2}
                onChange={(e) => setNewEmail2(e.target.value)}
                required
              />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Actualizando...' : 'Confirmar email'}
              </button>
              <button
                type="button"
                style={styles.backBtn}
                onClick={() => setStep('confirm_email')}
              >
                ← Volver
              </button>
            </form>
          </>
        )}

        {/* ── Create password ── */}
        {step === 'create_password' && (
          <>
            <h1 style={styles.title}>Creá tu contraseña</h1>
            <p style={styles.subtitle}>Usarás esta contraseña para entrar a la app</p>
            <form style={styles.form} onSubmit={handlePasswordSubmit}>
              <input
                style={styles.input}
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                minLength={6}
              />
              <input
                style={styles.input}
                type="password"
                placeholder="Confirmar contraseña"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={6}
              />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta y ver mi QR'}
              </button>
              <button
                type="button"
                style={styles.backBtn}
                onClick={() => setStep('confirm_email')}
              >
                ← Volver
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function QrIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h1v1h-1zM17 14h1v1h-1zM14 17h1v1h-1zM17 17h3v3h-3z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f7f7fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '24px 16px',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '40px 32px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 13,
    background: BRAND,
    color: 'white',
    fontSize: 26,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#111827',
    margin: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    margin: 0,
    textAlign: 'center',
  },
  badge: {
    padding: '6px 16px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%',
    padding: '13px',
    borderRadius: 10,
    border: 'none',
    background: BRAND,
    color: 'white',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: 14,
    cursor: 'pointer',
    alignSelf: 'center',
    marginTop: 4,
    padding: '6px 12px',
  },
  optionList: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  optionBtn: {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 10,
    border: '1.5px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    margin: 0,
    textAlign: 'center',
  },
  hubButtons: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },
  hubBtn: {
    width: '100%',
    padding: '18px 20px',
    borderRadius: 14,
    border: 'none',
    color: 'white',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  // QR modal
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 24,
  },
  modalCard: {
    background: '#fff',
    borderRadius: 20,
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
  memberName: {
    fontSize: 22,
    fontWeight: 700,
    color: '#111827',
    margin: 0,
    textAlign: 'center',
  },
  qrWrapper: {
    padding: 16,
    background: '#fff',
    border: '2px solid #f3f4f6',
    borderRadius: 12,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    margin: 0,
  },
  closeBtn: {
    padding: '10px 32px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  spinner: {
    width: 32,
    height: 32,
    border: `3px solid ${BRAND}`,
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  checkInBanner: {
    background: '#dcfce7',
    color: '#166534',
    borderRadius: 999,
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 600,
  },
}

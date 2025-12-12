import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Function called with method:', req.method)

    const body = await req.json()
    console.log('📦 Request body:', body)

    const { leadId } = body

    if (!leadId) {
      throw new Error('Lead ID is required')
    }

    console.log('🆔 Processing lead ID:', leadId)

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get lead data
    const { data: lead, error: leadError } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      throw new Error('Lead not found')
    }

    // Check if email was already sent
    if (lead.email_sent) {
      return new Response(
        JSON.stringify({ message: 'Email already sent to this lead' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log('📧 Lead data:', { id: lead.id, email: lead.email, name: lead.first_name })

    // Send welcome email to lead
    console.log('🚀 Sending welcome email...')
    const leadEmailResponse = await sendWelcomeEmail(lead)
    console.log('✅ Welcome email sent')

    // Send internal notification
    console.log('🚀 Sending internal notification...')
    const internalEmailResponse = await sendInternalNotification(lead)
    console.log('✅ Internal notification sent')

    // Update lead record to mark email as sent
    const { error: updateError } = await supabaseClient
      .from('leads')
      .update({ email_sent: true })
      .eq('id', leadId)

    if (updateError) {
      console.error('Error updating lead email_sent status:', updateError)
    }

    return new Response(
      JSON.stringify({
        message: 'Emails sent successfully',
        leadEmail: leadEmailResponse,
        internalEmail: internalEmailResponse
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in send-welcome-email function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function sendWelcomeEmail(lead: any) {
  console.log('📧 Preparing to send welcome email to:', lead.email)

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  console.log('🔑 RESEND_API_KEY exists:', !!RESEND_API_KEY)
  console.log('🔑 RESEND_API_KEY length:', RESEND_API_KEY?.length || 0)

  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured - check Edge Function environment variables')
  }

  const emailHtml = generateWelcomeEmailHtml(lead)
  console.log('📝 Email HTML length:', emailHtml.length)

  const emailPayload = {
    from: 'TecnoFit <onboarding@resend.dev>',
    to: [lead.email],
    subject: '¡Bienvenido a TecnoFit! - Tu viaje fitness comienza aquí',
    html: emailHtml,
  }

  console.log('📤 Sending email payload:', {
    from: emailPayload.from,
    to: emailPayload.to,
    subject: emailPayload.subject,
    htmlLength: emailPayload.html.length
  })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  })

  console.log('📡 Resend API response status:', response.status)

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Resend API error:', error)
    throw new Error(`Failed to send welcome email: ${error}`)
  }

  const result = await response.json()
  console.log('✅ Welcome email sent successfully:', result.id)
  return result
}

async function sendInternalNotification(lead: any) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured')
  }

  const emailHtml = generateInternalNotificationHtml(lead)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TecnoFit System <onboarding@resend.dev>',
      to: ['barralf.lucas@gmail.com'],
      subject: `Nuevo lead: ${lead.first_name} ${lead.last_name}`,
      html: emailHtml,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send internal notification: ${error}`)
  }

  return await response.json()
}

function generateWelcomeEmailHtml(lead: any) {
  const trainingGoals = {
    'perdida-peso': 'Pérdida de peso',
    'aumento-masa-muscular': 'Aumento de masa muscular',
    'mejora-resistencia': 'Mejora de resistencia',
    'tonificacion': 'Tonificación',
    'entrenamiento-funcional': 'Entrenamiento funcional',
    'preparacion-competencias': 'Preparación para competencias',
    'rehabilitacion-fisica': 'Rehabilitación física',
    'reduccion-estres': 'Reducción del estrés'
  }

  const goalText = trainingGoals[lead.training_goal] || lead.training_goal || 'entrenamiento personalizado'

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a TecnoFit</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #f59e0b 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; font-family: 'Inter', sans-serif;">
                ¡Bienvenido a TecnoFit!
              </h1>
              <p style="color: #ffffff; font-size: 16px; margin: 10px 0 0 0; opacity: 0.9;">
                Tu viaje fitness comienza aquí
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">
                ¡Hola ${lead.first_name}!
              </h2>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Gracias por contactarnos. Hemos recibido tu interés en <strong>${goalText}</strong> y estamos emocionados de ayudarte a alcanzar tus objetivos fitness.
              </p>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">
                  Tus datos registrados:
                </h3>
                <ul style="color: #4b5563; font-size: 14px; margin: 0; padding-left: 20px;">
                  <li><strong>Nombre:</strong> ${lead.first_name} ${lead.last_name || ''}</li>
                  <li><strong>Email:</strong> ${lead.email}</li>
                  <li><strong>Teléfono:</strong> ${lead.phone}</li>
                  <li><strong>Objetivo:</strong> ${goalText}</li>
                  ${lead.notes ? `<li><strong>Notas adicionales:</strong> ${lead.notes}</li>` : ''}
                </ul>
              </div>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 25px 0;">
                <strong>¿Qué sucede ahora?</strong><br>
                Uno de nuestros entrenadores especializados te contactará pronto para programar una consulta inicial gratuita y diseñar un plan personalizado que se adapte perfectamente a tus necesidades.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://wa.me/5491122977747?text=Hola,%20me%20gustar%C3%ADa%20agendar%20mi%20consulta%20inicial"
                   style="background: linear-gradient(135deg, #dc2626 0%, #f59e0b 100%);
                          color: #ffffff;
                          text-decoration: none;
                          padding: 15px 30px;
                          border-radius: 8px;
                          font-weight: 600;
                          font-size: 16px;
                          display: inline-block;
                          box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);">
                  📱 Agendar Consulta por WhatsApp
                </a>
              </div>

              <div style="border-top: 1px solid #e5e7eb; padding-top: 25px; margin-top: 25px;">
                <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">
                  ¿Por qué elegir TecnoFit?
                </h3>
                <ul style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li><strong>Entrenamiento completo en 40 minutos:</strong> 5 boxes funcionales para maximizar resultados</li>
                  <li><strong>Entrenadores certificados:</strong> Guía experta en cada sesión</li>
                  <li><strong>Instalaciones de primera:</strong> Equipamiento profesional en Costa Rica 5823, Buenos Aires</li>
                  <li><strong>Planes personalizados:</strong> Adaptados a tu nivel y objetivos específicos</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      <strong>Contacto:</strong> +54 9 11 2297-7747<br>
                      <strong>Dirección:</strong> Costa Rica 5823, Buenos Aires<br>
                      <strong>Web:</strong> <a href="https://somostecnofit.com" style="color: #dc2626; text-decoration: none;">somostecnofit.com</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      © 2024 TecnoFit. Todos los derechos reservados.<br>
                      Este email fue enviado porque te registraste en nuestro sitio web.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function generateInternalNotificationHtml(lead: any) {
  const trainingGoals = {
    'perdida-peso': 'Pérdida de peso',
    'aumento-masa-muscular': 'Aumento de masa muscular',
    'mejora-resistencia': 'Mejora de resistencia',
    'tonificacion': 'Tonificación',
    'entrenamiento-funcional': 'Entrenamiento funcional',
    'preparacion-competencias': 'Preparación para competencias',
    'rehabilitacion-fisica': 'Rehabilitación física',
    'reduccion-estres': 'Reducción del estrés'
  }

  const goalText = trainingGoals[lead.training_goal] || lead.training_goal || 'No especificado'
  const submittedAt = new Date(lead.created_at || lead.submitted_at).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuevo Lead - TecnoFit</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #f59e0b 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">
                🔔 Nuevo Lead Recibido
              </h1>
              <p style="color: #ffffff; font-size: 14px; margin: 5px 0 0 0; opacity: 0.9;">
                ${submittedAt}
              </p>
            </td>
          </tr>

          <!-- Lead details -->
          <tr>
            <td style="padding: 30px;">
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0;">
                  Información del Lead
                </h2>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <strong style="color: #374151;">Nombre:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                      ${lead.first_name} ${lead.last_name || ''}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <strong style="color: #374151;">Email:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                      <a href="mailto:${lead.email}" style="color: #dc2626; text-decoration: none;">${lead.email}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <strong style="color: #374151;">Teléfono:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                      <a href="https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}" style="color: #dc2626; text-decoration: none;">${lead.phone}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <strong style="color: #374151;">Objetivo:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                      ${goalText}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <strong style="color: #374151;">Fuente:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                      ${lead.source || 'website'}
                    </td>
                  </tr>
                  ${lead.notes ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #374151;">Notas:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #4b5563;">
                      ${lead.notes}
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <div style="text-align: center; margin: 25px 0;">
                <a href="https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=Hola%20${lead.first_name},%20gracias%20por%20contactarnos.%20Me%20gustar%C3%ADa%20agendar%20tu%20consulta%20inicial."
                   style="background: linear-gradient(135deg, #dc2626 0%, #f59e0b 100%);
                          color: #ffffff;
                          text-decoration: none;
                          padding: 12px 24px;
                          border-radius: 6px;
                          font-weight: 600;
                          font-size: 14px;
                          display: inline-block;
                          margin-right: 10px;">
                  📱 Contactar por WhatsApp
                </a>
                <a href="mailto:${lead.email}?subject=Consulta%20Inicial%20-%20TecnoFit&body=Hola%20${lead.first_name},%0A%0AGracias%20por%20tu%20inter%C3%A9s%20en%20TecnoFit.%20Me%20gustar%C3%ADa%20agendar%20tu%20consulta%20inicial%20gratuita.%0A%0A%C2%BFPodr%C3%ADas%20confirmarme%20tu%20disponibilidad%20para%20esta%20semana%3F%0A%0ASaludos,%0A"
                   style="background-color: #6b7280;
                          color: #ffffff;
                          text-decoration: none;
                          padding: 12px 24px;
                          border-radius: 6px;
                          font-weight: 600;
                          font-size: 14px;
                          display: inline-block;">
                  ✉️ Enviar Email
                </a>
              </div>

              <!-- UTM tracking info if available -->
              ${(lead.utm_source || lead.utm_medium || lead.utm_campaign) ? `
              <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
                <h3 style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                  📊 Información de Marketing
                </h3>
                <p style="color: #78350f; font-size: 12px; margin: 0; line-height: 1.4;">
                  ${lead.utm_source ? `Fuente: ${lead.utm_source}` : ''}
                  ${lead.utm_medium ? ` | Medio: ${lead.utm_medium}` : ''}
                  ${lead.utm_campaign ? ` | Campaña: ${lead.utm_campaign}` : ''}
                  ${lead.utm_term ? ` | Término: ${lead.utm_term}` : ''}
                  ${lead.utm_content ? ` | Contenido: ${lead.utm_content}` : ''}
                </p>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Sistema de Notificaciones TecnoFit<br>
                Lead ID: ${lead.id}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
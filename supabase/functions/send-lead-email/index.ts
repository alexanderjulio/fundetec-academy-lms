import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL')

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload?.record // Manejo seguro de nulidad

    if (!record) {
      return new Response(JSON.stringify({ error: 'No se encontró el registro' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Lógica para enviar correo vía Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Fundetec Leads <onboarding@resend.dev>', // Importante: Cambiar al verificar dominio
        to: [NOTIFICATION_EMAIL],
        subject: `🔥 Nuevo Lead: ${record.full_name}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #0c1e45; border-radius: 10px; max-width: 600px; margin: auto;">
            <h2 style="color: #0c1e45; border-bottom: 2px solid #f5a623; padding-bottom: 10px;">¡Nuevo Interesado Registrado!</h2>
            <p style="font-size: 16px;">Se ha recibido una nueva solicitud a través del formulario de la landing page:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Nombre:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${record.full_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Programa:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${record.program_of_interest}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>WhatsApp:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                  <a href="https://wa.me/${record.whatsapp?.replace(/\+/g, '')}" style="color: #10b981; font-weight: bold;">
                    ${record.whatsapp}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${record.email}</td>
              </tr>
            </table>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px;">
              <strong style="color: #0c1e45;">Mensaje del interesado:</strong><br />
              <p style="color: #475569; font-style: italic;">"${record.message_detail || 'Sin mensaje adicional.'}"</p>
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; text-align: center;">
              Este es un mensaje automático de Fundetec Academy CRM.
            </p>
          </div>
        `
      }),
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    })
  }
})

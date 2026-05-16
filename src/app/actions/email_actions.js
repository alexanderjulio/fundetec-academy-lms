'use server';

import { Resend } from 'resend';
import { google } from 'googleapis';

// Inicializamos Resend solo si la clave existe para evitar errores en compilación
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendLeadNotification(leadData) {
  if (!resend) {
    console.error('RESEND_API_KEY no configurada en el servidor.');
    return { success: false, error: 'Servicio de correo no configurado.' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Fundetec Academy <admisiones@fundetec.co>',
      to: ['info@fundetec.co'],
      bcc: ['alexjuliosanchez@gmail.com'],
      subject: `🚨 Nuevo Prospecto: ${leadData.full_name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #0C1E45; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">¡Nuevo Lead Recibido!</h1>
            <p style="margin: 10px 0 0; opacity: 0.8;">Un nuevo interesado ha enviado sus datos desde la landing page.</p>
          </div>
          
          <div style="padding: 30px; color: #333;">
            <div style="margin-bottom: 25px;">
              <p style="margin: 0; font-weight: bold; color: #16A34A; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Nombre Completo</p>
              <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">${leadData.full_name}</p>
            </div>
            
            <div style="margin-bottom: 25px;">
              <p style="margin: 0; font-weight: bold; color: #16A34A; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">WhatsApp</p>
              <p style="margin: 5px 0; font-size: 18px;"><a href="https://wa.me/${leadData.whatsapp.replace(/\D/g, '')}" style="color: #0C1E45; text-decoration: none; font-weight: bold;">${leadData.whatsapp}</a></p>
            </div>
            
            <div style="margin-bottom: 25px;">
              <p style="margin: 0; font-weight: bold; color: #16A34A; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Correo Electrónico</p>
              <p style="margin: 5px 0; font-size: 18px;">${leadData.email}</p>
            </div>
            
            <div style="margin-bottom: 25px;">
              <p style="margin: 0; font-weight: bold; color: #16A34A; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Programa de Interés</p>
              <span style="display: inline-block; padding: 5px 12px; background-color: #f0fdf4; color: #16A34A; border-radius: 20px; font-weight: bold; font-size: 14px;">${leadData.program_of_interest}</span>
            </div>
            
            <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #0C1E45;">
              <p style="margin: 0; font-weight: bold; color: #0C1E45; font-size: 12px; text-transform: uppercase; margin-bottom: 10px;">Mensaje / Consulta</p>
              <p style="margin: 0; font-style: italic; line-height: 1.6;">"${leadData.message_detail || 'No se incluyó un mensaje específico.'}"</p>
            </div>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p style="margin: 0;">Este es un aviso automático de tu plataforma <strong>Fundetec Academy</strong>.</p>
            <p style="margin: 5px 0 0;"><a href="https://fundetec.co/admin/leads" style="color: #0C1E45; font-weight: bold;">Gestionar en el CRM</a></p>
          </div>
        </div>
      `
    });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Email Action Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Registra un lead en Google Sheets.
 * Requiere en .env.local:
 *   GOOGLE_CLIENT_EMAIL  — email de la Service Account
 *   GOOGLE_PRIVATE_KEY   — clave privada (con \n literales)
 *   GOOGLE_SHEET_ID      — ID del spreadsheet
 */
export async function appendLeadToSheet(leadData) {
  const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID } = process.env;

  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    console.warn('Google Sheets no configurado — faltan variables de entorno.');
    return { success: false, error: 'Sheets no configurado.' };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'Leads!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          fecha,
          leadData.full_name,
          leadData.whatsapp,
          leadData.email,
          leadData.program_of_interest,
          leadData.message_detail || '',
        ]],
      },
    });

    return { success: true };
  } catch (err) {
    console.error('Error al escribir en Google Sheets:', err.message);
    return { success: false, error: err.message };
  }
}

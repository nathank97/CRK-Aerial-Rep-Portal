/**
 * Email service — stubbed until EmailJS credentials are configured.
 * Replace EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, and template IDs
 * with real values from your EmailJS dashboard.
 */

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? ''
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? ''
const CONFIGURED = SERVICE_ID && PUBLIC_KEY

async function send(templateId, params) {
  if (!CONFIGURED) {
    console.log('[EmailJS stub] Would send email:', { templateId, params })
    return { status: 200, text: 'stub' }
  }
  const emailjs = await import('@emailjs/browser')
  return emailjs.send(SERVICE_ID, templateId, params, PUBLIC_KEY)
}

export const emailService = {
  sendQuote: (params) => send('template_quote', params),
  sendInvoice: (params) => send('template_invoice', params),
  sendLeadAssigned: (params) => send('template_lead_assigned', params),
  sendOrderUpdate: (params) => send('template_order_update', params),
  sendLowStock: (params) => send('template_low_stock', params),
  isConfigured: () => CONFIGURED,
}

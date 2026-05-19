import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'CRK Aerial <noreply@crkaerial.com>'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, subject, body, pdfBase64, pdfFilename } = req.body

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, body' })
  }

  const attachments = pdfBase64 && pdfFilename
    ? [{ filename: pdfFilename, content: Buffer.from(pdfBase64, 'base64') }]
    : []

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      text: body,
      attachments,
    })

    if (error) {
      console.error('[send-email] Resend error:', error)
      return res.status(400).json({ error: error.message || 'Resend error' })
    }

    return res.status(200).json({ id: data.id })
  } catch (err) {
    console.error('[send-email] Exception:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

import { useState, useEffect } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { emailTemplatesDoc } from '../firebase/firestore'

export const DEFAULT_QUOTE_SUBJECT = 'Quote {{quoteNumber}} from CRK Aerial'
export const DEFAULT_QUOTE_BODY = `Hi {{customerName}},

Please find your quote {{quoteNumber}} attached for review.

Project: {{projectName}}
Total: {{total}}

Don't hesitate to reach out with any questions.

{{dealerName}}
CRK Aerial`

export function fillTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{{${key}}}`, val ?? ''),
    template
  )
}

export function useEmailTemplate() {
  const [template, setTemplate] = useState({
    quoteSubject: DEFAULT_QUOTE_SUBJECT,
    quoteBody: DEFAULT_QUOTE_BODY,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(emailTemplatesDoc, (snap) => {
      if (snap.exists()) {
        setTemplate({
          quoteSubject: snap.data().quoteSubject || DEFAULT_QUOTE_SUBJECT,
          quoteBody: snap.data().quoteBody || DEFAULT_QUOTE_BODY,
        })
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return { template, loading }
}

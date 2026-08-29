import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recipients, message } = await req.json()

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: '수신자 목록이 비어있습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: '메시지를 입력하세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('ALIGO_API_KEY')
    const userId = Deno.env.get('ALIGO_USER_ID')
    const sender = Deno.env.get('ALIGO_SENDER')

    if (!apiKey || !userId || !sender) {
      return new Response(
        JSON.stringify({ error: '서버 환경변수가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []
    for (const phone of recipients) {
      const digits = String(phone).replace(/\D/g, '')
      if (!digits) continue

      const body = new URLSearchParams()
      body.append('key', apiKey)
      body.append('user_id', userId)
      body.append('sender', sender)
      body.append('receiver', digits)
      body.append('msg', message)
      body.append('msg_type', 'SMS')

      const res = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        body,
      })

      const result = await res.json()
      results.push({ phone: digits, result })
    }

    return new Response(
      JSON.stringify({ success: true, sent: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

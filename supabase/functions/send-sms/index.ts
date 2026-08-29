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

    const apiKey = Deno.env.get('ALIMTALK_API_KEY')
    const apiSecret = Deno.env.get('ALIMTALK_API_SECRET')
    const senderKey = Deno.env.get('ALIMTALK_SENDER_KEY')

    if (!apiKey || !apiSecret || !senderKey) {
      return new Response(
        JSON.stringify({ error: '서버 환경변수가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validRecipients = recipients
      .map((p: unknown) => String(p).replace(/\D/g, ''))
      .filter(Boolean)

    if (validRecipients.length === 0) {
      return new Response(
        JSON.stringify({ error: '유효한 전화번호가 없습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const credentials = btoa(`${apiKey}:${apiSecret}`)

    const res = await fetch('https://api.coolsms.co.kr/kakao/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: validRecipients.map((phone) => ({
          to: phone,
          text: message,
          kakaoOptions: {
            pfId: senderKey,
          },
        })),
      }),
    })

    const result = await res.json()

    return new Response(
      JSON.stringify({ success: true, sent: validRecipients.length, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

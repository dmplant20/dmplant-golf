import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { image, currency, lang } = await req.json()

  const currencyName = { KRW: '한국 원(₩)', VND: '베트남 동(₫)', IDR: '인도네시아 루피아(Rp)' }[currency as string] ?? '원'
  const isKo = lang === 'ko'

  const prompt = isKo
    ? `이 영수증 이미지를 분석해서 품목과 금액을 JSON으로 추출해줘. 통화 단위는 ${currencyName}야. 형식: { "items": [{ "description": "품목명", "amount": 숫자 }] }. JSON만 반환해.`
    : `Analyze this receipt image and extract items and amounts as JSON. Currency is ${currencyName}. Format: { "items": [{ "description": "item name", "amount": number }] }. Return JSON only.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
        { type: 'text', text: prompt }
      ]
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ items: [] })

  try {
    const parsed = JSON.parse(match[0])
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ items: [] })
  }
}

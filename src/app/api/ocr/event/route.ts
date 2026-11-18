import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { image, mediaType, lang } = await req.json()
  const imgType = (mediaType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const isKo = lang === 'ko'
  const prompt = isKo
    ? `이 이미지는 청첩장, 부고장, 또는 경조사 안내(돌잔치, 환갑, 칠순, 승진 축하 등)일 수 있어. 다음 항목을 JSON으로 추출해줘:
{
  "type": "wedding | condolence | birth | birthday | promotion | other",
  "title": "행사명 (예: 홍길동 · 김영희 결혼식)",
  "person_name": "당사자 이름들 (예: 신랑 홍길동 · 신부 김영희)",
  "date": "YYYY-MM-DD",
  "time": "HH:mm (24시간제)",
  "location_name": "예식장/장례식장 등 장소명",
  "contact": "연락처(전화번호)"
}
- 정보가 없으면 빈 문자열 ""로 두기.
- type 분류 기준: 결혼식=wedding, 부고/장례=condolence, 출산/돌잔치=birth, 환갑/칠순/팔순=birthday, 승진/취임=promotion, 그 외=other.
- JSON만 반환해.`
    : `This image may be a wedding invitation, funeral notice, or other life event announcement. Extract these fields as JSON:
{
  "type": "wedding | condolence | birth | birthday | promotion | other",
  "title": "event title",
  "person_name": "name(s) of person involved",
  "date": "YYYY-MM-DD",
  "time": "HH:mm (24-hour)",
  "location_name": "venue name",
  "contact": "phone or contact"
}
- Use empty string "" for unknown fields.
- Type: wedding/condolence/birth/birthday/promotion/other.
- Return JSON only.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: imgType, data: image } },
        { type: 'text', text: prompt }
      ]
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({})

  try {
    const parsed = JSON.parse(match[0])
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({})
  }
}

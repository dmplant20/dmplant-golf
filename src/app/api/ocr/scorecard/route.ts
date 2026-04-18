import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { image, members, lang } = await req.json()
  const isKo = lang === 'ko'

  const memberList = members.map((m: any) => `${m.full_name}(${m.full_name_en || ''}, ${m.name_abbr || ''})`).join(', ')

  const prompt = isKo
    ? `이 골프 스코어카드 이미지를 분석해서 각 선수의 스코어를 추출해줘.
회원 목록: ${memberList}
이름은 한글, 영문, 약자로 매칭해줘. 약자가 중복될 경우 candidates 배열에 넣어줘.
형식: { "scores": [{ "user_id": "매칭된user_id또는null", "name_found": "카드에서찾은이름", "score": 숫자, "candidates": [{"user_id":"","name":""}] }] }
JSON만 반환해.`
    : `Analyze this golf scorecard image and extract each player's score.
Members: ${memberList}
Match names by Korean, English, or abbreviation. If abbreviation is ambiguous, include candidates array.
Format: { "scores": [{ "user_id": "matched_user_id_or_null", "name_found": "name on card", "score": number, "candidates": [{"user_id":"","name":""}] }] }
Return JSON only.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
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
  if (!match) return NextResponse.json({ scores: [] })

  try {
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ scores: [] })
  }
}

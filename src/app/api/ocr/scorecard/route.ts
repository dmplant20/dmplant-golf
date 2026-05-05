import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { image, mediaType, members, lang } = await req.json()
  const imgType = (mediaType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  const isKo = lang === 'ko'

  // user_id 포함한 회원 목록 — Claude가 어떤 ID를 반환해야 할지 알 수 있도록
  const memberList = members.map((m: any) => {
    const parts: string[] = []
    if (m.full_name)    parts.push(m.full_name)         // 한글명: 최성복
    if (m.full_name_en) parts.push(m.full_name_en)      // 영문명: CHOI SUNGBOK
    if (m.name_abbr)    parts.push(m.name_abbr)         // 약자: CSB
    // 성씨만 / 이름만도 허용 (예: 최, 성복, CHOI, SUNGBOK)
    if (m.full_name && m.full_name.length >= 2) {
      parts.push(m.full_name[0])                        // 성: 최
      parts.push(m.full_name.slice(1))                  // 이름: 성복
    }
    if (m.full_name_en) {
      const enParts = m.full_name_en.split(' ')
      if (enParts.length > 1) {
        parts.push(enParts[0])                          // 성: CHOI
        parts.push(enParts.slice(1).join(' '))          // 이름: SUNGBOK
      }
    }
    return `[ID:${m.user_id}] ${[...new Set(parts)].join(' / ')}`
  }).join('\n')

  const prompt = isKo
    ? `이 골프 스코어카드 이미지를 분석해서 각 선수의 총 스코어(합계)를 추출해줘.

회원 목록 (ID와 매칭 가능한 모든 이름 형태):
${memberList}

매칭 규칙:
- 한글 이름, 영문 이름, 약자(이니셜), 성씨만, 이름만 — 어떤 형태든 매칭
- 대소문자 구분 없음
- 카드에 "CSB", "최성복", "CHOI", "SUNGBOK", "최" 어떤 형태로 써도 같은 사람
- 확실히 매칭되면 해당 [ID:...] 값을 user_id로 사용
- 모호하면 candidates 배열에 후보 나열
- 합계(total/tot/합/계) 점수 사용, 없으면 OUT+IN 합산

반환 형식 (JSON만):
{"scores":[{"user_id":"정확한ID또는null","name_found":"카드에서찾은이름","score":숫자,"candidates":[{"user_id":"","name":""}]}]}`
    : `Analyze this golf scorecard image and extract each player's TOTAL score.

Member list (ID with all possible name forms):
${memberList}

Matching rules:
- Match by Korean name, English name, abbreviation/initials, first name only, last name only — any form
- Case-insensitive matching
- "CSB", "최성복", "CHOI", "SUNGBOK", "최" on the card all refer to the same person
- Use the exact [ID:...] value as user_id when confident
- If ambiguous, list candidates
- Use total/TOT score; if missing, sum OUT+IN

Return JSON only:
{"scores":[{"user_id":"exactID_or_null","name_found":"name on card","score":number,"candidates":[{"user_id":"","name":""}]}]}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
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
  if (!match) return NextResponse.json({ scores: [] })

  try {
    const parsed = JSON.parse(match[0])
    // user_id 정제: [ID:xxx] 형식으로 반환된 경우 처리
    const scores = (parsed.scores ?? []).map((s: any) => ({
      ...s,
      user_id: s.user_id
        ? s.user_id.replace(/^\[?ID:|\]$/g, '').trim() || null
        : null,
    }))
    return NextResponse.json({ scores })
  } catch {
    return NextResponse.json({ scores: [] })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// HTML → 분석에 의미있는 텍스트로 정제
function extractText(html: string): { text: string; ogImage: string | null } {
  // og:image 추출
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  const ogImage = ogImageMatch?.[1] ?? null

  // og:title / og:description 우선 추출 (SPA에서도 잘 잡힘)
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? ''
  const ogDesc  = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? ''
  const docTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ''

  // <script>, <style> 제거
  let body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                 .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                 .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  // 태그 제거
  body = body.replace(/<[^>]+>/g, ' ')
  // HTML entity 디코딩 (간단)
  body = body.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  // 공백 정리
  body = body.replace(/\s+/g, ' ').trim()
  // 너무 길면 자르기 (Claude 입력 비용 절약)
  if (body.length > 8000) body = body.slice(0, 8000)

  const combined = [
    ogTitle && `[OG_TITLE] ${ogTitle}`,
    ogDesc  && `[OG_DESC] ${ogDesc}`,
    docTitle && `[TITLE] ${docTitle}`,
    body && `[BODY] ${body}`,
  ].filter(Boolean).join('\n\n')

  return { text: combined, ogImage }
}

export async function POST(req: NextRequest) {
  const { url, lang } = await req.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL이 필요합니다' }, { status: 400 })
  }
  // URL 유효성 검사
  let parsed: URL
  try { parsed = new URL(url) }
  catch { return NextResponse.json({ error: '올바르지 않은 URL입니다' }, { status: 400 }) }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'http(s)만 허용됩니다' }, { status: 400 })
  }

  // HTML fetch
  let html: string
  try {
    const r = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      // 타임아웃 안 잡으면 무한대기 — 8초로 자름
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return NextResponse.json({ error: `페이지 로드 실패 (${r.status})` }, { status: 502 })
    html = await r.text()
  } catch (e: any) {
    return NextResponse.json({ error: 'URL을 불러올 수 없습니다' }, { status: 502 })
  }

  const { text, ogImage } = extractText(html)
  if (!text) return NextResponse.json({}, { status: 200 })

  const isKo = lang === 'ko'
  const prompt = isKo
    ? `다음은 청첩장·부고장·경조사 안내 웹페이지에서 추출한 텍스트야. 핵심 항목을 JSON으로 추출해줘:
{
  "type": "wedding | condolence | birth | birthday | promotion | other",
  "title": "행사명",
  "person_name": "당사자 이름들",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "location_name": "장소명",
  "contact": "연락처"
}
- 정보가 없으면 "" (빈 문자열).
- type: 결혼=wedding, 부고=condolence, 출산/돌=birth, 환갑/칠순=birthday, 승진/취임=promotion.
- JSON만 반환.

──── 추출된 텍스트 ────
${text}`
    : `Below is text extracted from a Korean wedding/funeral/event invitation web page. Extract these fields as JSON:
{
  "type": "wedding | condolence | birth | birthday | promotion | other",
  "title": "...",
  "person_name": "...",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "location_name": "...",
  "contact": "..."
}
- Empty string "" for unknown.
- Return JSON only.

──── Extracted text ────
${text}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const out = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = out.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ ogImage })

  try {
    const parsedJson = JSON.parse(match[0])
    return NextResponse.json({ ...parsedJson, ogImage })
  } catch {
    return NextResponse.json({ ogImage })
  }
}

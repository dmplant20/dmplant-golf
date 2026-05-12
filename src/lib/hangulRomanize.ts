// 한글 → 로마자 변환 (Revised Romanization 기반)
// 골프장 영문 명단용 — 영문 이름이 없는 회원도 무조건 영어로 표기되도록.

// 초성 19개 (정확한 순서: ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ)
const INITIALS = [
  'g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h',
]
// 중성 21개 (ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ)
const VOWELS = [
  'a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i',
]
// 종성 28개 (0 = 받침 없음, 이후 ㄱ ㄲ ㄳ ㄴ ㄵ ㄶ ㄷ ㄹ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅁ ㅂ ㅄ ㅅ ㅆ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ)
const FINALS = [
  '','k','k','ks','n','nj','nh','t','l','lk','lm','lp','ls','lt','lp','lh','m','p','ps','s','ss','ng','j','ch','k','t','p','h',
]

// 한 글자(한글 한 음절)를 로마자로
export function romanizeSyllable(ch: string): string {
  const code = ch.charCodeAt(0)
  if (code < 0xAC00 || code > 0xD7A3) return ch
  const n = code - 0xAC00
  const i = Math.floor(n / 588)
  const v = Math.floor((n % 588) / 28)
  const f = n % 28
  return (INITIALS[i] ?? '') + (VOWELS[v] ?? '') + (FINALS[f] ?? '')
}

// 한글이 포함된 문자열 → 음절마다 로마자 변환 후 공백으로 구분, Title Case
// 예) '안한순'  → 'An Han Sun'
//     '함병우' → 'Ham Byeong U'
//     '성 김'  → 'Seong Kim'  (이미 공백 있으면 유지)
export function romanizeKoreanName(input: string): string {
  if (!input) return ''
  // 이미 영문이 섞여 있을 수도 있음 — 음절 단위로 처리
  const parts: string[] = []
  let current = ''
  for (const ch of input) {
    const code = ch.charCodeAt(0)
    if (code >= 0xAC00 && code <= 0xD7A3) {
      // 한글 음절 — 직전에 라틴 글자가 있었다면 분리
      if (current) { parts.push(current); current = '' }
      parts.push(romanizeSyllable(ch))
    } else if (/\s/.test(ch)) {
      if (current) { parts.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  // Title Case 적용
  return parts
    .filter(Boolean)
    .map(p => p.length > 0 ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p)
    .join(' ')
}

// 한글 문자가 남아있는지 확인 (영문 명단 검증용)
export function hasHangul(s: string): boolean {
  return /[가-힣]/.test(s ?? '')
}

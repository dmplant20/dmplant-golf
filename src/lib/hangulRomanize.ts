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

// 영문 이름 → 클럽 표준 포맷 (성 + 이름 통합)
//   "Baik dae jun"   → "Baik Daejun"
//   "Kim Jaehyun"    → "Kim Jaehyun"
//   "An Han Sun"     → "An Hansun"
//   "choi seong bok" → "Choi Seongbok"
//   "Lee Jong-Seok"  → "Lee Jongseok"  (하이픈 제거)
//
// 규칙:
//   ① 한글이 포함되어 있으면 먼저 romanizeKoreanName 으로 변환
//   ② 공백·하이픈으로 토큰 분리
//   ③ 1번째 토큰 = 성 (Title Case), 나머지 모두 합쳐서 첫 글자만 대문자 (Title Case)
//   ④ 토큰 1개이면 그대로 Title Case
export function formatKoreanEnglishName(input: string): string {
  if (!input) return ''
  // 한글이 섞여 있으면 먼저 로마자로
  const base = /[가-힣]/.test(input) ? romanizeKoreanName(input) : input
  const parts = base
    .replace(/[-_]+/g, ' ')      // 하이픈·언더스코어 → 공백
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return ''
  const cap = (s: string) => s.length > 0 ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s
  if (parts.length === 1) return cap(parts[0])
  const surname = cap(parts[0])
  const given   = cap(parts.slice(1).join('').toLowerCase())
  return `${surname} ${given}`
}

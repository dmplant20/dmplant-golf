// Tailwind text-gray-XXX 어두운 색 → 한 단계 밝게 (dark bg 대비)
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('src')
const exts = new Set(['.tsx', '.ts', '.jsx', '.js'])

// 어두운 → 밝게 (text-gray-700 → text-gray-400 정도)
const SWAPS = [
  ['text-gray-700', 'text-gray-400'],
  ['text-gray-600', 'text-gray-400'],
  ['text-gray-500', 'text-gray-400'],  // 500도 약간 어두움 → 400
]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (exts.has(path.extname(e.name))) out.push(p)
  }
  return out
}

const files = walk(ROOT)
let totalChanges = 0
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8')
  let changed = false
  for (const [from, to] of SWAPS) {
    // className 내부의 토큰만 매치 — \b 단어 경계 사용
    const esc = from.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    const re = new RegExp('\\b' + esc + '\\b', 'g')
    const before = src
    src = src.replace(re, to)
    if (src !== before) changed = true
  }
  if (changed) {
    const rel = path.relative(process.cwd(), f).split(path.sep).join('/')
    console.log('  ' + rel)
    fs.writeFileSync(f, src)
    totalChanges++
  }
}
console.log('\n총 ' + totalChanges + '개 파일 수정')

// 어두운 텍스트 색상 일괄 밝기 보정 — `color:` 컨텍스트만 매치
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('src')
const exts = new Set(['.tsx', '.ts', '.jsx', '.js', '.css'])

const SWAPS = [
  ['#5a7a5a', '#9aae9a'],
  ['#1a3a1a', '#5a7a5a'],
  ['#3a5a3a', '#7a9a7a'],
  ['#5c5650', '#7a7268'],
  ['#6b7280', '#94a3b8'],
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
    const esc = from.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    const reInline = new RegExp('(color\\s*:\\s*[\'"`])' + esc + '([\'"`])', 'gi')
    const reCss    = new RegExp('(color\\s*:\\s*)' + esc + '(\\s*;)', 'gi')
    const before = src
    src = src.replace(reInline, '$1' + to + '$2')
    src = src.replace(reCss, '$1' + to + '$2')
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

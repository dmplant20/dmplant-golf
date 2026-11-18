// 네이티브 앱 아이콘/스플래시 소스 생성 — @capacitor/assets 입력용.
// 실행: node scripts/gen-native-assets.mjs  → assets/ 에 PNG 생성
// 이후: npx @capacitor/assets generate
//
// 디자인: 금색(#c9a84c) 골프 엠블럼(깃발+홀+공+스텔라 스파클) / 다크(#0a0807) 배경.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'assets')
mkdirSync(OUT, { recursive: true })

const GOLD = '#c9a84c'
const DARK = '#0a0807'

// 엠블럼(중앙 정렬) — 1024 캔버스 기준 좌표
function emblem(scale = 1, cx = 512, cy = 512) {
  // 기준 엠블럼을 (512,520) 중심으로 그린 뒤 그룹 transform 로 배치/스케일
  return `
  <g transform="translate(${cx} ${cy}) scale(${scale}) translate(-512 -520)">
    <!-- 스텔라 스파클 -->
    <path d="M712 250 l20 60 60 20 -60 20 -20 60 -20 -60 -60 -20 60 -20 Z" fill="${GOLD}"/>
    <path d="M636 214 l9 27 27 9 -27 9 -9 27 -9 -27 -27 -9 27 -9 Z" fill="${GOLD}" opacity="0.75"/>
    <!-- 깃대 -->
    <rect x="500" y="330" width="24" height="366" rx="12" fill="${GOLD}"/>
    <!-- 페넌트 깃발 -->
    <path d="M524 344 L726 404 L524 464 Z" fill="${GOLD}"/>
    <!-- 홀(타원) -->
    <ellipse cx="512" cy="706" rx="156" ry="42" fill="none" stroke="${GOLD}" stroke-width="20"/>
    <!-- 골프공 -->
    <circle cx="416" cy="694" r="28" fill="${GOLD}"/>
  </g>`
}

function iconFullSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <radialGradient id="glow" cx="50%" cy="42%" r="60%">
        <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1024" height="1024" rx="224" fill="${DARK}"/>
    <rect width="1024" height="1024" rx="224" fill="url(#glow)"/>
    ${emblem(0.86, 512, 520)}
  </svg>`
}

function iconForegroundSvg() {
  // Android adaptive 전경 — 투명 배경, 안전영역(중앙 ~66%) 안에 배치
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${emblem(0.62, 512, 512)}
  </svg>`
}

function iconBackgroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="${DARK}"/>
  </svg>`
}

function splashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
    <defs>
      <radialGradient id="g2" cx="50%" cy="45%" r="45%">
        <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="2732" height="2732" fill="${DARK}"/>
    <rect width="2732" height="2732" fill="url(#g2)"/>
    <g transform="translate(1366 1230) scale(1.15) translate(-512 -520)">
      ${emblem(1, 512, 520).replace(/^\s*<g[^>]*>|<\/g>\s*$/g, '')}
    </g>
    <text x="1366" y="1720" text-anchor="middle" font-family="Georgia, serif" font-size="120" fill="${GOLD}" letter-spacing="6">INTER STELLAR GOLF</text>
  </svg>`
}

async function render(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(OUT, file))
  console.log('  ✓', file)
}

console.log('네이티브 에셋 생성 →', OUT)
await render(iconFullSvg(), 'icon.png', 1024)
await render(iconForegroundSvg(), 'icon-foreground.png', 1024)
await render(iconBackgroundSvg(), 'icon-background.png', 1024)
await render(splashSvg(), 'splash.png', 2732)
await render(splashSvg(), 'splash-dark.png', 2732)
console.log('완료. 다음: npx @capacitor/assets generate')

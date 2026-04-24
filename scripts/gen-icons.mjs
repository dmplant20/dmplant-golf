import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../public/icons')
mkdirSync(OUT, { recursive: true })

// ⛳ 골프 앱 아이콘 SVG (rounded square, green gradient)
// 512×512 기준 — sharp가 scale down
function makeSvg(size) {
  const r = Math.round(size * 0.22)   // corner radius
  const pad = Math.round(size * 0.13) // inner padding
  const inner = size - pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#14532d"/>
    </linearGradient>
  </defs>
  <!-- 배경 rounded rect -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <!-- 내부 여백 안에 ⛳ 이모지 텍스트 -->
  <text x="${size/2}" y="${size*0.72}" font-size="${inner*0.82}" text-anchor="middle" dominant-baseline="auto" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">⛳</text>
</svg>`
}

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of SIZES) {
  const svg = Buffer.from(makeSvg(size))
  const out = `${OUT}/icon-${size}.png`
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(out)
  console.log(`✓ icon-${size}.png`)
}

console.log('\n모든 아이콘 생성 완료 →', OUT)

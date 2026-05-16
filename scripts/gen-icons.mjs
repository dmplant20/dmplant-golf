// scripts/gen-icons.mjs
// public/icons/icon.svg + icon-maskable.svg → 모든 사이즈 PNG 생성
// 실행: node scripts/gen-icons.mjs   (sharp 가 devDependencies에 없으면: npm i -D sharp)
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../public/icons')

const svg          = await readFile(resolve(OUT, 'icon.svg'))
const svgMaskable  = await readFile(resolve(OUT, 'icon-maskable.svg'))

// 일반 (any) 아이콘
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
for (const size of SIZES) {
  const out = `${OUT}/icon-${size}.png`
  await sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
  console.log(`✓ icon-${size}.png`)
}

// maskable 변형 — manifest에 별도 등록 권장
for (const size of [192, 512]) {
  const out = `${OUT}/icon-${size}-maskable.png`
  await sharp(svgMaskable).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
  console.log(`✓ icon-${size}-maskable.png`)
}

console.log('\n모든 아이콘 생성 완료 →', OUT)
console.log('manifest.json의 maskable 항목을 icon-192-maskable.png / icon-512-maskable.png 로 교체하면 더 정교해집니다.')

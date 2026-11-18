const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const assert = require('node:assert/strict')
const test = require('node:test')
const source = readFileSync('src/middleware.ts','utf8')
const compiled = ts.transpileModule(source, { reportDiagnostics:true, compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 } })
assert.equal(compiled.diagnostics.length,0)
class Response {
  constructor(body,options={}) { this.body=body;this.status=options.status??200;this.headers=new Headers(options.headers) }
  static next() { return new Response(null) }
}
const moduleValue={ exports:{} }
vm.runInNewContext(compiled.outputText,{module:moduleValue,exports:moduleValue.exports,require(name){
  if(name==='next/server')return { NextResponse:Response }
  if(name==='@/lib/native')return { isNativeUA:ua=>ua.includes('InterStellarGolfApp') }
  throw new Error('Unexpected import')
}})
function run(url,ua='Android KAKAOTALK') {
 return moduleValue.exports.middleware({url,nextUrl:new URL(url),headers:new Headers({'user-agent':ua})})
}
test('general WebView handoff contains no external QR resource and never sends request URL to third parties',()=>{
 const result=run('https://synthetic.invalid/dashboard?arbitrary_secret=SYNTHETIC')
 assert.doesNotMatch(result.body,/api\.qrserver\.com|<img\b|https:\/\/(?!synthetic\.invalid)/)
 assert.equal(result.headers.get('referrer-policy'),'no-referrer')
 assert.match(result.body,/Chrome으로 바로 열기/)
})
test('request URL is escaped in HTML and cannot close the inline script',()=>{
 const result=run('https://synthetic.invalid/dashboard?x=\"><script>synthetic()</script>')
 assert.doesNotMatch(result.body,/<script>synthetic\(\)<\/script>/)
 assert.match(result.body,/&lt;script&gt;/)
 assert.match(result.body,/\\u003cscript>/)
})
for(const path of ['/reset-password','/reset-password?code=SYNTHETIC','/auth/callback?code=SYNTHETIC','/login?token_hash=SYNTHETIC','/?code=SYNTHETIC']){
 test(`recovery handoff bypass: ${path.split('?')[0]}`,()=>{
  const result=run('https://synthetic.invalid'+path)
  assert.equal(result.body,null)
  assert.equal(result.headers.get('referrer-policy'),'no-referrer')
 })
}
test('normal browser and official app behavior remains pass-through',()=>{
 for(const ua of ['Mozilla Chrome','Android InterStellarGolfApp WebView']) assert.equal(run('https://synthetic.invalid/dashboard',ua).body,null)
})
test('root layout prevents callback redirect and disables referrers',()=>{
 const root=readFileSync('src/app/layout.tsx','utf8')
 assert.match(root,/referrer: 'no-referrer'/)
 assert.match(root,/!standalone && !authCallback/)
 assert.match(root,/window.location.search \+ window.location.hash/)
})

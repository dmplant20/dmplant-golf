const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const assert = require('node:assert/strict')
const test = require('node:test')
function load(path, globals = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  assert.equal(compiled.diagnostics?.length ?? 0, 0, 'TypeScript syntax diagnostics')
  vm.runInNewContext(compiled.outputText, { exports: module.exports, module, ...globals })
  return module.exports
}
const helper = 'src/lib/auth/rememberedEmail.ts'
test('legacy password removed without ever reading it; session and remembered email preserved', () => {
  const storage = new Map([['isgolf-saved-pw', 'SYNTHETIC'], ['isgolf-saved-email', 'test@example.invalid'], ['sb-synthetic-auth-token', 'SYNTHETIC_SESSION']])
  const api = load(helper, { window: { localStorage: {
    getItem(key) { assert.notEqual(key, 'isgolf-saved-pw'); return storage.get(key) },
    removeItem(key) { storage.delete(key) },
    setItem(key, value) { assert.notEqual(key, 'isgolf-saved-pw'); storage.set(key,value) },
  } } })
  assert.equal(api.readRememberedEmail(), 'test@example.invalid')
  assert.equal(storage.has('isgolf-saved-pw'), false)
  assert.equal(storage.get('sb-synthetic-auth-token'), 'SYNTHETIC_SESSION')
  api.rememberEmail('new@example.invalid')
  assert.equal(api.readRememberedEmail(), 'new@example.invalid')
})
test('SSR and disabled storage do not break sign-in', () => {
  assert.equal(load(helper).readRememberedEmail(), '')
  const api = load(helper, { window: { get localStorage() { throw new Error('disabled') } } })
  assert.equal(api.readRememberedEmail(), '')
  api.rememberEmail('synthetic@example.invalid')
})
test('browser client preserves Supabase default session persistence/refresh configuration', () => {
  let cleared = false, calls = 0
  const api = load('src/lib/supabase/client.ts', { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic' } },
    require(name) {
      if (name === '@/lib/auth/rememberedEmail') return { clearLegacyPassword() { cleared = true } }
      if (name === '@supabase/ssr') return { createBrowserClient(...args) { assert.equal(cleared,true); assert.equal(args.length,2); calls++; return { synthetic: true } } }
      throw new Error('unexpected import')
    } })
  assert.equal(api.createClient().synthetic,true)
  assert.equal(calls,1)
})
test('email-only first-login is unconditionally closed and never accesses privileged SDK', async () => {
  const api = load('src/app/api/auth/first-login/route.ts', { require(name) {
    assert.equal(name, 'next/server')
    return { NextResponse: { json: (body, options) => ({ body, status: options.status }) } }
  } })
  const result = await api.POST({ json() { throw new Error('must not read input') } })
  assert.equal(result.status,403)
  assert.equal(result.body.code,'FIRST_LOGIN_DISABLED')
  assert.equal(result.body.token_hash,undefined)
})
test('login/reset/layout contain no stored-password replay or first-login token verification', () => {
  for (const path of ['src/app/(auth)/login/page.tsx','src/app/(auth)/reset-password/page.tsx','src/app/(app)/layout.tsx']) {
    const source = readFileSync(path,'utf8')
    assert.doesNotMatch(source,/isgolf-saved-pw|btoa\(|atob\(|token_hash|\/api\/auth\/first-login/)
  }
  assert.match(readFileSync('src/app/(app)/layout.tsx','utf8'),/supabase.auth.getUser\(\)/)
  assert.match(readFileSync('src/app/(auth)/login/page.tsx','utf8'),/autoComplete="current-password"/)
})

for (const route of ['admin/reset-password','admin/create-member']) {
  test(`${route}: privileged auth route is closed regardless of submitted membership`, async () => {
    const api = load(`src/app/api/${route}/route.ts`, { require(name) {
      assert.equal(name, 'next/server')
      return { NextResponse: { json: (body, options) => ({ body, status: options.status }) } }
    } })
    const result = await api.POST({ json() { throw new Error('must not read input or roles') } })
    assert.equal(result.status,403)
    assert.equal(result.body.password,undefined)
    assert.equal(result.body.tempPassword,undefined)
  })
}

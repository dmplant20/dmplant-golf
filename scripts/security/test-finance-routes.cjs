const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const assert = require('node:assert/strict')
const test = require('node:test')

function load(path, responses = []) {
  const queue = [...responses]
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'synthetic-user' } } }) },
    from() {
      assert.ok(queue.length, 'unexpected database query')
      const result = queue.shift()
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') return Promise.resolve(result).then.bind(Promise.resolve(result))
        return () => chain
      } })
      return chain
    } }
  const module = { exports: {} }
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    'next/headers': { cookies: async () => ({ getAll: () => [], set() {} }) },
    '@supabase/ssr': { createServerClient: () => db },
    '@supabase/supabase-js': { createClient: () => { throw new Error('unexpected privileged client') } },
    '@/lib/superAdmin': { isSuperAdmin: () => false },
  }
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  assert.equal(compiled.diagnostics?.length ?? 0, 0, 'TypeScript syntax diagnostics')
  vm.runInNewContext(compiled.outputText, { exports: module.exports, module,
    require: name => { assert.ok(mocks[name], `unexpected import ${name}`); return mocks[name] },
    process: { env: {} }, Date, console })
  return module.exports
}

for (const [route, body] of [
  ['finance/mark-fine-paid', { id: 'fine' }],
  ['scores/handicap', { club_id: 'club', target_user_id: 'synthetic-user', new_handicap: 10 }],
  ['scores/upsert', { club_id: 'club', year: 2026, month: 11, played_at: '2026-11-01', scores: [{ user_id: 'synthetic-user', gross_score: 90 }] }],
]) test(`${route}: missing service key fails before DB access`, async () => {
  const api = load(`src/app/api/${route}/route.ts`)
  assert.equal((await api.POST({ json: async () => body })).status, 503)
})

const memberships = { data: [{ club_id: 'club', fee_type: 'monthly', joined_at: null,
  clubs: { id: 'club', name: 'Synthetic', monthly_fee: 10, currency: 'KRW' } }] }
const ok = { data: [] }
const error = { data: null, error: { message: 'simulated denial' } }
const path = 'src/app/api/finance/my-unpaid/route.ts'
for (const [name, responses] of [
  ['membership failure', [error]],
  ['payment failure', [memberships, error]],
  ['meeting pattern failure', [memberships, ok, error]],
  ['meeting override failure', [memberships, ok, { data: { week_of_month: 1, day_of_week: 1 } }, error]],
  ['fine failure', [memberships, ok, { data: null }, error]],
  ['hidden embedded club', [{ data: [{ club_id: 'club', clubs: null }] }]],
]) test(`my-unpaid: ${name} never reports debt conclusions`, async () => {
  const result = await load(path, responses).GET({})
  assert.equal(result.status, 503)
  assert.equal(result.body.has_any, undefined)
})
test('my-unpaid: valid empty membership list is successful', async () => {
  const result = await load(path, [ok]).GET({})
  assert.equal(result.status, 200)
  assert.equal(result.body.has_any, false)
})
test('my-unpaid: actual unpaid fine remains visible', async () => {
  const result = await load(path, [{ data: [{ ...memberships.data[0], fee_type: null }] },
    { data: [{ amount: 20, description: '[미납] synthetic fine' }] }]).GET({})
  assert.equal(result.status, 200)
  assert.equal(result.body.has_any, true)
  assert.equal(result.body.unpaidFines[0].total, 20)
})

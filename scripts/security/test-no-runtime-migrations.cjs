const {readFileSync}=require('node:fs')
const ts=require('typescript')
const vm=require('node:vm')
const assert=require('node:assert/strict')
const test=require('node:test')
function load(path,requireMock){
 const source=readFileSync(path,'utf8')
 const compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}})
 assert.equal(compiled.diagnostics.length,0)
 const exports={}
 vm.runInNewContext(compiled.outputText,{module:{exports},exports,require:requireMock??(()=>{throw new Error('Runtime migration must not import dependencies')}),process:{get env(){throw new Error('Runtime migration must not read credentials')}}})
 return exports
}
test('legacy migrator fails closed without reading credentials or loading pg',async()=>{
 const api=load('src/lib/db-migrate.ts')
 await assert.rejects(api.autoMigrate(),/Runtime schema migration is disabled/)
 await assert.rejects(api.autoMigrate(),/Runtime schema migration is disabled/)
})
test('public init is gone and does not access database',async()=>{
 const api=load('src/app/api/system/init/route.ts',name=>{assert.equal(name,'next/server');return {NextResponse:{json:(body,options)=>({body,status:options.status})}}})
 const result=await api.GET()
 assert.equal(result.status,410)
 assert.equal(result.body.code,'RUNTIME_MIGRATION_DISABLED')
})
test('rendering no longer imports or invokes migration',()=>{
 const root=readFileSync('src/app/layout.tsx','utf8')
 assert.doesNotMatch(root,/autoMigrate|db-migrate/)
 const source=readFileSync('src/lib/db-migrate.ts','utf8')
 assert.doesNotMatch(source,/DROP POLICY|CREATE POLICY|CREATE OR REPLACE|client\.query|DATABASE_URL|import\('pg'\)/)
})

test('legacy auth/chat SQL definitions preserve the hardened function search path',()=>{
 for(const [path,count] of [['src/lib/supabase/migration_auth_link.sql',2],['src/lib/supabase/chat_features.sql',1]]){
  const sql=readFileSync(path,'utf8')
  assert.equal((sql.match(/set search_path = pg_catalog, public, pg_temp/gi)||[]).length,count)
 }
})

test('admin migration GET/POST are gone and never call an RPC or expose setup SQL',async()=>{
 const api=load('src/app/api/admin/migrate/route.ts',name=>{assert.equal(name,'next/server');return {NextResponse:{json:(body,options)=>({body,status:options.status})}}})
 for(const method of ['GET','POST']){
  const result=await api[method]({json(){throw new Error('must not read request')}})
  assert.equal(result.status,410)
  assert.equal(result.body.setupSql,undefined)
 }
 const sql=readFileSync('src/lib/supabase/migration_scorecard_yardage.sql','utf8')
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION|GRANT EXECUTE/i)
})

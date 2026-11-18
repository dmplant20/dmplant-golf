const {readFileSync}=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const assert=require('node:assert/strict')
const test=require('node:test')
const source=readFileSync('src/app/api/auth/set-password/route.ts','utf8')
const compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}})
assert.equal(compiled.diagnostics.length,0)
function setup({user=true,service=true,authError=null,flagError=null,returnedId='own',refresh=false,missingProfile=false}={}){
 const calls=[]
 const cookies={getAll:()=>[],set:(...args)=>calls.push(['cookie',...args])}
 const exports={}
 const serviceClient = {
  get auth() { throw new Error('admin auth forbidden') },
  from(table) {
   assert.equal(table, 'users')
   return {
    update(data) {
     assert.equal(data.password_set, true)
     assert.deepEqual(Object.keys(data), ['password_set'])
     return { eq: (key,id) => { calls.push(['flag',key,id]); return {select: () => ({maybeSingle: async () => ({data:missingProfile?null:{id},error:flagError})})} } }
    }
   }
  }
 }
 const auth={getUser:async()=>({data:{user:user?{id:'own'}:null},error:null}),updateUser:async attrs=>{calls.push(['update',JSON.parse(JSON.stringify(attrs))]);return {data:{user:{id:returnedId}},error:authError}}}
 vm.runInNewContext(compiled.outputText,{exports,module:{exports},require(name){
  if(name==='next/server')return {NextResponse:{json:(body,options)=>({body,status:options?.status??200})}}
  if(name==='next/headers')return {cookies:async()=>cookies}
  if(name==='@supabase/ssr')return {createServerClient:(_url,_key,options)=>{if(refresh)options.cookies.setAll([{name:'synthetic',value:'synthetic',options:{path:'/'}}]);return {auth}}}
  if(name==='@supabase/supabase-js')return {createClient:()=>serviceClient}
  throw new Error('unexpected import')
 },process:{env:{SUPABASE_SERVICE_ROLE_KEY:service?'synthetic':undefined}}})
 return {calls,post:body=>exports.POST({json:async()=>body}),malformed:()=>exports.POST({json:async()=>{throw new Error('invalid JSON')}})}
}
test('unauthenticated user cannot mutate password/profile',async()=>{const s=setup({user:false});assert.equal((await s.post({password:'synthetic'})).status,401);assert.equal(s.calls.length,0)})
for(const body of [null,[],{}, {password:12345678},{password:'short'},{password:'x'.repeat(73)},{password:'x'.repeat(8),nonce:42},{password:'x'.repeat(8),nonce:''}])test('reject invalid input '+JSON.stringify(body),async()=>{const s=setup();assert.equal((await s.post(body)).status,400);assert.equal(s.calls.length,0)})
test('malformed body rejected',async()=>{const s=setup();assert.equal((await s.malformed()).status,400);assert.equal(s.calls.length,0)})
test('missing flag-write config fails before password change',async()=>{const s=setup({service:false});assert.equal((await s.post({password:'synthetic'})).status,503);assert.equal(s.calls.length,0)})
for(const code of ['reauthentication_needed','reauthentication_not_valid','weak_password'])test(code+' does not update profile',async()=>{const s=setup({authError:{code}});const r=await s.post({password:'synthetic'});assert.equal(r.status,400);assert.equal(r.body.code,code);assert.equal(s.calls.length,1)})
for(const length of [8,72])test('own password boundary '+length,async()=>{const s=setup();assert.equal((await s.post({password:'x'.repeat(length),user_id:'other',email:'other@example.invalid'})).status,200);assert.deepEqual(s.calls,[['update',{password:'x'.repeat(length)}],['flag','id','own']])})
test('optional nonce reaches user scoped update and cookie refresh is propagated',async()=>{const s=setup({refresh:true});assert.equal((await s.post({password:'synthetic',nonce:'synthetic-nonce'})).status,200);assert.equal(s.calls[0][0],'cookie');assert.deepEqual(s.calls[1],['update',{password:'synthetic',nonce:'synthetic-nonce'}])})
test('auth success with different returned identity never sets profile flag',async()=>{const s=setup({returnedId:'other'});assert.equal((await s.post({password:'synthetic'})).status,500);assert.equal(s.calls.length,1)})
test('flag failure reports partial success explicitly',async()=>{const s=setup({flagError:{message:'synthetic'}});const r=await s.post({password:'synthetic'});assert.equal(r.status,500);assert.equal(r.body.password_changed,true)})
test('forced setup offers deliberate recovery without sending automatic email',()=>{const s=readFileSync('src/components/ui/ForcePasswordSetup.tsx','utf8');assert.match(s,/href="\/forgot-password"/);assert.doesNotMatch(s,/resetPasswordForEmail|localStorage.setItem/);assert.doesNotMatch(source,/\.admin\.updateUserById\(/)})

test('zero-row profile update is explicit partial success, not a false successful setup',async()=>{const s=setup({missingProfile:true});const r=await s.post({password:'synthetic'});assert.equal(r.status,500);assert.equal(r.body.password_changed,true)})

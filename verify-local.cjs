const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {createApp}=require('./server.cjs');

async function main(){
  // All writes are isolated from the user's real content.
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-local-test-'));
  let server;
  try {
    function copyTree(source,target){
      if(fs.statSync(source).isDirectory()){fs.mkdirSync(target,{recursive:true});for(const name of fs.readdirSync(source))copyTree(path.join(source,name),path.join(target,name));}
      else fs.writeFileSync(target,fs.readFileSync(source));
    }
    for(const item of ['index.html','build.cjs','local-admin.html','inline-editor.js','admin','data','uploads'])copyTree(path.join(__dirname,item),path.join(temp,item));
    server=createApp(temp);server.listen(0,'127.0.0.1');await once(server,'listening');
    const origin=`http://127.0.0.1:${server.address().port}`;
    const get=route=>fetch(origin+route);
    const post=(route,body,requestOrigin=origin)=>fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:requestOrigin},body:JSON.stringify(body)});
    assert.equal((await get('/')).status,200);
    assert.ok((await(await get('/')).text()).includes('<script src="/inline-editor.js">'));
    assert.equal((await get('/inline-editor.js')).status,200);
    const admin=await(await get('/admin/')).text();assert.ok(admin.includes('儲存變更'));assert.ok(!admin.includes('pagescms'));
    const initial=await(await get('/api/content')).json();
    assert.equal(initial.profile.name,'張哲瑋');
    let response=await post('/api/save',initial,'https://other.example');assert.equal(response.status,403);
    const invalid=structuredClone(initial);invalid.projects[0].url='javascript:alert(1)';
    assert.equal((await post('/api/save',invalid)).status,400);
    assert.equal((await(await get('/api/content')).json()).projects[0].url,initial.projects[0].url);
    const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
    response=await post('/api/upload',{name:'履歷.pdf',base64:pdf.toString('base64')});assert.equal(response.status,200);
    const upload=await response.json();assert.ok(upload.path.startsWith('/uploads/documents/'));
    assert.deepEqual(Buffer.from(await(await get(upload.path)).arrayBuffer()),pdf);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
    response=await post('/api/upload',{name:'作品.png',base64:png.toString('base64')});assert.equal(response.status,200);const image=await response.json();
    assert.equal((await post('/api/upload',{name:'fake.pdf',base64:Buffer.from('not pdf').toString('base64')})).status,400);
    assert.equal((await post('/api/upload',{name:'unsafe.html',base64:pdf.toString('base64')})).status,400);
    const changed=structuredClone(initial);changed.profile.education='本機儲存測試';changed.profile.resumeUrl=upload.path;changed.projects=[{title:'測試作品',description:'第一行\n第二行',url:'https://example.com',file:upload.path,image:image.path}];
    response=await post('/api/save',changed);assert.equal(response.status,200);assert.equal((await response.json()).saved,true);
    const saved=await(await get('/api/content')).json();assert.equal(saved.profile.education,'本機儲存測試');assert.equal(saved.projects.length,1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'data/resume.json'),'utf8')).resumeUrl,upload.path);
    assert.ok((await(await get('/')).text()).includes('本機儲存測試'));
    assert.ok(fs.existsSync(path.join(temp,'_site',image.path.slice(1))));
    assert.equal((await get('/data/resume.json')).status,404);
    assert.equal((await get('/server.cjs')).status,404);
    assert.equal((await post('/api/save',{profile:{name:''},projects:[]})).status,400);
    assert.equal((await(await get('/api/content')).json()).profile.education,'本機儲存測試');
    await new Promise(resolve=>server.close(resolve));server=createApp(temp);server.listen(0,'127.0.0.1');await once(server,'listening');
    const restart=await(await fetch(`http://127.0.0.1:${server.address().port}/api/content`)).json();assert.equal(restart.profile.education,'本機儲存測試');assert.equal(restart.projects[0].image,image.path);
    console.log('PASS: local editor, save/reload, PDF/image upload, persistence after restart, validation, origin protection, restricted file access.');
  } finally {
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    const resolved=path.resolve(temp);
    if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('portfolio-local-test-'))throw new Error('Unexpected test cleanup path');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(`${__dirname}/local-admin.html`,'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\s+load\(\);\s*$/,'');
async function main(){
  const nodes=new Map();
  function element(){return {textContent:'',className:'',innerHTML:'',disabled:false,hidden:false,value:'',elements:{},addEventListener(){}};}
  const document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);}};
  for(const name of ['name','englishName','title','education','research','experience','skills','email'])document.querySelector('#editor').elements[name]=element();
  const context={document,window:{addEventListener(){}},location:{protocol:'http:',href:'http://127.0.0.1:4173/admin/'},AbortController,setTimeout,clearTimeout,URL,TypeError,fetch:async()=>{throw new TypeError('Failed to fetch');}};
  vm.createContext(context);vm.runInContext(code,context);
  await vm.runInContext('load()',context);
  assert.equal(vm.runInContext('busy',context),false);
  assert.equal(nodes.get('#save').textContent,'尚未連線');
  assert.equal(nodes.get('#save').disabled,true);
  assert.equal(nodes.get('#fields').disabled,true);
  assert.equal(nodes.get('#retry').hidden,false);
  assert.ok(nodes.get('#status').textContent.includes('啟動網站'));
  context.fetch=async()=>({ok:true,json:async()=>({profile:{name:'張哲瑋'},projects:[]})});
  await vm.runInContext('load()',context);
  assert.equal(nodes.get('#editor').elements.name.value,'張哲瑋');
  assert.equal(nodes.get('#status').textContent,'已讀取本機資料');
  assert.equal(nodes.get('#save').disabled,false);
  assert.equal(nodes.get('#fields').disabled,false);
  assert.equal(nodes.get('#save').textContent,'儲存變更');
  assert.equal(nodes.get('#retry').hidden,true);
  assert.equal(vm.runInContext('busy',context),false);
  context.location.protocol='file:';
  await vm.runInContext('load()',context);
  assert.ok(nodes.get('#status').textContent.includes('http://127.0.0.1:4173/admin/'));
  assert.equal(vm.runInContext('busy',context),false);
  console.log('PASS: failed fetch recovery, retry button, disabled empty form, successful reload, local-file guidance.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

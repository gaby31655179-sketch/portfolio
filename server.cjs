const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

function createApp(root = __dirname) {
  root = path.resolve(root);
  const readContent = () => ({profile:JSON.parse(fs.readFileSync(path.join(root,'data/resume.json'),'utf8')),projects:JSON.parse(fs.readFileSync(path.join(root,'data/projects.json'),'utf8')).projects});
  function build() {
    const result = spawnSync(process.execPath,[path.join(root,'build.cjs')],{cwd:root,encoding:'utf8',windowsHide:true});
    if(result.status !== 0) throw new Error(result.stderr?.trim() || '網站更新失敗');
  }
  build();
  let saveQueue = Promise.resolve();
  function json(res,status,data) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  async function body(req) {
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new Error('請使用 JSON 格式');
    let size=0; const chunks=[];
    for await(const chunk of req) {size+=chunk.length;if(size>14*1024*1024) throw new Error('檔案太大，請使用 8 MB 以下的檔案');chunks.push(chunk);}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('資料格式不正確');}
  }
  function text(value,max=20000) {if(value==null)return '';if(typeof value!=='string'||value.length>max)throw new Error('文字格式不正確或過長');return value;}
  function link(value) {
    value=text(value,2000).trim(); if(!value)return '';
    if(/^https?:\/\//i.test(value)){const parsed=new URL(value);if(parsed.username||parsed.password)throw new Error('連結不能包含帳號或密碼');return value;}
    if(!/^\/?uploads\//.test(value))throw new Error('請使用 https 網址或已上傳的檔案');
    const file=path.resolve(root,value.replace(/^\//,''));
    if(!file.startsWith(path.join(root,'uploads')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())throw new Error('找不到上傳的檔案');
    return '/'+path.relative(root,file).split(path.sep).join('/');
  }
  function validate(data) {
    if(!data||!data.profile||!Array.isArray(data.projects)||data.projects.length>30)throw new Error('作品最多 30 個，請確認資料格式');
    const profile={};for(const field of ['name','englishName','title','education','research','experience','skills','email'])profile[field]=text(data.profile[field]);
    if(!profile.name.trim())throw new Error('請填寫姓名');
    profile.resumeUrl=link(data.profile.resumeUrl);
    const projects=data.projects.map(item=>{
      if(!item||typeof item!=='object')throw new Error('作品格式不正確');
      const title=text(item.title,200);if(!title.trim())throw new Error('請填寫每個作品的名稱');
      return {title,description:text(item.description),url:link(item.url),file:link(item.file),image:link(item.image)};
    });
    return {profile,projects};
  }
  function save(data) {
    const clean=validate(data);
    const resumePath=path.join(root,'data/resume.json'),projectsPath=path.join(root,'data/projects.json');
    const oldResume=fs.readFileSync(resumePath),oldProjects=fs.readFileSync(projectsPath);
    try {
      fs.writeFileSync(resumePath,JSON.stringify(clean.profile,null,2)+'\n');
      fs.writeFileSync(projectsPath,JSON.stringify({projects:clean.projects},null,2)+'\n');
      build();
    } catch(error) {
      fs.writeFileSync(resumePath,oldResume);fs.writeFileSync(projectsPath,oldProjects);
      try{build();}catch{}
      throw error;
    }
    return clean;
  }
  function upload(data) {
    if(!data||typeof data.name!=='string'||typeof data.base64!=='string')throw new Error('請選擇檔案');
    const ext=path.extname(data.name).toLowerCase();
    if(!['.pdf','.png','.jpg','.jpeg','.webp'].includes(ext))throw new Error('只接受 PDF、PNG、JPG、WEBP');
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64))throw new Error('檔案資料不正確');
    const bytes=Buffer.from(data.base64,'base64');
    if(!bytes.length||bytes.length>8*1024*1024)throw new Error('檔案需介於 1 byte 與 8 MB');
    const valid=ext==='.pdf'?bytes.subarray(0,5).toString()==='%PDF-':ext==='.png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):ext==='.webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':bytes[0]===255&&bytes[1]===216;
    if(!valid)throw new Error('檔案內容與副檔名不符');
    const folder=ext==='.pdf'?'documents':'images';
    const filename=crypto.randomUUID()+ext;
    const dest=path.join(root,'uploads',folder,filename);
    fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});
    return {path:`/uploads/${folder}/${filename}`,name:data.name};
  }
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
    const port=server.address().port;
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){json(res,403,{error:'僅供本機使用'});return;}
    const origin=`http://${req.headers.host}`;
    try {
      const pathname=new URL(req.url,origin).pathname;
      if(req.method==='POST') {
        if(req.headers.origin!==origin){json(res,403,{error:'請從本機編輯頁面儲存'});return;}
        const data=await body(req);
        if(pathname==='/api/upload'){json(res,200,upload(data));return;}
        if(pathname==='/api/save'){
          const job=saveQueue.then(()=>save(data));saveQueue=job.catch(()=>{});
          json(res,200,{...await job,saved:true});return;
        }
        json(res,404,{error:'找不到此功能'});return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'不支援的操作'});return;}
      if(pathname==='/api/content'){json(res,200,readContent());return;}
      let file;
      if(pathname==='/inline-editor.js')file=path.join(root,'inline-editor.js');
      else if(pathname==='/admin/'||pathname==='/admin'||pathname==='/admin/index.html')file=path.join(root,'local-admin.html');
      else if(pathname.startsWith('/uploads/'))file=path.resolve(root,'.'+decodeURIComponent(pathname));
      else file=path.resolve(root,'_site','.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
      const allowed=file===path.join(root,'local-admin.html')||file===path.join(root,'inline-editor.js')||file.startsWith(path.join(root,'_site')+path.sep)||file.startsWith(path.join(root,'uploads')+path.sep);
      if(!allowed||!fs.existsSync(file)||!fs.statSync(file).isFile()){json(res,404,{error:'找不到檔案'});return;}
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      if(req.method==='HEAD')res.end();
      else if(file===path.join(root,'_site/index.html'))res.end(fs.readFileSync(file,'utf8').replace('</body>','<script src="/inline-editor.js"></script></body>'));
      else fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    } catch(error) {json(res,400,{error:error.message||'操作失敗'});}
  });
  return server;
}
if(require.main===module) {
  const port=Number(process.env.PORT||4173);
  const server=createApp();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`連接埠 ${port} 已使用中；若網站已啟動，可直接開啟 http://127.0.0.1:${port}/`:error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`網站：http://127.0.0.1:${port}/\n編輯：http://127.0.0.1:${port}/admin/\n關閉此程式即停止本機服務。`));
}
module.exports={createApp};

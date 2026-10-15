(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const escapeHTML=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.head.insertAdjacentHTML('beforeend',`<style>
    .edit-button{font:inherit;font-size:13px;cursor:pointer;background:#b7d6c611;color:#b7d6c6;border:1px solid #b7d6c645;border-radius:7px;padding:7px 13px}.edit-button:hover{background:#b7d6c622}.section-title{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}.section-title:hover{color:#b7d6c6}.card{cursor:pointer}.card-edit{display:block;margin:16px 0 0}.local-dialog{padding:0;width:min(760px,calc(100% - 28px));max-height:90dvh;overflow:auto;background:#17222a;color:#edf0eb;border:1px solid #b7d6c645;border-radius:13px}.local-dialog::backdrop{background:#050b12bd;backdrop-filter:blur(4px)}.local-dialog form{margin:0}.edit-head{display:flex;justify-content:space-between;align-items:center;padding:22px 26px;border-bottom:1px solid #ffffff18;position:sticky;top:0;background:#17222a;z-index:2}.edit-head h2{font-size:23px;margin:0}.edit-fields{padding:24px 26px;border:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:18px}.edit-fields .wide{grid-column:1/-1}.edit-fields label{display:block;font-size:14px;color:#c9d5d7}.edit-fields input,.edit-fields textarea{display:block;width:100%;font:inherit;color:#edf0eb;background:#101820;border:1px solid #ffffff28;border-radius:7px;padding:10px 12px;margin-top:7px}.edit-fields textarea{min-height:90px;resize:vertical}.edit-fields input[type=file]{font-size:12px}.edit-foot{padding:17px 26px;border-top:1px solid #ffffff18;display:flex;gap:15px;justify-content:space-between;align-items:center;position:sticky;bottom:0;background:#17222a;z-index:2}.edit-save{background:#b7d6c6;color:#16271f;flex-shrink:0}.edit-button:disabled{opacity:.5;cursor:wait}.edit-status{font-size:13px;color:#a6b3b9;margin:0}.edit-status.error{color:#f2b7b1}.file-note{font-size:12px;color:#a6b3b9;margin-top:7px;display:flex;align-items:center;gap:12px}.file-note button{font:inherit;font-size:12px;background:none;color:#b7d6c6;border:0;cursor:pointer}.inline-hint{font-size:12px;color:#91a5aa;margin-top:13px}.inline-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#244134;color:#def1e7;border:1px solid #b7d6c650;padding:12px 20px;border-radius:8px;z-index:30}.edit-button:focus-visible,.section-title:focus-visible{outline:2px solid #b7d6c6;outline-offset:4px}@media(max-width:600px){.edit-fields{grid-template-columns:1fr;padding:20px}.edit-fields .wide{grid-column:auto}.edit-head{padding:18px 20px}.edit-foot{padding:16px 20px}.edit-status{max-width:65%}}
  </style>`);
  const dialog=document.createElement('dialog');dialog.className='local-dialog';dialog.setAttribute('aria-labelledby','inline-title');
  dialog.innerHTML='<form id="inline-form"><div class="edit-head"><h2 id="inline-title">編輯</h2><button class="edit-button" type="button" id="inline-cancel">取消 ×</button></div><fieldset class="edit-fields" id="inline-fields"></fieldset><div class="edit-foot"><p class="edit-status" role="status" aria-live="polite" id="inline-status"></p><button class="edit-button edit-save" id="inline-save" type="submit">儲存</button></div></form>';
  document.body.append(dialog);
  const form=$('#inline-form'),fields=$('#inline-fields');
  let data,mode,index,draft,dirty=false,busy=false;
  function status(message,error=false){$('#inline-status').textContent=message;$('#inline-status').className='edit-status'+(error?' error':'');}
  function lock(value){busy=value;fields.disabled=value;$('#inline-save').disabled=value;$('#inline-cancel').disabled=value;}
  async function api(url,body){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{const response=await fetch(url,{method:body?'POST':'GET',cache:'no-store',signal:controller.signal,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const result=await response.json();if(!response.ok)throw new Error(result.error||'操作失敗');return result;}
    catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw new Error('暫時無法連線，請確認啟動網站視窗仍開著，再重試。');throw error;}
    finally{clearTimeout(timer);}
  }
  function input(name,label,value,options={}){return `<label class="${options.wide?'wide':''}">${label}${options.area?`<textarea name="${name}">${escapeHTML(value)}</textarea>`:`<input name="${name}" type="${options.email?'email':options.url?'url':'text'}" value="${escapeHTML(value)}" ${options.required?'required':''} maxlength="${options.required?200:2000}" ${options.url?'placeholder="https://"':''}>`}</label>`;}
  function uploadInput(name,label,value,image=false){return `<div class="wide"><label>${label}<input type="file" data-upload="${name}" accept="${image?'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp':'application/pdf,.pdf'}"></label><div class="file-note" id="file-${name}">${value?'已附加檔案':'尚未上傳'} ${value?`<button type="button" data-clear="${name}">移除連結</button>`:''}</div></div>`;}
  function render(){
    if(mode==='resume')fields.innerHTML=input('name','中文姓名',draft.name,{required:true})+input('englishName','英文姓名',draft.englishName)+input('education','學歷',draft.education,{area:true})+input('research','研究方向',draft.research,{area:true})+input('experience','經歷',draft.experience,{area:true})+input('skills','技能',draft.skills,{area:true})+input('email','聯絡信箱',draft.email,{email:true,wide:true})+uploadInput('resumeUrl','履歷 PDF（8 MB 以下）',draft.resumeUrl);
    else fields.innerHTML=input('title','作品名稱',draft.title,{required:true,wide:true})+input('description','作品簡介',draft.description,{area:true,wide:true})+input('url','作品網址（選填）',draft.url,{url:true,wide:true})+uploadInput('image','作品圖片（8 MB 以下）',draft.image,true)+uploadInput('file','作品 PDF（8 MB 以下）',draft.file);
  }
  async function openEditor(kind,itemIndex=-1){
    if(dialog.open)return;
    mode=kind;index=itemIndex;dirty=false;fields.innerHTML='';$('#inline-title').textContent=kind==='resume'?'編輯履歷':kind==='new'?'新增作品':'編輯作品';status('讀取中…');lock(true);dialog.showModal();
    try{data=await api('/api/content');if(kind==='new'&&data.projects.length>=30)throw new Error('作品最多 30 個，請先移除不需要的作品。');draft=structuredClone(kind==='resume'?data.profile:kind==='new'?{title:'',description:'',url:'',file:'',image:''}:data.projects[itemIndex]);if(!draft)throw new Error('找不到此作品，請重新整理網站。');render();status('修改後按儲存，就會更新網站。');lock(false);fields.querySelector('input')?.focus();}
    catch(error){busy=false;status(error.message,true);$('#inline-cancel').disabled=false;}
  }
  function closeEditor(){if(busy)return;if(dirty&&!confirm('還沒有儲存，要放棄這次修改嗎？'))return;dirty=false;dialog.close();}
  $('#inline-cancel').addEventListener('click',closeEditor);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
  fields.addEventListener('input',event=>{if(event.target.name){draft[event.target.name]=event.target.value;dirty=true;}});
  fields.addEventListener('click',event=>{const key=event.target.dataset.clear;if(!key)return;draft[key]='';dirty=true;const input=fields.querySelector(`[data-upload="${key}"]`);input.value='';$(`#file-${key}`).textContent='已移除連結，儲存後生效';});
  fields.addEventListener('change',async event=>{
    const key=event.target.dataset.upload,file=event.target.files?.[0];if(!key||!file)return;
    if(file.size>8*1024*1024){status('檔案需小於 8 MB。',true);event.target.value='';return;}
    lock(true);status('正在上傳 '+file.name+'…');
    try{const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('檔案讀取失敗'));reader.readAsDataURL(file);});const result=await api('/api/upload',{name:file.name,base64});draft[key]=result.path;dirty=true;$(`#file-${key}`).textContent='已選擇：'+file.name;status('上傳完成，請按儲存。');}catch(error){status(error.message,true);}finally{lock(false);}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;lock(true);status('正在儲存…');
    const next=structuredClone(data);if(mode==='resume')next.profile=draft;else if(mode==='new')next.projects.push(draft);else next.projects[index]=draft;
    try{await api('/api/save',next);dirty=false;busy=false;sessionStorage.setItem('portfolio-saved','1');location.reload();}catch(error){status(error.message,true);lock(false);}
  });
  for(const [section,kind,label] of [['projects','new','新增作品'],['resume','resume','編輯履歷']]){
    const heading=$(`#${section} .section-heading`),title=heading.querySelector('h2');
    const titleButton=document.createElement('button');titleButton.className='section-title';titleButton.textContent=title.textContent;titleButton.setAttribute('aria-label',label);titleButton.addEventListener('click',()=>openEditor(kind));title.replaceChildren(titleButton);
    const action=document.createElement('button');action.className='edit-button';action.textContent=section==='projects'?'＋ 新增作品':'編輯履歷';action.addEventListener('click',()=>openEditor(kind));heading.querySelector('span')?.replaceWith(action);
    $(`nav a[href="#${section}"]`).addEventListener('click',event=>{event.preventDefault();$(`#${section}`).scrollIntoView({behavior:'smooth'});openEditor(kind);});
  }
  document.querySelectorAll('#project-grid .card').forEach((card,i)=>{const action=document.createElement('button');action.className='edit-button card-edit';action.textContent='編輯作品';action.setAttribute('aria-label','編輯'+card.querySelector('h3').textContent);action.addEventListener('click',()=>openEditor('project',i));card.querySelector('.card-body').append(action);card.addEventListener('click',event=>{if(!event.target.closest('a,button'))openEditor('project',i);});});
  $('.resume').addEventListener('click',event=>{if(!event.target.closest('a,button'))openEditor('resume');});
  const hint=document.createElement('p');hint.className='inline-hint';hint.textContent='點選作品卡片可修改；點「＋ 新增作品」或「履歷」即可編輯。';$('.intro').append(hint);
  const management=$('.manage-link');if(management){management.textContent='本機編輯模式';management.removeAttribute('href');}
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  if(sessionStorage.getItem('portfolio-saved')){sessionStorage.removeItem('portfolio-saved');const toast=document.createElement('div');toast.className='inline-toast';toast.setAttribute('role','status');toast.textContent='已儲存，網站已更新！';document.body.append(toast);setTimeout(()=>toast.remove(),4000);}
})();

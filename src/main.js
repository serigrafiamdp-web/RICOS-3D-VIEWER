// UI deliberately has no external imports: file selection works even if 3D libraries fail to load.
const REPO='serigrafiamdp-web/RICOS-3D-VIEWER';
const BRANCH='main';
const MAX_UPLOAD_BYTES=50*1024*1024;
const EXTENSIONS=new Set(['glb','obj','stl']);
const $=id=>document.getElementById(id);
const state={saved:[],local:null,activeId:null,localUrl:null,viewer:null,viewerPending:null,loadingId:0,uploading:false};
const format=name=>(name?.split('.').pop()||'').toLowerCase();
const modelName=path=>{
 const filename=path.split('/').pop()||path;
 if(/altec/i.test(filename))return 'Altec Speaker Cabinet';
 return filename.replace(/\.(glb|obj|stl)$/i,'').replace(/[-_]+/g,' ').trim();
};
// Record the most recent local model for automatic preview on this device.
// This is a browser copy, NOT a publicly published file.
const DB_NAME='ricos-3d-preview',STORE='latest';
function openLocalStore(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window))return reject(new Error('IndexedDB not supported'));
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{request.result.createObjectStore(STORE)};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
async function saveLocalPreview(file){
 try{
  const db=await openLocalStore();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put(file,'last-file');
   tx.oncomplete=resolve;
   tx.onerror=()=>reject(tx.error);
  });
  db.close();
 }catch(err){console.warn('Vista previa local no persistida',err)}
}
async function restoreLocalPreview(){
 try{
  const db=await openLocalStore();
  const file=await new Promise((resolve,reject)=>{
   const req=db.transaction(STORE,'readonly').objectStore(STORE).get('last-file');
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error);
  });
  db.close();
  if(file instanceof Blob){
   const name=file.name||'modelo.glb';
   acceptFile(file,name,false);
  }
 }catch(err){console.warn('Vista previa local no encontrada',err)}
}
const cubeIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="round"><path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z M3 7l9 5 9-5 M12 12v10"/></svg>';
function notify(message,delay=5500){
 const toast=$('toast');
 toast.textContent=message;
 toast.classList.add('is-visible');
 clearTimeout(notify.timer);
 notify.timer=setTimeout(()=>toast.classList.remove('is-visible'),delay);
}
async function getViewer(){
 if(state.viewer)return state.viewer;
 if(state.viewerPending)return state.viewerPending;
 state.viewerPending=import('./viewer-core.js').then(mod=>{
   const engine=mod.initialize($('viewport'));
   state.viewer=engine;
   return engine;
 }).catch(error=>{
   console.error('No se pudo inicializar Three.js:',error);
   notify('No se pudo iniciar el visor 3D. Probá recargar la página con Ctrl+F5.',9000);
   throw error;
 }).finally(()=>{state.viewerPending=null});
 return state.viewerPending;
}
function savedModels(){
 return [...(state.local?[state.local]:[]),...state.saved];
}
function drawList(){
 const host=$('modelList');host.replaceChildren();
 for(const model of savedModels()){
   const button=document.createElement('button');
   button.type='button';
   button.className='model-row'+(state.activeId===model.id?' is-active':'');
   const thumb=document.createElement('span');
   thumb.className='model-thumb';
   thumb.innerHTML=cubeIcon;
   const label=document.createElement('span');
   label.className='model-label';
   label.textContent=model.name;
   if(model.local){const mark=document.createElement('small');mark.className='model-local-mark';mark.textContent='LOCAL';label.appendChild(mark)}
   button.append(thumb,label);
   button.addEventListener('click',()=>select(model));
   host.appendChild(button);
 }
 $('modelCounter').textContent=String(state.saved.length).padStart(2,'0');
 $('saveButton').hidden=!(state.local?.file && state.activeId===state.local.id);
}
async function select(model,options={}){
 state.activeId=model.id;
 drawList();
 if(!options.keepScene){
   const id=++state.loadingId;
   $('busy').hidden=false;
   try{
     const viewer=await getViewer();
     if(id!==state.loadingId)return;
     const visible=await viewer.open(model);
     if(id!==state.loadingId)return;

   }catch(error){
     console.error('No se pudo cargar el 3D:',error);
     if(id===state.loadingId)notify('No se pudo visualizar el archivo. Revisá la consola para más detalles.');
   }finally{
     if(id===state.loadingId)$('busy').hidden=true;
   }
 }
 const url=new URL(location.href);
 if(model.local)url.searchParams.delete('model');
 else url.searchParams.set('model',model.id);
 history.replaceState(null,'',url);
}
async function loadSaved({pickInitial=true}={}){
 try{
  const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/models?ref='+BRANCH,{
   headers:{Accept:'application/vnd.github+json'},cache:'no-store'
  });
  if(!response.ok)throw new Error('Respuesta de GitHub: '+response.status);
  const entries=await response.json();
  state.saved=entries.filter(x=>x.type==='file'&&EXTENSIONS.has(format(x.name))).map(x=>({
   id:x.path,name:modelName(x.path),ext:format(x.name),bytes:x.size,
   url:'https://raw.githubusercontent.com/'+REPO+'/'+BRANCH+'/'+x.path,local:false
  })).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 }catch(error){
  console.warn('Error consultando modelos públicos:',error);
  try{
   const manifest=await (await fetch('./models.json',{cache:'no-store'})).json();
   const items=(manifest.models||[]).filter(x=>EXTENSIONS.has(x.format));
   const checked=await Promise.all(items.map(async x=>{
    const url=new URL(x.url,document.baseURI);
    try{
     const response=await fetch(url,{method:'HEAD'});
     if(!response.ok)return null;
     return {id:'models/'+url.pathname.split('/').pop(),name:x.name,ext:x.format,bytes:x.size,url:url.href,local:false};
    }catch{return null}
   }));
   state.saved=checked.filter(Boolean);
  }catch{state.saved=[]}
 }
 drawList();
 if(pickInitial&&!state.local){
  const requested=new URL(location.href).searchParams.get('model');
  const initial=state.saved.find(x=>x.id===requested)
   ||state.saved.find(x=>/altec/i.test(x.name))||state.saved[0];
  if(initial)select(initial);
 }
}
function acceptFile(file,fileName=file?.name,persist=true){
 if(!file)return;
 const ext=format(fileName);
 if(!EXTENSIONS.has(ext)){notify('Elegí un archivo GLB, OBJ o STL.');return}
 // Replace the previous local preview, leaving remote files intact.
 if(state.localUrl)URL.revokeObjectURL(state.localUrl);
 state.localUrl=URL.createObjectURL(file);
 const name=/altec/i.test(fileName)?'Altec Speaker Cabinet':fileName.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
 // Stored Blobs can lose the File.name property in some browsers.
 const named=file.name?file:new File([file],fileName,{type:file.type||'model/gltf-binary'});
 state.local={id:'local-'+crypto.randomUUID(),name,ext,bytes:file.size,url:state.localUrl,file:named,local:true};
 if(persist)saveLocalPreview(named);
 select(state.local);
}
$('loadButton').addEventListener('click',()=>{
 $('fileInput').value='';
 $('fileInput').click();
});
$('fileInput').addEventListener('change',event=>acceptFile(event.target.files?.[0]));
$('saveButton').addEventListener('click',()=>{
 const item=state.local;
 if(!item?.file||item.id!==state.activeId)return;
 $('modelName').value=item.name;
 $('fileInfo').textContent=item.file.name+' · '+(item.file.size/1048576).toFixed(1)+' MB';
 $('publishError').hidden=true;
 $('accessToken').value='';
 $('publishDialog').showModal();
});
$('closeDialog').addEventListener('click',()=>{
 if(!state.uploading)$('publishDialog').close();
});
$('publishDialog').addEventListener('click',event=>{
 if(event.target===$('publishDialog')&&!state.uploading)$('publishDialog').close();
});
function slugify(s){
 return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||'modelo';
}
function toBase64(bytes){
 const out=[];
 for(let i=0;i<bytes.length;i+=16384){
   out.push(String.fromCharCode.apply(null,bytes.subarray(i,i+16384)));
 }
 return btoa(out.join(''));
}
async function putGithub(token,path,content){
 const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+path,{
  method:'PUT',
  headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
   'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
  body:JSON.stringify({message:'Publish 3D model: '+path,content,branch:BRANCH})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error((result.message||'Error al guardar')+' ('+response.status+')');
 return result;
}
$('publishForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(state.uploading)return;
 const item=state.local;
 if(!item?.file||item.id!==state.activeId)return;
 const error=$('publishError');
 error.hidden=true;
 if(item.bytes>MAX_UPLOAD_BYTES){
   error.textContent='Archivo demasiado grande para este prototipo (máximo 50 MB).';
   error.hidden=false;
   return;
 }
 const token=$('accessToken').value.trim();
 if(!token)return;
 const name=$('modelName').value.trim()||item.name;
 const stem=/altec/i.test(name)||/altec/i.test(item.file.name)?'altec-speaker':slugify(name);
 let path='models/'+stem+'.'+item.ext;
 if(state.saved.some(m=>m.id===path))path='models/'+stem+'-'+crypto.randomUUID().slice(0,7)+'.'+item.ext;
 const button=$('confirmPublish');state.uploading=true;button.disabled=true;button.textContent='Guardando…';
 try{
   const bytes=new Uint8Array(await item.file.arrayBuffer());
   await putGithub(token,path,toBase64(bytes));
   $('accessToken').value='';
   $('publishDialog').close();
   const tempUrl=state.localUrl;
   const published={id:path,name,ext:item.ext,bytes:item.bytes,url:tempUrl,local:false};
   state.localUrl=null;
   state.local=null;
   state.saved=[published,...state.saved.filter(x=>x.id!==path)];
   await select(published,{keepScene:true});
   notify('Modelo guardado en GitHub.');
   setTimeout(()=>loadSaved({pickInitial:false}),2500);
 }catch(e){
   console.error('Error publicando:',e);
   error.textContent='No se pudo guardar: '+e.message;
   error.hidden=false;
 }finally{
   $('accessToken').value='';
   state.uploading=false;button.disabled=false;button.textContent='Guardar modelo';
 }
});
// If no publicly published models exist, restore the most recent local preview.
// Public models in /models take precedence on a new visitor's first visit.
loadSaved().then(async()=>{if(!state.saved.length && !state.local)await restoreLocalPreview()});
getViewer().catch(()=>{});

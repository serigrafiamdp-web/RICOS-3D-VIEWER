import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';

const REPO='serigrafiamdp-web/RICOS-3D-VIEWER';
const BRANCH='main';
const MAX_UPLOAD=50*1024*1024;
const EXTENSIONS=new Set(['glb','obj','stl']);
const $=id=>document.getElementById(id);
const state={saved:[],local:null,selected:null,active:null,localUrl:null,token:0,uploading:false};
const view=$('viewport');
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(40,1,.001,10000);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.setClearColor(0xffffff,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.45;
view.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0xabb9ae,2.25));
const topLight=new THREE.DirectionalLight(0xffffff,3.4);
topLight.position.set(4,8,6);scene.add(topLight);
const sideLight=new THREE.DirectionalLight(0xe3edff,1.6);
sideLight.position.set(-5,2,-5);scene.add(sideLight);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.075;
controls.minDistance=.01;
controls.maxDistance=3000;
controls.screenSpacePanning=true;
camera.position.set(2.8,1.7,3.3);
controls.target.set(0,0,0);
controls.update();
const resize=()=>{
 const width=Math.max(1,view.clientWidth),height=Math.max(1,view.clientHeight);
 renderer.setSize(width,height,false);
 camera.aspect=width/height;camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(view);
resize();
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}
animate();

function notify(message){
 const node=$('toast');node.textContent=message;node.classList.add('is-visible');
 clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>node.classList.remove('is-visible'),4000);
}
const format=filename=>(filename?.split('.').pop()||'').toLowerCase();
const niceName=path=>{
 const filename=path.split('/').pop()||path;
 if(filename.toLowerCase()==='altec-speaker.glb')return 'Altec Speaker Cabinet';
 return filename.replace(/\.(glb|obj|stl)$/i,'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
};
const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z M3 7l9 5 9-5 M12 12v10"/></svg>';
const allModels=()=>[...(state.local?[state.local]:[]),...state.saved];
function drawList(){
 const list=$('modelList');list.replaceChildren();
 for(const model of allModels()){
  const button=document.createElement('button');
  button.type='button';button.className='model-row'+(state.selected===model.id?' is-active':'');
  button.setAttribute('aria-label',model.name);
  const thumb=document.createElement('span');thumb.className='model-thumb';thumb.innerHTML=icon;
  const label=document.createElement('span');label.className='model-label';label.textContent=model.name;
  if(model.local){const sub=document.createElement('small');sub.className='model-local-mark';sub.textContent='LOCAL';label.appendChild(sub)}
  button.append(thumb,label);button.addEventListener('click',()=>chooseModel(model));
  list.appendChild(button);
 }
 $('modelCounter').textContent=String(state.saved.length).padStart(2,'0');
 $('saveButton').hidden=!(state.local && state.local.id===state.selected && state.local.file);
}
function disposeObject(){
 if(!state.active)return;
 scene.remove(state.active);
 state.active.traverse(n=>{
  if(n.geometry)n.geometry.dispose();
  if(!n.material)return;
  const materials=Array.isArray(n.material)?n.material:[n.material];
  for(const material of materials){
   if(!material)continue;
   for(const key of ['map','normalMap','metalnessMap','roughnessMap','aoMap','emissiveMap'])material[key]?.dispose?.();
   material.dispose?.();
  }
 });
 state.active=null;
}
function fit(object){
 const bounds=new THREE.Box3().setFromObject(object);
 if(bounds.isEmpty())return;
 const center=bounds.getCenter(new THREE.Vector3());
 const size=bounds.getSize(new THREE.Vector3());
 object.position.sub(center);
 const longest=Math.max(size.x,size.y,size.z,.05);
 const fov=camera.fov*Math.PI/180;
 const distance=longest/(2*Math.tan(fov/2))*1.28;
 camera.position.set(distance*.7,distance*.33,distance*.95);
 camera.near=Math.max(.0001,longest/5000);
 camera.far=Math.max(100,longest*150);
 camera.updateProjectionMatrix();
 controls.target.set(0,0,0);
 controls.minDistance=longest*.14;
 controls.maxDistance=longest*30;
 controls.update();
}
async function loadModel(model){
 const ticket=++state.token;
 $('busy').hidden=false;
 try{
  let object=null;
  if(model.ext==='glb'){const gltf=await new GLTFLoader().loadAsync(model.url);object=gltf.scene;}
  if(model.ext==='obj'){object=await new OBJLoader().loadAsync(model.url);}
  if(model.ext==='stl'){
   const geom=await new STLLoader().loadAsync(model.url);
   if(!geom.attributes.normal)geom.computeVertexNormals();
   object=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0xc3cbc3,roughness:.8,side:THREE.DoubleSide}));
  }
  if(!object)throw new Error('Formato no compatible');
  if(ticket!==state.token){object.traverse(n=>n.geometry?.dispose?.());return}
  disposeObject();state.active=object;scene.add(object);fit(object);
  $('centerMark').classList.add('is-hidden');
 }catch(err){
  console.error('Error abriendo modelo',err);
  if(ticket===state.token){disposeObject();$('centerMark').classList.remove('is-hidden');notify('No se pudo abrir este modelo 3D.');}
 }finally{if(ticket===state.token)$('busy').hidden=true}
}
function chooseModel(model,{preserveScene=false}={}){
 state.selected=model.id;drawList();
 if(!preserveScene)loadModel(model);
 const url=new URL(location.href);
 if(model.local)url.searchParams.delete('model');
 else url.searchParams.set('model',model.id);
 history.replaceState(null,'',url);
}
async function refreshSaved({showSelection=true}={}){
 try{
  const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/models?ref='+BRANCH+'&t='+Date.now(),{
   headers:{Accept:'application/vnd.github+json'},cache:'no-store'
  });
  if(!response.ok)throw new Error('GitHub devolvió '+response.status);
  const entries=await response.json();
  state.saved=entries
   .filter(f=>f.type==='file' && EXTENSIONS.has(format(f.name)))
   .map(f=>({
     id:f.path,name:niceName(f.path),ext:format(f.name),bytes:f.size,
     url:'https://raw.githubusercontent.com/'+REPO+'/'+BRANCH+'/'+f.path,
     local:false
   }))
   .sort((a,b)=>a.name.localeCompare(b.name,'es'));
 }catch(error){
  console.warn('No se pudo consultar el repositorio',error);
  // El manifiesto histórico permite seguir mostrando modelos que existan.
  try{
   const response=await fetch('./models.json',{cache:'no-store'});
   const manifest=await response.json();
   const entries=(manifest.models||[]).filter(m=>EXTENSIONS.has(m.format));
   const valid=await Promise.all(entries.map(async m=>{
    try{
     const u=new URL(m.url,document.baseURI);
     const head=await fetch(u,{method:'HEAD'});
     return head.ok?{id:'models/'+u.pathname.split('/').pop(),name:m.name,ext:m.format,bytes:m.size,url:u.href,local:false}:null;
    }catch{return null}
   }));
   state.saved=valid.filter(Boolean);
  }catch{state.saved=[]}
 }
 drawList();
 if(showSelection && !state.local){
  const wanted=new URLSearchParams(location.search).get('model');
  const first=state.saved.find(m=>m.id===wanted)||state.saved.find(m=>m.name.toLowerCase().includes('altec'))||state.saved[0];
  if(first)chooseModel(first);
 }
}
function localFile(file){
 if(!file)return;
 const ext=format(file.name);
 if(!EXTENSIONS.has(ext)){notify('Formatos admitidos: GLB, OBJ y STL.');return}
 if(state.localUrl)URL.revokeObjectURL(state.localUrl);
 state.localUrl=URL.createObjectURL(file);
 const name=file.name.replace(/\.[^.]+$/,'').replace(/_/g,' ').replace(/\s+/g,' ').trim();
 state.local={id:'local-'+Date.now(),name,ext,bytes:file.size,url:state.localUrl,file,local:true};
 chooseModel(state.local);
}
$('loadButton').addEventListener('click',()=>$('fileInput').click());
$('fileInput').addEventListener('change',event=>{
 localFile(event.target.files?.[0]);event.target.value='';
});
$('saveButton').addEventListener('click',()=>{
 if(!state.local?.file||state.selected!==state.local.id)return;
 $('modelName').value=state.local.name;
 $('fileInfo').textContent=state.local.file.name+' · '+(state.local.bytes/1048576).toFixed(1)+' MB';
 $('publishError').hidden=true;
 $('accessToken').value='';
 $('publishDialog').showModal();
});
$('closeDialog').addEventListener('click',()=>{if(!state.uploading)$('publishDialog').close()});
function slugify(value){
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,54)||'modelo';
}
function base64Binary(bytes){
 const blocks=[];
 for(let i=0;i<bytes.length;i+=16384)
  blocks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
 return btoa(blocks.join(''));
}
async function apiPut(token,path,body){
 const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+path,{
  method:'PUT',
  headers:{
   Accept:'application/vnd.github+json',
   Authorization:'Bearer '+token,
   'Content-Type':'application/json',
   'X-GitHub-Api-Version':'2022-11-28'
  },
  body:JSON.stringify({message:'Publish 3D model: '+path,content:body,branch:BRANCH})
 });
 const reply=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(response.status+' · '+(reply.message||'Error en GitHub'));
 return reply;
}
$('publishForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(state.uploading)return;
 const item=state.local;
 if(!item?.file || item.id!==state.selected){notify('Primero cargá un archivo local.');return}
 if(item.file.size>MAX_UPLOAD){
  $('publishError').textContent='Para esta prueba se admiten archivos de hasta 50 MB. Reducí el peso del modelo.';
  $('publishError').hidden=false;return;
 }
 const token=$('accessToken').value.trim();
 if(!token)return;
 const name=$('modelName').value.trim()||item.name;
 const isAltec=/altec/i.test(name)||/altec/i.test(item.file.name);
 const desired=isAltec?'altec-speaker':slugify(name);
 const exact='models/'+desired+'.'+item.ext;
 const conflict=state.saved.some(m=>m.id===exact);
 const path=conflict?'models/'+desired+'-'+crypto.randomUUID().slice(0,8)+'.'+item.ext:exact;
 const button=$('confirmPublish');
 state.uploading=true;button.disabled=true;button.textContent='Guardando…';$('publishError').hidden=true;
 try{
  const bytes=new Uint8Array(await item.file.arrayBuffer());
  const content=base64Binary(bytes);
  await apiPut(token,path,content);
  // No se conserva el token después de publicar.
  $('accessToken').value='';
  $('publishDialog').close();
  const savedItem={id:path,name,ext:item.ext,bytes:item.bytes,url:URL.createObjectURL(item.file),local:false};
  // Mantener el visor visible mientras se despliega la nueva versión de Pages.
  if(state.localUrl)URL.revokeObjectURL(state.localUrl);
  state.localUrl=savedItem.url;
  state.local=null;
  state.saved=[savedItem,...state.saved.filter(m=>m.id!==path)];
  chooseModel(savedItem,{preserveScene:true});
  notify('Modelo guardado en GitHub. Ya está en el repositorio.');
  // GitHub puede tardar un instante en actualizar el listado público.
  setTimeout(()=>refreshSaved({showSelection:false}),2500);
 }catch(error){
  $('publishError').textContent='No se pudo guardar: '+error.message;
  $('publishError').hidden=false;
  console.error(error);
 }finally{
  $('accessToken').value='';
  state.uploading=false;button.disabled=false;button.textContent='Guardar modelo';
 }
});
$('publishDialog').addEventListener('click',event=>{
 if(event.target===$('publishDialog')&&!state.uploading)$('publishDialog').close();
});
refreshSaved();

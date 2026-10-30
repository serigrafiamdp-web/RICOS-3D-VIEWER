import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);
const publicBackend = Boolean(CONFIG.SUPABASE_URL?.trim() && CONFIG.SUPABASE_PUBLISHABLE_KEY?.trim());
const supabase = publicBackend ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}) : null;
const state = {publicModels:[],staticModels:[],localModels:[],selected:null,filter:'all',search:'',user:null,admin:false,activeObject:null,objectUrl:null,loadToken:0,rotation:false,wire:false,grid:false};
const ALLOWED = new Set(['glb','obj','stl']);
const MAX_BYTES = 50 * 1024 * 1024;

const canvasHost = $('viewerCanvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40,1,.01,15000);
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
canvasHost.appendChild(renderer.domElement);
const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.screenSpacePanning = true;
controls.minDistance = .12;
controls.maxDistance = 8000;
scene.add(new THREE.HemisphereLight(0xffffff,0xa6b2a6,2.5));
const keyLight = new THREE.DirectionalLight(0xffffff,3.2);keyLight.position.set(4,7,6);scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc9def9,1.5);fillLight.position.set(-5,3,-6);scene.add(fillLight);
const grid = new THREE.GridHelper(10,20,0xc4d2c5,0xd9e3d8);grid.visible=false;grid.material.transparent=true;grid.material.opacity=.46;scene.add(grid);
function resize(){
 const w=Math.max(1,canvasHost.clientWidth),h=Math.max(1,canvasHost.clientHeight);
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvasHost);resize();
function frame(){requestAnimationFrame(frame);controls.autoRotate=state.rotation;controls.autoRotateSpeed=1.6;controls.update();renderer.render(scene,camera)}frame();

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
const formatBytes=(n)=>n ? n>=1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB':'—';
function extension(name){return (name?.split('.').pop()||'').toLowerCase()}
function allModels(){return [...state.localModels,...state.publicModels,...state.staticModels]}
function getCurrent(){return allModels().find(item=>item.id===state.selected)}
function clearObject(){
 if(!state.activeObject)return;
 scene.remove(state.activeObject);
 state.activeObject.traverse(node=>{node.geometry?.dispose?.();if(node.material){for(const mat of (Array.isArray(node.material)?node.material:[node.material])){for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'])mat[key]?.dispose?.();mat.dispose?.()}}});
 state.activeObject=null;
}
function showDemo(){
 clearObject();
 const group=new THREE.Group();
 const box=new THREE.Mesh(new THREE.BoxGeometry(1.65,2.1,1.1),new THREE.MeshStandardMaterial({color:0x5a7363,roughness:.78,metalness:.05}));
 group.add(box);
 const face=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.75,.035),new THREE.MeshStandardMaterial({color:0x24392f,roughness:.9}));face.position.z=.567;group.add(face);
 const circle=new THREE.Mesh(new THREE.TorusGeometry(.38,.045,12,60),new THREE.MeshStandardMaterial({color:0xb5c7b8,roughness:.65}));circle.position.set(0,-.25,.595);group.add(circle);
 const tweeter=new THREE.Mesh(new THREE.TorusGeometry(.12,.025,10,40),new THREE.MeshStandardMaterial({color:0xb5c7b8}));tweeter.position.set(0,.52,.599);group.add(tweeter);
 state.activeObject=group;scene.add(group);
 fitCamera(group);
 $('viewerStatus').textContent='VISTA DE DEMOSTRACIÓN';
 $('stageBadge').textContent='EJEMPLO 3D';
}
function fitCamera(obj){
 const box=new THREE.Box3().setFromObject(obj);
 if(box.isEmpty())return;
 const center=box.getCenter(new THREE.Vector3());
 obj.position.sub(center);
 const size=box.getSize(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z,.1);
 camera.position.set(radius*1.45,radius*.82,radius*2.1);
 camera.near=Math.max(.001,radius/1000);camera.far=radius*250;camera.updateProjectionMatrix();
 controls.target.set(0,0,0);controls.minDistance=radius*.13;controls.maxDistance=radius*25;controls.update();
 grid.scale.setScalar(Math.max(.1,radius/3));
 grid.position.y=-size.y/2-.025*radius;
}
function applyWireframe(){state.activeObject?.traverse(n=>{if(n.isMesh){for(const m of Array.isArray(n.material)?n.material:[n.material]){if(m)m.wireframe=state.wire}}})}
async function load3D(item){
 const token=++state.loadToken;
 $('stageLoader').classList.remove('hidden');
 $('viewerStatus').textContent='CARGANDO MODELO';
 $('stageBadge').textContent=item.format.toUpperCase();
 try {
  let object;
  if(item.format==='glb'){const result=await new GLTFLoader().loadAsync(item.url);object=result.scene}
  else if(item.format==='obj'){object=await new OBJLoader().loadAsync(item.url);object.traverse(o=>{if(o.isMesh&&!o.material)o.material=new THREE.MeshStandardMaterial({color:0xc2ccc2})})}
  else if(item.format==='stl'){const geom=await new STLLoader().loadAsync(item.url);geom.computeVertexNormals();object=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0xb6c6bb,roughness:.78,side:THREE.DoubleSide}))}
  else throw new Error('Formato no admitido');
  if(token!==state.loadToken){object.traverse(o=>o.geometry?.dispose?.());return}
  clearObject();state.activeObject=object;scene.add(object);fitCamera(object);applyWireframe();
  $('viewerStatus').textContent='VISTA 3D EN TIEMPO REAL';
 }catch(error){
  if(token===state.loadToken){console.error(error);$('viewerStatus').textContent='NO SE PUDO ABRIR EL ARCHIVO';toast('No se pudo abrir el modelo. Revisá el archivo o la conexión.');showDemo()}
 }finally{if(token===state.loadToken)$('stageLoader').classList.add('hidden')}
}
function setDetails(item){
 $('detailEyebrow').textContent=item ? (item.local?'VISTA PREVIA LOCAL':item.static?'MODELO INCLUIDO':'MODELO PUBLICADO'):'MODELO DE PRESENTACIÓN';
 $('detailName').textContent=item?.name||'Tus modelos, en un solo lugar.';
 $('detailDescription').textContent=item?.description||'Abrí un archivo GLB, OBJ o STL. Los modelos publicados quedan visibles para todas las personas que visiten esta web.';
 $('detailFormat').textContent=item?.format?.toUpperCase()||'3D';
 $('detailSize').textContent=formatBytes(item?.size);
 $('copyBtn').classList.toggle('hidden',!item||Boolean(item.local));
 $('deleteBtn').classList.toggle('hidden',!item||!state.admin||!item.path);
}
function renderList(){
 const items=allModels();$('sideCount').textContent=String(items.length);$('heroCount').textContent=String(items.length).padStart(2,'0');
 const filtered=items.filter(m=>(state.filter==='all'||state.filter===m.format) && (m.name+' '+(m.description||'')).toLocaleLowerCase().includes(state.search));
 const host=$('modelList');host.replaceChildren();
 if(!filtered.length){const div=document.createElement('div');div.className='list-empty';div.textContent=items.length?'No hay modelos que coincidan con la búsqueda.':'Todavía no hay modelos publicados. Podés abrir un archivo desde tu equipo para probar el visor.';host.appendChild(div);return}
 for(const item of filtered){
  const btn=document.createElement('button');btn.type='button';btn.className='model-item'+(state.selected===item.id?' active':'');
  const thumb=document.createElement('span');thumb.className='model-icon';thumb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z M3 7l9 5 9-5 M12 12v10"/></svg>';
  const text=document.createElement('span');text.className='model-summary';const title=document.createElement('strong');title.textContent=item.name;const info=document.createElement('small');info.textContent=item.format.toUpperCase()+' · '+(item.local?'LOCAL':formatBytes(item.size));text.append(title,info);btn.append(thumb,text);
  btn.addEventListener('click',()=>selectModel(item.id));host.appendChild(btn);
 }
}
function selectModel(id){
 const item=allModels().find(m=>m.id===id);if(!item)return;
 state.selected=id;renderList();setDetails(item);load3D(item);
 if(!item.local){const url=new URL(window.location.href);url.searchParams.set('model',id);history.replaceState(null,'',url)}
}
async function loadModels(){
 if(supabase){
  const {data,error}=await supabase.from('models').select('id,name,description,file_path,file_size,format,created_at').order('created_at',{ascending:false});
  if(error){console.error(error);toast('No se pudo actualizar la galería pública')}
  else state.publicModels=(data||[]).map(m=>({id:m.id,name:m.name,description:m.description,format:m.format,size:m.file_size,path:m.file_path,url:supabase.storage.from('model-files').getPublicUrl(m.file_path).data.publicUrl}));
 }
 try{
  const response=await fetch('./models.json',{cache:'no-store'});
  if(response.ok){const data=await response.json();state.staticModels=(data.models||[]).filter(m=>ALLOWED.has(m.format)).map(m=>({...m,static:true,url:new URL(m.url,document.baseURI).href}))}
 }catch(e){console.warn('Sin manifiesto de modelos locales',e)}
 renderList();
 const requested=new URLSearchParams(window.location.search).get('model');
 if(!state.selected){const chosen=allModels().find(m=>m.id===requested)||allModels()[0];if(chosen)selectModel(chosen.id);else{setDetails(null);showDemo()}}
}
function updateAuthUi(){
 $('uploadBtn').classList.toggle('hidden',!state.admin);
 $('loginBtn').textContent=state.user?'Salir':'Administrar';
 setDetails(getCurrent());
}
async function refreshAuth(){
 if(!supabase){updateAuthUi();return}
 const {data}=await supabase.auth.getUser();state.user=data.user||null;state.admin=false;
 if(state.user){const r=await supabase.from('app_admins').select('user_id').eq('user_id',state.user.id).maybeSingle();state.admin=!!r.data}
 updateAuthUi();
}
async function signIn(event){
 event.preventDefault();if(!supabase){toast('Primero configurá Supabase en config.js');return}
 const email=$('authEmail').value.trim();const msg=$('authMessage');msg.classList.remove('hidden');msg.textContent='Enviando acceso…';
 const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});
 msg.textContent=error?'Error: '+error.message:'Revisá tu correo para entrar. Si tu cuenta está autorizada, podrás subir modelos.';
}
async function upload(event){
 event.preventDefault();
 if(!supabase||!state.admin){toast('Solo el administrador puede publicar modelos');return}
 const file=$('uploadFile').files[0],format=extension(file?.name),name=$('uploadName').value.trim();
 if(!file||!ALLOWED.has(format)||file.size>MAX_BYTES||!name){toast('Elegí un GLB, OBJ o STL de hasta 50 MB y asignale un nombre.');return}
 const b=$('publishBtn'),msg=$('uploadMessage');b.disabled=true;msg.classList.remove('hidden');msg.textContent='Subiendo archivo…';
 const path=crypto.randomUUID()+'.'+format;
 try{
  const uploaded=await supabase.storage.from('model-files').upload(path,file,{cacheControl:'3600',upsert:false,contentType:format==='glb'?'model/gltf-binary':'application/octet-stream'});
  if(uploaded.error)throw uploaded.error;
  const inserted=await supabase.from('models').insert({name,description:$('uploadDescription').value.trim(),format,file_path:path,file_size:file.size});
  if(inserted.error){await supabase.storage.from('model-files').remove([path]);throw inserted.error}
  $('uploadDialog').close();$('uploadForm').reset();$('fileZoneTitle').textContent='Elegir archivo 3D';$('fileZoneSubtitle').textContent='GLB, OBJ o STL · hasta 50 MB';toast('Modelo publicado para todos.');
  state.selected=null;await loadModels();
 }catch(error){console.error(error);msg.textContent='No se pudo publicar: '+error.message}
 finally{b.disabled=false}
}
async function deleteCurrent(){
 const item=getCurrent();
 if(!supabase||!state.admin||!item?.path||!confirm('¿Eliminar "'+item.name+'" de la galería pública?'))return;
 const result=await supabase.from('models').delete().eq('id',item.id);
 if(result.error){toast('Error al eliminar: '+result.error.message);return}
 const blob=await supabase.storage.from('model-files').remove([item.path]);
 if(blob.error)console.warn('Modelo quitado de la galería; el archivo de Storage requiere revisión',blob.error);
 state.selected=null;await loadModels();toast('Modelo eliminado.');
}
function preview(file){
 if(!file)return;
 const format=extension(file.name);if(!ALLOWED.has(format)){toast('Usá GLB, OBJ o STL.');return}
 if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=URL.createObjectURL(file);
 const item={id:'local-'+Date.now(),name:file.name.replace(/\.[^/.]+$/,''),description:'Vista temporal desde tu equipo. Este archivo no está publicado para otras personas.',format,size:file.size,url:state.objectUrl,local:true};
 state.localModels=[item];state.selected=null;renderList();selectModel(item.id);
}
$('searchInput').addEventListener('input',e=>{state.search=e.target.value.toLocaleLowerCase().trim();renderList()});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement?.tagName!=='INPUT'&&document.activeElement?.tagName!=='TEXTAREA'){e.preventDefault();$('searchInput').focus()}});
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));renderList()}));
$('localPreviewBtn').addEventListener('click',()=>$('localFileInput').click());
$('localFileInput').addEventListener('change',e=>preview(e.target.files[0]));
$('uploadFile').addEventListener('change',e=>{const f=e.target.files[0];if(f){$('fileZoneTitle').textContent=f.name;$('fileZoneSubtitle').textContent=formatBytes(f.size);if(!$('uploadName').value)$('uploadName').value=f.name.replace(/\.[^/.]+$/,'')}});
$('loginBtn').addEventListener('click',async()=>{
 if(state.user&&supabase){await supabase.auth.signOut();await refreshAuth();toast('Sesión cerrada')}
 else if(!supabase)toast('Falta conectar Supabase para habilitar el acceso de administrador.');
 else $('authDialog').showModal();
});
$('uploadBtn').addEventListener('click',()=>$('uploadDialog').showModal());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(''+b.dataset.close).close()));
$('authForm').addEventListener('submit',signIn);
$('uploadForm').addEventListener('submit',upload);
$('deleteBtn').addEventListener('click',deleteCurrent);
$('copyBtn').addEventListener('click',async()=>{const url=location.href;try{await navigator.clipboard.writeText(url);toast('Enlace copiado')}catch{prompt('Copiá el enlace del modelo',url)}});
$('resetBtn').addEventListener('click',()=>{const object=state.activeObject;if(object)fitCamera(object)});
$('rotateBtn').addEventListener('click',()=>{state.rotation=!state.rotation;$('rotateBtn').setAttribute('aria-pressed',String(state.rotation))});
$('gridBtn').addEventListener('click',()=>{state.grid=!state.grid;grid.visible=state.grid;$('gridBtn').setAttribute('aria-pressed',String(state.grid))});
$('wireBtn').addEventListener('click',()=>{state.wire=!state.wire;applyWireframe();$('wireBtn').setAttribute('aria-pressed',String(state.wire))});
$('fullscreenBtn').addEventListener('click',async()=>{if(document.fullscreenElement)await document.exitFullscreen();else if($('viewerStage').requestFullscreen)await $('viewerStage').requestFullscreen()});
$('year').textContent=String(new Date().getFullYear());
$('setupNotice').classList.toggle('hidden',publicBackend);
if(supabase){supabase.auth.onAuthStateChange(()=>{setTimeout(refreshAuth,0)})}
await refreshAuth();
await loadModels();
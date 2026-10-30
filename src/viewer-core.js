import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';

export function initialize(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40,1,0.001,100000);
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.setClearColor(0xffffff,0);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff,0xa3b5a7,2.3));
  const mainLight = new THREE.DirectionalLight(0xffffff,3);
  mainLight.position.set(4,7,6);
  scene.add(mainLight);
  const fill = new THREE.DirectionalLight(0xddeafa,1.5);
  fill.position.set(-5,2,-5);
  scene.add(fill);

  const controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.screenSpacePanning = true;
  camera.position.set(2,1.4,3);
  controls.update();
  let current = null;
  let requestId = 0;

  function resize() {
    const w=Math.max(1,container.clientWidth), h=Math.max(1,container.clientHeight);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  let destroyed=false;
  function render() {
    if(destroyed)return;
    requestAnimationFrame(render);
    controls.update();
    renderer.render(scene,camera);
  }
  render();

  function dispose(object) {
    if(!object)return;
    scene.remove(object);
    object.traverse(n=>{
      n.geometry?.dispose?.();
      if(!n.material)return;
      const materials=Array.isArray(n.material)?n.material:[n.material];
      for(const mat of materials) {
        if(!mat)continue;
        for(const k of ['map','aoMap','normalMap','emissiveMap','roughnessMap','metalnessMap','alphaMap'])mat[k]?.dispose?.();
        mat.dispose?.();
      }
    });
  }
  function fit(object) {
    const bounds=new THREE.Box3().setFromObject(object);
    if(bounds.isEmpty())return;
    const center=bounds.getCenter(new THREE.Vector3());
    const size=bounds.getSize(new THREE.Vector3());
    object.position.sub(center);
    const max=Math.max(size.x,size.y,size.z,0.01);
    const fov=(camera.fov*Math.PI)/180;
    const distance=(max/(2*Math.tan(fov/2)))*1.4;
    camera.position.set(distance*.65,distance*.37,distance);
    camera.near=Math.max(0.00001,max/5000);
    camera.far=Math.max(100,max*500);
    camera.updateProjectionMatrix();
    controls.minDistance=max*.1;
    controls.maxDistance=max*80;
    controls.target.set(0,0,0);
    controls.update();
  }

  async function open(model) {
    const token=++requestId;
    const type=model.ext;
    let object;
    try {
      if(type==='glb') {
        const result=await new GLTFLoader().loadAsync(model.url);
        object=result.scene;
      } else if(type==='obj') {
        object=await new OBJLoader().loadAsync(model.url);
      } else if(type==='stl') {
        const geom=await new STLLoader().loadAsync(model.url);
        if(!geom.attributes.normal)geom.computeVertexNormals();
        object=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0xc3cdc3,roughness:.8,side:THREE.DoubleSide}));
      } else throw new Error('Formato no compatible');
      if(token!==requestId){dispose(object);return false;}
      if(current)dispose(current);
      current=object;
      scene.add(object);
      fit(object);
      return true;
    } catch(error) {
      if(object)dispose(object);
      throw error;
    }
  }
  function clear() {
    requestId++;
    if(current)dispose(current);
    current=null;
  }
  return {open,clear};
}

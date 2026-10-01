import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {TDSLoader} from "three/addons/loaders/TDSLoader.js";

const $=id=>document.getElementById(id);
let scene,camera,renderer,controls,model,selected=null,wireMode=false,urls=[];
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();

function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0xf0f2f4);
 camera=new THREE.PerspectiveCamera(45,1,.01,100000);
 renderer=new THREE.WebGLRenderer({canvas:$("canvas"),antialias:true,powerPreference:"high-performance"});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.screenSpacePanning=true;
 scene.add(new THREE.HemisphereLight(0xffffff,0x9aa1aa,1.8));
 const a=new THREE.DirectionalLight(0xffffff,2.2);a.position.set(4,7,5);scene.add(a);
 const b=new THREE.DirectionalLight(0xffffff,.8);b.position.set(-4,3,-5);scene.add(b);
 resize();window.addEventListener("resize",resize);animate();
}
function resize(){if(!renderer)return;const r=$("viewer").getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}
function cleanup(){
 urls.forEach(u=>URL.revokeObjectURL(u));urls=[];
 if(model){scene.remove(model);model.traverse(o=>{if(o.geometry)o.geometry.dispose()});model=null}
 selected=null;$("selection").classList.add("hidden");$("parts").innerHTML="";
}
function fit(){
 if(!model)return;const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),max=Math.max(size.x,size.y,size.z)||1;
 const dist=max/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.35;
 camera.near=max/100000;camera.far=max*100;camera.position.copy(center).add(new THREE.Vector3(1,.75,1).normalize().multiplyScalar(dist));controls.target.copy(center);controls.minDistance=max*.005;controls.maxDistance=max*50;controls.update();
}
function materialTextured(){
 if(!model)return;model.traverse(o=>{if(o.isMesh){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{m.wireframe=false;m.transparent=false;m.opacity=1;m.side=THREE.FrontSide;m.depthTest=true;m.depthWrite=true;if(m.map){m.map.colorSpace=THREE.SRGBColorSpace;m.map.needsUpdate=true}})}})
}
function wire(on){
 wireMode=on;if(!model)return;
 model.traverse(o=>{if(!o.isMesh)return; if(o.userData.edges){o.remove(o.userData.edges);o.userData.edges.geometry.dispose();o.userData.edges.material.dispose();o.userData.edges=null}
  if(on){const g=new THREE.EdgesGeometry(o.geometry,25);const m=new THREE.LineBasicMaterial({color:0x4f5864,transparent:true,opacity:.9,depthTest:true,depthWrite:false});const l=new THREE.LineSegments(g,m);l.renderOrder=2;o.add(l);o.userData.edges=l}
 });
}
function makeParts(){
 const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o)});
 const list=$("parts");list.innerHTML="";
 meshes.forEach((m,i)=>{
   if(!m.name)m.name=`Деталь ${i+1}`;
   const row=document.createElement("div");row.className="part";
   const n=document.createElement("span");n.textContent=m.name;
   const show=document.createElement("button");show.textContent="Показать";show.onclick=()=>m.visible=true;
   const hide=document.createElement("button");hide.textContent="Скрыть";hide.onclick=()=>m.visible=false;
   row.append(n,show,hide);list.append(row);
 });
}
function select(mesh){
 if(selected){const ms=Array.isArray(selected.material)?selected.material:[selected.material];ms.forEach(m=>m.emissive?.setHex(0))}
 selected=mesh;
 if(selected){const ms=Array.isArray(selected.material)?selected.material:[selected.material];ms.forEach(m=>m.emissive?.setHex(0x263cff));$("selName").textContent=selected.name||"Деталь";$("selection").classList.remove("hidden")}
}
function pick(e){if(!model)return;const r=renderer.domElement.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width*2-1;pointer.y=-(e.clientY-r.top)/r.height*2+1;raycaster.setFromCamera(pointer,camera);const h=raycaster.intersectObject(model,true).find(x=>x.object.isMesh&&!x.object.userData.edges);if(h)select(h.object)}
async function loadZip(file){
 cleanup();$("status").textContent="Распаковываю ZIP…";
 const zip=await JSZip.loadAsync(file),entries=Object.values(zip.files).filter(x=>!x.dir),tds=entries.find(x=>/\.3ds$/i.test(x.name));if(!tds)throw Error("В ZIP нет файла 3DS");
 const tex=new Map();
 for(const e of entries){if(/\.(bmp|jpg|jpeg|png|gif|tga)$/i.test(e.name)){const blob=await e.async("blob"),u=URL.createObjectURL(blob);urls.push(u);tex.set(e.name.replaceAll("\\","/").toLowerCase(),u);tex.set(e.name.split(/[\\/]/).pop().toLowerCase(),u)}}
 const manager=new THREE.LoadingManager();
 manager.setURLModifier(url=>{const n=url.replaceAll("\\","/").toLowerCase();return tex.get(n)||tex.get(n.split("/").pop())||url});
 const loader=new TDSLoader(manager);
 const buf=await tds.async("arraybuffer");
 model=loader.parse(buf);
 scene.add(model);materialTextured();makeParts();fit();
 $("welcome").classList.add("hidden");$("viewer").classList.remove("hidden");$("status").textContent=`Готово: ${tds.name}`;
}
$("choose").onclick=()=>$("file").click();
$("file").onchange=e=>e.target.files[0]&&loadZip(e.target.files[0]).catch(err=>{console.error(err);$("status").textContent="Ошибка: "+err.message;alert("Ошибка загрузки: "+err.message)});
$("fit").onclick=fit;$("reset").onclick=()=>{materialTextured();wire(false);$("solid").classList.add("active");$("wire").classList.remove("active");fit()};
$("solid").onclick=()=>{materialTextured();wire(false);$("solid").classList.add("active");$("wire").classList.remove("active")};
$("wire").onclick=()=>{wire(true);$("wire").classList.add("active");$("solid").classList.remove("active")};
$("hide").onclick=()=>{if(selected){selected.visible=false;$("selection").classList.add("hidden")}};
$("unselect").onclick=()=>{$("selection").classList.add("hidden");selected=null};
$("showAll").onclick=()=>model?.traverse(o=>{if(o.isMesh)o.visible=true});
renderer?.domElement?.addEventListener("click",pick);
function animate(){requestAnimationFrame(animate);controls?.update();renderer?.render(scene,camera)}
init();
renderer.domElement.addEventListener("pointerup",e=>{if(renderer.domElement._down){const d=Math.hypot(e.clientX-renderer.domElement._down.x,e.clientY-renderer.domElement._down.y);if(d<6)pick(e);renderer.domElement._down=null}});
renderer.domElement.addEventListener("pointerdown",e=>renderer.domElement._down={x:e.clientX,y:e.clientY});

import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const $=s=>document.querySelector(s), canvas=$('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
const scene=new THREE.Scene();scene.background=new THREE.Color('#eeeade');
const camera=new THREE.PerspectiveCamera(43,1,.025,70);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.20;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.94;controls.target.set(-.4,1.15,-.18);
const hemi=new THREE.HemisphereLight(0xd6e5e6,0x756b4e,1.3);scene.add(hemi);
const ambient=new THREE.AmbientLight(0xffedcc,.17);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffe0a3,3.3);sun.position.set(-3,5,.9);sun.target.position.set(-.2,.7,0);scene.add(sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:14});sun.shadow.bias=-.00013;sun.shadow.normalBias=.009;sun.shadow.radius=1.3;
// Blender is Z up; glTF and Three.js use Y up, with Blender Y mapping to -Z.
const views={
 reference:{p:[1.65,2.02,2.72],t:[-.40,1.04,-.08],fov:43,label:'参考图视角',description:'暖木、奶油色与树叶的影子。'},
 seated:{p:[-.24,1.18,.95],t:[-.26,.83,-.02],fov:67,label:'坐在桌前',description:'早餐在面前，左侧是可以倚靠的厚窗台。'},
 overview:{p:[3.6,3.1,4.2],t:[-.22,1.0,-.0],fov:46,label:'空间全貌',description:'转动看看桌下、椅后与转角窗的真实距离。'}
};
let active='reference',transition=null,ready=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
// The visible leaves and their shadow depth pass share exactly the same wind displacement.
const windUniforms={uWindTime:{value:0},uWindStrength:{value:reduced?0:.45}};
let windPaused=reduced,lastFrame=null;
const windGLSL=`
uniform float uWindTime;
uniform float uWindStrength;
vec3 windPosition(vec3 p) {
  float t=uWindTime;
  float phase=p.x*1.7+p.y*2.3+p.z*.8;
  float gust=.68+.24*sin(t*.43)+.08*sin(t*.91);
  float sway=sin(t*1.35+phase)*.060+sin(t*2.1+phase*1.7)*.022;
  float flutter=sin(t*4.3+p.x*11.0+p.y*9.0+p.z*6.0)*.009;
  return p+uWindStrength*gust*vec3(sway, sway*.42+flutter, flutter*.55);
}`;
function windMaterial(material){
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,windUniforms);
  shader.vertexShader=windGLSL+"\n"+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed = windPosition(transformed);');
 };
 material.customProgramCacheKey=()=> 'breakfast-wind-v1';
 return material;
}
function setWindLabel(){
 $('#wind-value').value=windPaused?'已暂停':$('#wind').value+'%';
 $('#wind-pause').textContent=windPaused?'开启风':'暂停风';
 $('#wind-pause').setAttribute('aria-pressed',String(windPaused));
}
$('#wind').value=reduced?'0':'45';
$('#wind').oninput=e=>{windUniforms.uWindStrength.value=Number(e.target.value)/100;windPaused=false;setWindLabel();};
$('#wind-pause').onclick=()=>{windPaused=!windPaused;if(!windPaused&&windUniforms.uWindStrength.value===0){windUniforms.uWindStrength.value=.45;$('#wind').value='45';}setWindLabel();};
setWindLabel();
function applyView(name,animate=true){active=name;const v=views[name];const p=new THREE.Vector3(...v.p),t=new THREE.Vector3(...v.t);
 if(animate&&!reduced)transition={start:performance.now(),p:camera.position.clone(),t:controls.target.clone(),f:camera.fov,endP:p,endT:t,endF:v.fov};
 else{transition=null;camera.position.copy(p);controls.target.copy(t);camera.fov=v.fov;camera.updateProjectionMatrix();controls.update();}
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
 $('#view-label').textContent=v.label;$('#view-description').textContent=v.description;
}
controls.addEventListener('start',()=>{transition=null;});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>applyView(b.dataset.view)));
$('#reset').onclick=()=>applyView(active);
function zoom(f){transition=null;camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);controls.update();}
$('#zoom-in').onclick=()=>zoom(.82);$('#zoom-out').onclick=()=>zoom(1.22);
function pan(d){transition=null;const v=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0).multiplyScalar(d*camera.position.distanceTo(controls.target)*.08);camera.position.add(v);controls.target.add(v);controls.update();}
$('#pan-left').onclick=()=>pan(-1);$('#pan-right').onclick=()=>pan(1);
canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','r','1','2','3'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')pan(-1);if(e.key==='ArrowRight')pan(1);if(['+','ArrowUp'].includes(e.key))zoom(.9);if(['-','ArrowDown'].includes(e.key))zoom(1.1);if(e.key==='r')applyView(active);if('123'.includes(e.key))applyView(['reference','seated','overview'][+e.key-1]);}});
$('#sun').oninput=e=>{sun.intensity=.65+Number(e.target.value)*.035;$('#sun-value').value=e.target.value+'%';};
$('#measure').onclick=()=>{const show=$('#dimensions').hidden;$('#dimensions').hidden=!show;$('#measure').setAttribute('aria-pressed',String(show));};
$('#reference').onclick=()=>$('#reference-dialog').showModal();
$('#reference-dialog').addEventListener('click',e=>{if(e.target===$('#reference-dialog'))$('#reference-dialog').close();});
$('#save-image').onclick=()=>{renderer.render(scene,camera);const url=canvas.toDataURL('image/png');$('#capture-image').src=url;$('#capture-download').href=url;$('#capture-download').download=`窗边早餐-${views[active].label}.png`;$('#capture-dialog').showModal();};
const labels={table:new THREE.Vector3(.10,.755,.30),seat:new THREE.Vector3(-.01,.45,.94),sill:new THREE.Vector3(-.7,.903,.65)};
function resize(){const w=innerWidth,h=$('#stage').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();applyView('reference',false);
new GLTFLoader().load('./assets/breakfast-corner.glb',gltf=>{
 let meshes=0;
 gltf.scene.traverse(o=>{if(o.isMesh){meshes++;o.castShadow=true;o.receiveShadow=true;if(o.name.startsWith('GLASS')){o.castShadow=false;o.receiveShadow=false;o.material=new THREE.MeshPhysicalMaterial({color:0xe2ebe0,transparent:true,opacity:.075,roughness:.12,metalness:.05,depthWrite:false,side:THREE.DoubleSide});}if(o.name.includes('Tree_leaves')||o.name.includes('Tree leaves')){o.material.side=THREE.DoubleSide;o.material.shadowSide=THREE.DoubleSide;windMaterial(o.material);o.customDepthMaterial=windMaterial(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}));o.frustumCulled=false;}}});
 scene.add(gltf.scene);ready=true;$('#loading').remove();canvas.dataset.loaded='true';console.info(`Breakfast model loaded: ${meshes} meshes`);
},undefined,error=>{$('#loading').remove();$('#error').hidden=false;$('#error-message').textContent='模型未能载入，请检查网络连接后重新载入。';console.error(error);});
function render(now){requestAnimationFrame(render);
 const dt=lastFrame===null?0:Math.min((now-lastFrame)/1000,.1);lastFrame=now;if(!windPaused&&!document.hidden)windUniforms.uWindTime.value+=dt;
 if(transition){const t=Math.min((now-transition.start)/850,1),k=t*t*(3-2*t);camera.position.lerpVectors(transition.p,transition.endP,k);controls.target.lerpVectors(transition.t,transition.endT,k);camera.fov=THREE.MathUtils.lerp(transition.f,transition.endF,k);camera.updateProjectionMatrix();if(t===1)transition=null;}
 controls.update();renderer.render(scene,camera);
 if(!$('#dimensions').hidden){for(const [name,p] of Object.entries(labels)){const s=p.clone().project(camera),el=$(`[data-point="${name}"]`);el.style.left=(s.x*.5+.5)*canvas.clientWidth+'px';el.style.top=(-s.y*.5+.5)*canvas.clientHeight+'px';el.style.display=s.z>1?'none':'';}}
}
requestAnimationFrame(render);

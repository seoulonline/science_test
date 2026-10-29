import * as THREE from './vendor/three/three.module.min.js';

/** A spatial representation of the same ideal DC model, not a field solver. */
export function createCircuit3D(container, onContextLost, onBatteryInspect) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xf0f3eb);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
  const target = new THREE.Vector3(0, .4, 0);
  const home = { theta: -.2, phi: .61, distance: 17.8 };
  let orbit = { ...home }, active = false, visible = true, playing = false, raf = 0, lastTime = 0, time = 0;
  let latestResult = null, batteryFocused = false;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7c8e76, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(-4, 10, 6); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left:-9, right:9, top:8, bottom:-8 });
  sun.shadow.mapSize.set(1024,1024); sun.shadow.bias = -.001;
  scene.add(sun);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .18 });
  const colors = { common:0x477c61, r2:0x8873b3, r3:0xc08a50 };
  const mats = { common:material(colors.common), r2:material(colors.r2), r3:material(colors.r3), metal:material(0xa3ac9b), contact:material(0xc8a060) };
  const board = new THREE.Mesh(new THREE.BoxGeometry(13.1,.22,7.7), material(0xfcfdf9));
  board.position.y = -.13; board.receiveShadow = true; scene.add(board);
  const grid = new THREE.GridHelper(12,24,0xd8e0d0,0xe6ebde); grid.position.y=.005; grid.scale.z=.56; scene.add(grid);
  for(const x of [-6,6])for(const z of [-3.3,3.3]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.035,12), mats.metal); screw.position.set(x,.015,z);scene.add(screw);
  }
  function rod(from,to,radius,mat,group=scene) {
    const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),12),mat);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    mesh.castShadow=true;group.add(mesh);return mesh;
  }
  function wire(points,mat) { for(let i=1;i<points.length;i++)rod(points[i-1],points[i],.045,mat); }
  const y=.65;
  wire([[1,y,2.5],[-5,y,2.5],[-5,y,.9]],mats.common);
  wire([[-5,y,-.9],[-5,y,-2.5],[1,y,-2.5]],mats.common);
  wire([[1,y,-2.5],[1,y,2.5]],mats.r2);
  wire([[1,y,-2.5],[5,y,-2.5],[5,y,1.1]],mats.r3);
  wire([[5,y,2.1],[5,y,2.5],[1,y,2.5]],mats.r3);
  function box(size,position,mat) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  box([1.65,.55,.62],[-2,y,-2.5],mats.common);
  box([.62,.55,1.45],[1,y,0],mats.r2);
  box([.62,.55,1.45],[5,y,0],mats.r3);
  for(const [x,z] of [[-2.55,-2.5],[-1.45,-2.5],[1,-.45],[1,.45],[5,-.45],[5,.45]]) {
    const band=box(x===1||x===5?[.65,.57,.07]:[.07,.57,.65],[x,y,z],mats.contact);band.castShadow=false;
  }
  const battery=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,1.8,32),material(0x416d62));
  battery.rotation.x=Math.PI/2;battery.position.set(-5,y,0);battery.castShadow=true;scene.add(battery);
  rod([-5,y,-.9],[-5,y,-1.06],.22,mats.contact);
  const batteryInside=new THREE.Group();batteryInside.position.set(-5,y,0);batteryInside.visible=false;scene.add(batteryInside);
  const insideMaterial=material(0xc49b55);
  function insideBox(size,position,mat) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...position);batteryInside.add(mesh);return mesh;
  }
  const internalResistor=insideBox([.27,.28,.45],[0,0,-.38],insideMaterial);
  insideBox([.38,.4,.045],[0,0,.3],mats.common);
  insideBox([.25,.22,.045],[0,0,.48],mats.common);
  rod([0,0,-.9],[0,0,.3],.025,mats.common,batteryInside);
  rod([0,0,.48],[0,0,.9],.025,mats.common,batteryInside);

  const terminals=[];
  for(const z of [1.1,2.1]) {
    const contact=new THREE.Mesh(new THREE.SphereGeometry(.105,12,8),mats.contact);contact.position.set(5,y,z);scene.add(contact);terminals.push(contact);
  }
  let switchArm=null;
  for(const z of [-2.5,2.5]) {
    const node=new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),mats.common);node.position.set(1,y,z);scene.add(node);
    rod([1,0,z],[1,y,z],.07,mats.metal);
  }
  function arrow(at,direction,mat) {
    const mesh=new THREE.Mesh(new THREE.ConeGeometry(.14,.33,12),mat);mesh.position.set(...at);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...direction));scene.add(mesh);return mesh;
  }
  arrow([-3.6,y,-2.5],[1,0,0],mats.common);arrow([1,y,-1.4],[0,0,1],mats.r2);const arrow3=arrow([3.2,y,-2.5],[1,0,0],mats.r3);
  const labels={};
  function label(key,position) {
    const interactive=key==='battery'||key==='internal';
    const node=document.createElement(interactive?'button':'span');node.className='scene-label';
    if(interactive){node.type='button';node.classList.add('scene-battery-action');node.addEventListener('click',e=>{e.stopPropagation();onBatteryInspect?.();});node.setAttribute('aria-controls','battery-inspector');}
    else node.setAttribute('aria-hidden','true');
    if(key==='a'||key==='b')node.classList.add('scene-node-label');
    container.append(node);labels[key]={node,position:new THREE.Vector3(...position)};
  }
  label('battery',[-5,1.5,.35]);label('internal',[-5,1.8,-1.55]);label('r1',[-2,1.5,-2.6]);
  label('r2',[1,1.6,-.1]);label('r3',[5,1.6,-.1]);
  label('a',[1,.9,-3.3]);label('b',[1,.9,3.3]);label('switch',[4.8,1,3.25]);
  label('plus',[-5,.8,-1.35]);label('minus',[-5,.8,1.35]);
  function write(key,text,color='#345944') {
    labels[key].node.textContent=text.replace(' · ','\n');labels[key].node.style.color=color;
  }
  write('a','A');write('b','B');write('plus','+');write('minus','−');
  function path(points) {
    const vectors=points.map(p=>new THREE.Vector3(...p)),lengths=[0];
    for(let i=1;i<vectors.length;i++)lengths.push(lengths.at(-1)+vectors[i].distanceTo(vectors[i-1]));
    return { length:lengths.at(-1), point(distance) {
      const d=((distance%this.length)+this.length)%this.length;
      for(let i=1;i<lengths.length;i++)if(d<=lengths[i])return vectors[i-1].clone().lerp(vectors[i],(d-lengths[i-1])/(lengths[i]-lengths[i-1]));
      return vectors.at(-1).clone();
    }};
  }
  const streams=[
    {key:'i1',route:path([[1,y,2.5],[-5,y,2.5],[-5,y,-2.5],[1,y,-2.5]]),color:0x77b88e,count:15},
    {key:'i2',route:path([[1,y,-2.5],[1,y,2.5]]),color:0xbca5df,count:6},
    {key:'i3',route:path([[1,y,-2.5],[5,y,-2.5],[5,y,2.5],[1,y,2.5]]),color:0xf1bd78,count:11}
  ];
  const particleGeometry=new THREE.SphereGeometry(.085,10,8);
  for(const stream of streams) {
    const mat=new THREE.MeshBasicMaterial({color:stream.color});
    stream.particles=Array.from({length:stream.count},()=>{const mesh=new THREE.Mesh(particleGeometry,mat);scene.add(mesh);return mesh;});
  }
  function cameraUpdate() {
    const {theta,phi,distance}=orbit;
    camera.position.set(target.x+distance*Math.sin(phi)*Math.sin(theta),target.y+distance*Math.cos(phi),target.z+distance*Math.sin(phi)*Math.cos(theta));
    camera.lookAt(target);container.dataset.camera=`${theta.toFixed(3)},${phi.toFixed(3)},${distance.toFixed(3)}`;
  }
  function paint() {
    if(!active||!visible||!latestResult)return;
    for(const stream of streams)stream.particles.forEach((mesh,i)=>{
      const current=latestResult[stream.key];mesh.visible=current>0;
      mesh.position.copy(stream.route.point(i*stream.route.length/stream.count+time*current*1.5));mesh.position.y+=.06;
    });
    renderer.render(scene,camera);
    for(const {node,position} of Object.values(labels)) {
      const screen=position.clone().project(camera),width=container.clientWidth,height=container.clientHeight;
      const half=Math.min(node.offsetWidth/2+5,width/2);
      node.style.left=`${THREE.MathUtils.clamp((screen.x*.5+.5)*width,half,width-half)}px`;
      node.style.top=`${THREE.MathUtils.clamp((-screen.y*.5+.5)*height,20,height-20)}px`;
      node.hidden=screen.z>1||(node===labels.internal.node&&!batteryInside.visible)||(batteryFocused&&!['battery','internal','plus','minus'].some(key=>labels[key].node===node));
    }
  }
  function frame(now) {
    raf=0;if(!active||!visible||document.hidden||!playing)return;
    time+=Math.min((now-lastTime)/1000,.08);lastTime=now;paint();raf=requestAnimationFrame(frame);
  }
  function schedule() {
    if(active&&visible&&!document.hidden&&playing&&!raf){lastTime=performance.now();raf=requestAnimationFrame(frame);}
    if((!active||!visible||document.hidden||!playing)&&raf){cancelAnimationFrame(raf);raf=0;}
    paint();
  }
  function resize() {
    const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    // Preserve a complete board on narrow screens, while keeping the camera's zoom controls useful.
    camera.fov=width<480?55:40;camera.updateProjectionMatrix();paint();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();});observer.observe(container);
  document.addEventListener('visibilitychange',schedule);
  const pointers=new Map();let pinch=0,pointerStart=null;
  const raycaster=new THREE.Raycaster();
  container.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;pointerStart={x:e.clientX,y:e.clientY};container.focus({preventScroll:true});pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});container.setPointerCapture(e.pointerId);});
  container.addEventListener('pointermove',e=>{
    const previous=pointers.get(e.pointerId);if(!previous)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const[a,b]=[...pointers.values()];const gap=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)orbit.distance=THREE.MathUtils.clamp(orbit.distance*pinch/gap,6,30);pinch=gap;}
    else {orbit.theta-=(e.clientX-previous.x)*.006;orbit.phi=THREE.MathUtils.clamp(orbit.phi+(e.clientY-previous.y)*.006,.07,1.35);}
    cameraUpdate();paint();
  });
  function release(e){
    if(e.type==='pointerup'&&pointers.has(e.pointerId)&&pointers.size===1&&pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)<5){
      const rect=container.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
      if(raycaster.intersectObjects([battery,internalResistor],false).length)onBatteryInspect?.();
    }
    pointers.delete(e.pointerId);pinch=0;
  }
  container.addEventListener('pointerup',release);container.addEventListener('pointercancel',release);container.addEventListener('lostpointercapture',release);
  function zoom(factor){orbit.distance=THREE.MathUtils.clamp(orbit.distance*factor,6,30);cameraUpdate();paint();}
  container.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.sign(e.deltaY)*.08));},{passive:false});
  container.addEventListener('keydown',e=>{
    const actions={ArrowLeft:()=>orbit.theta-=.12,ArrowRight:()=>orbit.theta+=.12,ArrowUp:()=>orbit.phi= Math.max(.07,orbit.phi-.1),ArrowDown:()=>orbit.phi=Math.min(1.35,orbit.phi+.1),'+':()=>zoom(.9),'=':()=>zoom(.9),'-':()=>zoom(1.1),Home:()=>{orbit={...home};target.set(0,.4,0);batteryFocused=false;}};
    if(actions[e.key]){e.preventDefault();actions[e.key]();cameraUpdate();paint();}
  });
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;schedule();onContextLost?.();});
  cameraUpdate();resize();
  return {
    update(state,result,options={}) {
      latestResult=result;playing=options.playing;
      const f=n=>n.toFixed(2);
      write('battery',`ε ${state.voltage} V · V ${f(result.terminalVoltage)} V`);
      write('internal',`내부 r = ${state.internalR ?? 0} Ω`,'#92602f');
      batteryInside.visible=Boolean(options.batteryOpen);
      labels.battery.position.set(...(options.batteryOpen?[-3.3,1.3,1.25]:[-5,1.5,.35]));
      if(!options.batteryOpen&&batteryFocused){target.set(0,.4,0);orbit={...home};batteryFocused=false;cameraUpdate();}
      battery.material.transparent=Boolean(options.batteryOpen);battery.material.opacity=options.batteryOpen?.16:1;
      battery.material.depthWrite=!options.batteryOpen;battery.material.needsUpdate=true;battery.castShadow=!options.batteryOpen;
      labels.battery.node.setAttribute('aria-label','배터리 내부 등가 모형 살펴보기');
      labels.internal.node.setAttribute('aria-label','내부 저항 살펴보기');
      labels.battery.node.setAttribute('aria-expanded',String(Boolean(options.batteryOpen)));
      container.dataset.batteryOpen=String(Boolean(options.batteryOpen));
      write('r1',`R₁ ${state.r1} Ω · I₁ ${f(result.i1)} A`);
      write('r2',`R₂ ${state.r2} Ω · I₂ ${f(result.i2)} A`,'#725b98');
      write('r3',`R₃ ${state.r3} Ω · I₃ ${f(result.i3)} A`,'#92602f');
      write('switch',state.closed?'스위치 닫힘':'스위치 열림');
      if(switchArm){scene.remove(switchArm);switchArm.geometry.dispose();}
      switchArm=rod([5,y,1.1],state.closed?[5,y,2.1]:[5,y+1,1.55],.065,mats.contact);
      arrow3.visible=state.closed;
      for(const key of ['r2','r3']){
        const selected=options.law==='voltage'&&options.branch===key&&(key!=='r3'||state.closed);
        mats[key].emissive.set(selected?colors[key]:0);mats[key].emissiveIntensity=selected?.25:0;
        mats[key].color.set(key==='r3'&&!state.closed?0xb8b4a8:colors[key]);
      }
      container.setAttribute('aria-label',`3D 회로. 전지 ${state.voltage} V. R₁ ${state.r1} Ω, R₂ ${state.r2} Ω, R₃ ${state.r3} Ω. I₁ ${f(result.i1)} A, I₂ ${f(result.i2)} A, I₃ ${f(result.i3)} A. 스위치 ${state.closed?'닫힘':'열림'}. 방향키로 회전, + 또는 -로 확대·축소.`);
      container.dataset.i1=f(result.i1);container.dataset.i2=f(result.i2);container.dataset.i3=f(result.i3);container.dataset.closed=String(state.closed);
      container.dataset.playing=String(playing);schedule();
    },
    setActive(value){active=value;if(active)resize();schedule();},
    resetCamera(){orbit={...home};target.set(0,.4,0);batteryFocused=false;cameraUpdate();paint();},
    focusBattery(){target.set(-4.6,.45,0);orbit={theta:-.4,phi:.7,distance:6.5};batteryFocused=true;cameraUpdate();paint();},
    top(){orbit={theta:0,phi:.07,distance:17.8};target.set(0,.4,0);batteryFocused=false;cameraUpdate();paint();},
    zoom,
    dispose(){active=false;schedule();resizeObserver.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',schedule);scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of [o.material].flat()){m.map?.dispose();m.dispose();}}});renderer.dispose();container.replaceChildren();}
  };
}

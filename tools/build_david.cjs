// Bake the attributed source GLB into closed horizontal slices. No build step
// or remote model service is needed by the portfolio at runtime.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const T = require('../assets/vendor/three.min.js');
const root = path.resolve(__dirname, '..');
const input = process.argv[2] || path.join(root, 'tmp/david/complete.glb');
const buffer = fs.readFileSync(input);
if (buffer.length !== buffer.readUInt32LE(8)) throw Error('Incomplete GLB');
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
const binOffset = 28 + jsonLength;
function accessor(id) {
  const a = gltf.accessors[id], v = gltf.bufferViews[a.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const bytes = { 5126: 4, 5125: 4, 5123: 2 }[a.componentType];
  const read = { 5126: 'readFloatLE', 5125: 'readUInt32LE', 5123: 'readUInt16LE' }[a.componentType];
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, k) =>
    buffer[read](binOffset + (v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || width * bytes) + k * bytes)));
}
let triangles = [];
function visit(id, parent) {
  const node = gltf.nodes[id];
  const local = node.matrix ? new T.Matrix4().fromArray(node.matrix) : new T.Matrix4().compose(
    new T.Vector3().fromArray(node.translation || [0,0,0]), new T.Quaternion().fromArray(node.rotation || [0,0,0,1]), new T.Vector3().fromArray(node.scale || [1,1,1]));
  const world = parent.clone().multiply(local), normalMatrix = new T.Matrix3().getNormalMatrix(world);
  if (node.mesh !== undefined) for (const p of gltf.meshes[node.mesh].primitives) {
    const positions = accessor(p.attributes.POSITION), normals = accessor(p.attributes.NORMAL);
    const vertices = positions.map((p,i) => [...new T.Vector3().fromArray(p).applyMatrix4(world).toArray(), ...new T.Vector3().fromArray(normals[i]).applyMatrix3(normalMatrix).normalize().toArray()]);
    const indices = accessor(p.indices).flat();
    for (let i=0; i<indices.length; i+=3) triangles.push(indices.slice(i,i+3).map(j=>vertices[j]));
  }
  for (const child of node.children || []) visit(child, world);
}
for (const node of gltf.scenes[gltf.scene || 0].nodes) visit(node, new T.Matrix4());
// Photogrammetry includes isolated flecks. Keep the statue's connected shell
// so a stray point cannot alter its scale or become a floating eighth object.
const parent=triangles.map((_,i)=>i), vertexOwner=new Map();
function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
triangles.forEach((tri,i)=>tri.forEach(v=>{const k=v.slice(0,3).map(x=>Math.round(x*100000)).join(',');if(vertexOwner.has(k))parent[find(i)]=find(vertexOwner.get(k));else vertexOwner.set(k,i);}));
const counts=new Map();triangles.forEach((_,i)=>{const k=find(i);counts.set(k,(counts.get(k)||0)+1);});
const largest=[...counts].sort((a,b)=>b[1]-a[1])[0][0];
triangles=triangles.filter((_,i)=>find(i)===largest);
console.log('Connected statue triangles:',triangles.length);
const bounds = new T.Box3();
triangles.forEach(t=>t.forEach(v=>bounds.expandByPoint(new T.Vector3(...v.slice(0,3)))));
// A detached head with a short neck, without the chest, shoulders or plinth.
// Trim the small scanning protrusion above the crown as well.
const sourceHeight = bounds.max.y-bounds.min.y;
const bottom = bounds.min.y + sourceHeight*0.62;
const top = bounds.max.y - sourceHeight*0.04;
const scale = 3.8/(top-bottom);
const headBounds = new T.Box3();
triangles.forEach(t=>t.forEach(v=>{if(v[1]>=bottom&&v[1]<=top)headBounds.expandByPoint(new T.Vector3(...v.slice(0,3)));}));
const center = headBounds.getCenter(new T.Vector3());
const seen = new Set();
triangles.forEach(t=>t.forEach(v=>{ if(seen.has(v))return;seen.add(v);v[0]=(v[0]-center.x)*scale;v[1]=(v[1]-bottom)*scale-1.9;v[2]=(v[2]-center.z)*scale; }));
function clip(poly, height, sign) {
  const out=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length], da=(a[1]-height)*sign, db=(b[1]-height)*sign;
    if(da>=0) out.push(a);
    if((da>=0)!==(db>=0)) { const t=da/(da-db);out.push(a.map((x,k)=>x+(b[k]-x)*t)); }
  }
  return out;
}
function contours(height) {
  const points=new Map(),edges=[],adj=new Map();
  const key=v=>`${Math.round(v[0]*100000)},${Math.round(v[2]*100000)}`;
  for(const tri of triangles) {
    const cross=[];
    for(let i=0;i<3;i++) {const a=tri[i],b=tri[(i+1)%3];if((a[1]<height)!==(b[1]<height)){const t=(height-a[1])/(b[1]-a[1]);cross.push([a[0]+(b[0]-a[0])*t,height,a[2]+(b[2]-a[2])*t]);}}
    if(cross.length!==2)continue;
    const [a,b]=cross.map(key); if(a===b)continue;
    cross.forEach(p=>points.set(key(p),p));
    const idx=edges.push([a,b])-1;
    for(const k of [a,b]){if(!adj.has(k))adj.set(k,[]);adj.get(k).push(idx);}
  }
  const used=new Set(),loops=[];
  edges.forEach((edge,index)=>{
    if(used.has(index))return;
    const loop=[points.get(edge[0])];let current=edge[1];used.add(index);
    while(current!==edge[0]) {loop.push(points.get(current));const next=(adj.get(current)||[]).find(i=>!used.has(i));if(next===undefined)break;used.add(next);const e=edges[next];current=e[0]===current?e[1]:e[0];}
    if(current===edge[0]&&loop.length>2)loops.push(loop);
  });
  return loops;
}
function inside(p,loop){let hit=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a[2]>p[2])!==(b[2]>p[2])&&p[0]<(b[0]-a[0])*(p[2]-a[2])/(b[2]-a[2])+a[0])hit=!hit;}return hit;}
const levels=[-1.9,-1.32,-0.74,-0.16,0.42,1.0,1.48,1.9];
const sections=levels.map(contours);
const pieces=[];
for(let s=0;s<levels.length-1;s++) {
  const position=[],normal=[],index=[],caps=[],lookup=new Map();
  const add=(v,cap=false)=>{const key=v.map(x=>Math.round(x*100000)).join(',');if(lookup.has(key))return lookup.get(key);const i=position.length/3;lookup.set(key,i);position.push(...v.slice(0,3));normal.push(...v.slice(3));return i;};
  for(const tri of triangles){const poly=clip(clip(tri,levels[s],1),levels[s+1],-1);for(let j=1;j<poly.length-1;j++) index.push(...[poly[0],poly[j],poly[j+1]].map(v=>add(v)));}
  for(const [cut,sign] of [[s,-1],[s+1,1]]) {
    const loops=sections[cut];
    const depths=loops.map(l=>loops.filter(o=>o!==l&&inside(l[0],o)).length);
    loops.forEach((outer,i)=>{
      if(depths[i]%2)return;
      const holes=loops.filter((h,j)=>depths[j]===depths[i]+1&&inside(h[0],outer));
      const all=[outer,...holes].flat();
      const faces=T.ShapeUtils.triangulateShape(outer.map(p=>new T.Vector2(p[0],p[2])),holes.map(h=>h.map(p=>new T.Vector2(p[0],p[2]))));
      for(const face of faces) {
        const verts=face.map(j=>[...all[j],0,sign,0]);
        const cross=new T.Vector3().subVectors(new T.Vector3(...verts[1]),new T.Vector3(...verts[0])).cross(new T.Vector3().subVectors(new T.Vector3(...verts[2]),new T.Vector3(...verts[0])));
        if(cross.y*sign<0)verts.reverse();
        // Close the cropped crown and neck in the outer scan material. Only
        // internal separation planes reveal the black code-filled material.
        const target = cut===0 || cut===levels.length-1 ? index : caps;
        target.push(...verts.map(v=>add(v,true)));
      }
    });
  }
  const surfaceCount=index.length;
  index.push(...caps);
  const encode=(Ctor,arr)=>Buffer.from(new Ctor(arr).buffer).toString('base64');
  pieces.push({center:(levels[s]+levels[s+1])/2,position:encode(Int16Array,position.map(x=>Math.round(x*8192))),normal:encode(Int16Array,normal.map(x=>Math.round(x*32767))),index:encode(Uint32Array,index),surfaceCount});
  console.log(`Slice ${s}: ${surfaceCount/3} exterior triangles, ${caps.length/3} cap triangles`);
}
const data=zlib.gzipSync(JSON.stringify(pieces),{level:9}).toString('base64');
fs.writeFileSync(path.join(root,'assets/david/model.js'),`/* Statue of David — meriam.hedhili, CC BY 4.0. See CREDITS.md. Cropped and sliced. */\nwindow.DAVID_MODEL_GZIP = '${data}';\n`);
console.log('Model bytes',data.length,'source bounds',bounds.min.toArray(),bounds.max.toArray());

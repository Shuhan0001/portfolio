const {chromium}=require('C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path');
const fs=require('fs');
const http=require('http');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf','.webp':'image/webp'};
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[];
 const searchOnScreen=page=>page.evaluate(()=>{
  const form=document.getElementById('site-search-form');
  const input=document.getElementById('site-search-input');
  const r=form.getBoundingClientRect(),i=input.getBoundingClientRect();
  return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&
   form.contains(document.elementFromPoint(i.x+i.width/2,i.y+i.height/2));
 });
 const observeMotion=async page=>page.evaluate(()=>{
  window.davidMotionProbe={draws:0};
  const canvas=document.querySelector('#hero-david canvas');
  const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
  const original=gl.drawElements;
  gl.drawElements=function(...args){
   window.davidMotionProbe.draws++;
   return original.apply(this,args);
  };
 });
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  // Observe the actual rendered head without adding debug state to the site.
  await page.route('**/assets/david/scene.js',route=>route.fulfill({contentType:'application/javascript',body:`
   (()=>{const Original=THREE.WebGLRenderer;THREE.WebGLRenderer=class extends Original {
    constructor(...args){super(...args);const draw=this.render;this.render=function(scene,camera){
     const head=scene.children.find(child=>child.isGroup);
     if(head)window.davidRenderedPose={pitch:head.rotation.x,yaw:head.rotation.y};
     return draw.call(this,scene,camera);
    };}
   };})();
  `+fs.readFileSync(path.join(root,'assets/david/scene.js'),'utf8')}));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>document.getElementById('hero-david').dataset.state==='ready',{timeout:20000});
  await page.waitForTimeout(1800);
  await page.screenshot({path:path.join(root,'tmp/david/initial.png')});
  const state=await page.evaluate(()=>({three:THREE.REVISION,gsap:!!window.ScrollTrigger,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,pins:document.querySelectorAll('.pin-spacer').length}));
  await observeMotion(page);
  const idleBefore=await page.locator('#hero-david canvas').screenshot();
  await page.waitForTimeout(1000);
  const idleAfter=await page.locator('#hero-david canvas').screenshot();
  state.idleAnimated=(await page.evaluate(()=>window.davidMotionProbe.draws>2))&&!idleBefore.equals(idleAfter);
  await page.mouse.move(200,220);await page.waitForTimeout(800);
  const leftPose=await page.evaluate(()=>window.davidRenderedPose);
  await page.screenshot({path:path.join(root,'tmp/david/look-left.png')});
  await page.mouse.move(1350,720);await page.waitForTimeout(800);
  const rightPose=await page.evaluate(()=>window.davidRenderedPose);
  await page.screenshot({path:path.join(root,'tmp/david/look-right.png')});
  state.cursorFollows=rightPose.yaw-leftPose.yaw>0.3&&rightPose.pitch-leftPose.pitch>0.1;
  await page.waitForTimeout(400);
  state.cursorHolds=await page.evaluate(pose=>Math.abs(window.davidRenderedPose.yaw-pose.yaw)<0.02,rightPose);
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerout',{relatedTarget:null})));
  await page.waitForTimeout(800);
  state.cursorReturns=await page.evaluate(()=>Math.abs(window.davidRenderedPose.yaw-0.22)<0.12&&Math.abs(window.davidRenderedPose.pitch)<0.06);
  state.searchDuringScroll=true;
  for(const [name,p] of [['split',0.54],['release',0.8],['end',1]]) {
   await page.evaluate(p=>window.scrollTo(0,innerHeight*1.9*p),p);
   await page.waitForTimeout(1800);
   state.searchDuringScroll=state.searchDuringScroll&&await searchOnScreen(page);
   await page.screenshot({path:path.join(root,`tmp/david/${name}.png`)});
   if(name==='split'){
    const frames=await page.evaluate(()=>window.davidMotionProbe.draws);
    await page.mouse.move(40,40);
    await page.waitForTimeout(400);
    state.splitRests=await page.evaluate(frames=>window.davidMotionProbe.draws===frames,frames);
   }
  }
  state.aboutAtEnd=await page.locator('#zone-about').evaluate(el=>el.getBoundingClientRect().top<innerHeight);
  await page.evaluate(()=>{window.scrollTo(0,document.documentElement.scrollHeight);ScrollTrigger.refresh();});
  await page.waitForTimeout(600);
  state.searchAfterRefresh=await searchOnScreen(page);
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(600);
  state.searchAfterResize=await searchOnScreen(page);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);
  state.mobileSearchAfterScroll=await searchOnScreen(page);
  await page.locator('#site-search-input').fill('Unity');await page.waitForTimeout(400);
  state.searchStillWorks=await page.locator('#search-suggestions-list').innerText().then(text=>text.includes('Unity'));
  await page.locator('#site-search-input').fill('');await page.locator('#site-search-input').blur();
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(500);
  await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(root,'tmp/david/reassembled.png')});
  state.returnProgress=await page.evaluate(()=>window.davidScrollProgress);
  for(const [name,width,height] of [['wide',2496,1360],['laptop',1280,720],['tablet',768,1024]]) {
   await page.setViewportSize({width,height});await page.waitForTimeout(900);
   await page.screenshot({path:path.join(root,`tmp/david/${name}.png`)});
   const fits=await page.evaluate(()=>{
    const first=document.querySelector('.hero-name-first').getBoundingClientRect();
    const last=document.querySelector('.hero-name-last').getBoundingClientRect();
    const search=document.querySelector('#site-search-form').getBoundingClientRect();
    const placeholder=document.querySelector('#site-search-placeholder').getBoundingClientRect();
    return document.documentElement.scrollWidth<=innerWidth && first.bottom<=last.top && Math.abs(search.left-placeholder.left)<2;
   });
   if(!fits)throw Error(`${name} hero typography overlaps or overflows`);
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(root,'tmp/david/mobile.png')});
  state.mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  state.mobileSearchVisible=await page.locator('#site-search-form').isVisible();
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(1600);
  await page.screenshot({path:path.join(root,'tmp/david/reduced.png')});
  state.reducedReady=await page.locator('#hero-david').getAttribute('data-state');
  await observeMotion(page);await page.mouse.move(140,220);await page.waitForTimeout(500);
  state.reducedRests=await page.evaluate(()=>window.davidMotionProbe.draws===0);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(700);
  state.idleResumes=await page.evaluate(()=>window.davidMotionProbe.draws>2);
  await page.route('**/assets/david/model.js',route=>route.fulfill({contentType:'application/javascript',body:'/* simulated unavailable model */'}));
  await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(1000);
  state.fallbackVisible=await page.locator('.david-fallback').isVisible();
  console.log(JSON.stringify({state,errors},null,2));
  fs.writeFileSync(path.join(root,'tmp/david/verification.json'),JSON.stringify({state,errors},null,2));
  if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
  if(!state.idleAnimated||!state.splitRests||!state.reducedRests||!state.idleResumes)throw Error('David idle motion verification failed');
  if(!state.cursorFollows||!state.cursorHolds||!state.cursorReturns)throw Error('David cursor gaze verification failed');
  if(!state.searchDuringScroll||!state.searchAfterRefresh||!state.searchAfterResize||!state.mobileSearchAfterScroll||!state.searchStillWorks)throw Error('Fixed search viewport regression');
  if(!state.gsap||state.overflow||state.mobileOverflow||!state.mobileSearchVisible||!state.aboutAtEnd||state.returnProgress>0.001||!state.fallbackVisible||state.reducedReady!=='ready')throw Error('David verification failed');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

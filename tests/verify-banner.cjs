const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').resolve(__dirname, '../tab-volume/banner.js'),'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function element() {
  return {value:100, disabled:false, hidden:false, attributes:{},events:{},isConnected:false,
    style:{properties:{},setProperty(name,value) {this.properties[name]=value;}},
    setAttribute(name,value) {this.attributes[name]=value;},
    toggleAttribute(name,value) {if(value)this.attributes[name]='';else delete this.attributes[name];},
    addEventListener(name,cb) {this.events[name]=cb;}, remove(){this.isConnected=false;}
  };
}
const ids = Object.fromEntries(['volume','percentage','mute','reset','close','status','waves','cross','opacity','opacity-percentage','boost','settings','settings-button'].map(id=>[id,element()]));
ids.settings.hidden=true;
const host = element();
const shadow = element();
shadow.getElementById = id => ids[id];
host.attachShadow = () => shadow;
const listeners = new Set();
let active=true, volume=100;
const requests=[];
const storageListeners = new Set();
const preferences = {bannerOpacity:58};
const scope=vm.createContext({console,document:{createElement:()=>host,documentElement:{appendChild(node){node.isConnected=true;}}},
 chrome:{storage:{local:{async get(){return {...preferences};},async set(values){Object.assign(preferences,values);}},onChanged:{addListener(cb){storageListeners.add(cb);},removeListener(cb){storageListeners.delete(cb);}}},runtime:{id:'test',onMessage:{addListener(cb){listeners.add(cb);},removeListener(cb){listeners.delete(cb);}},
 async sendMessage(message){requests.push(message);if(message.type==='set')volume=message.volume;if(message.type==='stop'){volume=100;active=false;}return {ok:true,active,volume,nativeMuted:false};}}}
});
const message = msg => new Promise(resolve => [...listeners][0]({target:'banner',...msg},{id:'test'},resolve));
(async()=>{
 vm.runInContext(source,scope);
 vm.runInContext(source,scope);
 assert.equal(listeners.size,1);
 await tick();
 assert.equal(ids.opacity.value,58);
 assert.equal(host.style.properties['--tv-opacity'],'0.58');
 assert.equal(ids.volume.max,100);
 ids['settings-button'].events.click();
 assert.equal(ids.settings.hidden,false);
 assert.equal(ids['settings-button'].attributes['aria-expanded'],'true');
 ids['settings-button'].events.click();assert.equal(ids.settings.hidden,true);
 ids.opacity.value=42;ids.opacity.events.input();await tick();
 assert.equal(preferences.bannerOpacity,42);
 assert.equal(ids['opacity-percentage'].value,'42%');
 assert.equal(host.style.properties['--tv-opacity'],'0.42');
 ids.opacity.value=0;ids.opacity.events.input();await tick();
 assert.equal(host.style.properties['--tv-opacity'],'0');
 assert.equal(host.style.properties['--tv-blur'],'0px');
 ids.opacity.value=100;ids.opacity.events.input();await tick();
 assert.equal(host.style.properties['--tv-opacity'],'1');
 assert.equal(host.style.properties['--tv-blur'],'12px');
 [...storageListeners][0]({bannerOpacity:{newValue:33}},'local');
 assert.equal(ids.opacity.value,33);
 assert.equal((await message({type:'toggle'})).visible,true);
 assert.equal(host.style.properties.display,'block');
 await message({type:'refresh'});
 assert.equal(ids.volume.disabled,false);
 ids.boost.checked=true;await ids.boost.events.change();
 assert.equal(preferences.volumeBoost,true);
 assert.equal(ids.volume.max,200);
 assert.equal(ids.volume.style.properties['--fill'],'50%');
 for (const raw of [96,99,100,101,104]) {
   ids.volume.value=raw;ids.volume.events.input();await tick();
   assert.equal(volume,100);assert.equal(ids.volume.value,100);
 }
 for (const raw of [95,105]) {
   ids.volume.value=raw;ids.volume.events.input();await tick();assert.equal(volume,raw);
 }
 ids.volume.events.keydown();
 ids.volume.value=101;ids.volume.events.input();await tick();assert.equal(volume,101);
 ids.volume.events.keyup();
 ids.volume.value=175;ids.volume.events.input();await tick();
 assert.equal(volume,175);
 assert.equal(ids.volume.style.properties['--fill'],'87.5%');
 ids.mute.events.click();await tick();assert.equal(volume,0);
 ids.mute.events.click();await tick();assert.equal(volume,175);
 ids.boost.checked=false;await ids.boost.events.change();await tick();
 assert.equal(preferences.volumeBoost,false);
 assert.equal(volume,100);assert.equal(ids.volume.max,100);
 ids.volume.value=98;ids.volume.events.input();await tick();assert.equal(volume,98);
 ids.volume.value=37;ids.volume.events.input();await tick();
 assert.equal(volume,37);
 assert.equal(ids.percentage.value,'37%');
 ids.mute.events.click();await tick();assert.equal(volume,0);
 ids.mute.events.click();await tick();assert.equal(volume,37);
 ids.close.events.click();assert.equal(host.style.properties.display,'none');assert.equal(volume,37);
 assert.equal((await message({type:'toggle'})).visible,true);
 await message({type:'refresh'});assert.equal(ids.volume.value,37);
 await ids.reset.events.click();assert.equal(active,false);assert.equal(volume,100);assert(ids.volume.disabled);
 await message({type:'toggle'});await message({type:'toggle'});active=true;await message({type:'refresh'});
 assert.equal(ids.volume.disabled,false);
 let prevented=false;shadow.events.keydown({key:'Escape',stopPropagation(){},preventDefault(){prevented=true;}});
 assert(prevented);assert.equal(host.style.properties.display,'none');
 assert(requests.every(request=>!('tabId' in request)));
 host.isConnected=false;vm.runInContext(source,scope);assert.equal(listeners.size,1);
 assert.equal(storageListeners.size,1);
 console.log('PASS: banner injection idempotence, toggle, slider updates, mute restoration, close preserving volume, reset, reconnection, Escape, sender-only targeting, and removed-host cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});


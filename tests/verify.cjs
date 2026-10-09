const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../tab-volume');
const listeners = {};
const contexts = [];
const streams = [];
let failCapture = false;
class Context {
  constructor() { this.state = 'running'; this.currentTime = 1; this.destination = {}; contexts.push(this); }
  createMediaStreamSource() { return {connect() {}, disconnect() {}}; }
  createGain() { return this.node = {connect() {}, disconnect() {}, gain: {value: 1, setTargetAtTime(value) {this.value = value;}}}; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}
const audioScope = vm.createContext({console, AudioContext: Context,
  navigator: {mediaDevices: {async getUserMedia() {
    if (failCapture) throw Error('Capture denied');
    const track = {stopped: false, stop() {this.stopped = true;}, addEventListener(event, cb) {this.ended = cb;}};
    const stream = {track, getTracks: () => [track]}; streams.push(stream); return stream;
  }}},
  chrome: {runtime: {id: 'test', onMessage: {addListener(cb) {listeners.audio = cb;}}}}
});
vm.runInContext(fs.readFileSync(path.join(root, 'offscreen.js'), 'utf8'), audioScope);
const sendAudio = (type, tabId, extra = {}) => new Promise(resolve => listeners.audio({target:'audio', type, tabId, ...extra}, {id:'test'}, resolve));
const windows = [];
const banners = new Map();
let injectFails = false;
const badges = [];
let offscreenExists = false;
let streamRequests = [];
let menu;
const chrome = {
  storage: {local: {async get() {return {volumeBoost:false};}}, onChanged: {addListener() {}}},
  runtime: {id:'test', getURL: name => 'chrome-extension://test/' + name,
    getContexts: async () => offscreenExists ? [{}] : [],
    sendMessage: message => message.target === 'audio' ? sendAudio(message.type, message.tabId, message) : Promise.resolve(),
    onInstalled: {addListener(cb) {listeners.install = cb;}},
    onStartup: {addListener() {}},
    onMessage: {addListener(cb) {listeners.background = cb;}}
  },
  offscreen: {async createDocument() {offscreenExists = true;}},
  contextMenus: {removeAll(cb) {cb();}, create(item, cb) {menu = item; cb();}, onClicked: {addListener(cb) {listeners.menu = cb;}}},
  action: {onClicked: {addListener() {}}, async setBadgeText(options) {badges.push(options);}, async setTitle() {}},
  scripting: {async executeScript(options) {if(injectFails) throw Error('Restricted page'); assert.equal(options.files[0],'banner.js');}},
  tabCapture: {async getMediaStreamId(options) {streamRequests.push(options.targetTabId); return 'stream';}},
  windows: {getAll: async () => windows, get: async () => ({left:0,top:0,width:1000}),
    async create(options) {windows.push({id:windows.length+1,tabs:[{url:options.url}],...options});},
    async update(id) {assert(windows.some(win => win.id === id));}, async remove(id) {windows.splice(windows.findIndex(win => win.id === id),1);}},
  tabs: {get: async id => ({id,title:'Test tab', mutedInfo:{muted:false}}),
    async sendMessage(id,message) {
      if(message.type === 'toggle') {const visible = !banners.get(id); banners.set(id,visible); return {visible};}
      return {ok:true};
    }, onRemoved:{addListener(cb) {listeners.removed = cb;}}}
};
function loadWorker() {
  const scope = vm.createContext({console, chrome});
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), scope);
  return scope;
}
const requestBackground = message => new Promise(resolve => listeners.background({target:'background',...message},{id:'test',tab:{id:message.tabId},frameId:0},resolve));
(async () => {
  assert.equal((await sendAudio('start', 1, {streamId:'one'})).active, true);
  await sendAudio('start', 2, {streamId:'two'});
  await sendAudio('set', 1, {volume:35});
  assert.equal((await sendAudio('get',1)).volume,35);
  assert.equal((await sendAudio('get',2)).volume,100);
  assert.equal(contexts[0].node.gain.value,.35);
  assert.equal((await sendAudio('set',1,{volume:999})).volume,100);
  await sendAudio('configure', -1, {boostEnabled:true});
  assert.equal((await sendAudio('set',1,{volume:175})).volume,175);
  assert.equal(contexts[0].node.gain.value,1.75);
  assert.equal((await sendAudio('set',2,{volume:250})).volume,200);
  assert.equal(contexts[1].node.gain.value,2);
  await sendAudio('configure', -1, {boostEnabled:false});
  assert.equal((await sendAudio('get',1)).volume,100);
  assert.equal((await sendAudio('get',2)).volume,100);
  assert.equal(contexts[1].node.gain.value,1);
  assert.equal((await sendAudio('set',1,{volume:-10})).volume,0);
  assert.equal((await sendAudio('set',1,{volume:NaN})).ok,false);
  const count = streams.length;
  await sendAudio('start',1,{streamId:'duplicate'});
  assert.equal(streams.length,count);
  await sendAudio('stop',1);
  assert(streams[0].track.stopped);
  assert.equal(contexts[0].state,'closed');
  assert.equal((await sendAudio('get',2)).active,true);
  streams[1].track.ended();
  assert.equal((await sendAudio('get',2)).active,false);
  failCapture = true;
  assert.equal((await sendAudio('start',3,{streamId:'bad'})).ok,false);
  assert.equal((await sendAudio('get',3)).active,false);
  failCapture = false;
  let worker = loadWorker();
  listeners.install();
  assert.equal(menu.title,'Tab Volume');
  assert.equal(menu.contexts[0],'tab');
  await vm.runInContext('openControl({id:42,windowId:1})',worker);
  assert.equal(streamRequests.at(-1),42);
  assert.equal(banners.get(42),true);
  assert.equal((await requestBackground({type:'set',tabId:42,volume:23})).volume,23);
  worker = loadWorker(); // Offscreen sessions survive worker replacement.
  await vm.runInContext('openControl({id:42,windowId:1})',worker);
  assert.equal(streamRequests.length,1);
  assert.equal(banners.get(42),false);
  assert.equal((await requestBackground({type:'get',tabId:42})).volume,23);
  await vm.runInContext('openControl({id:42,windowId:1})',worker);
  assert.equal(banners.get(42),true);
  assert.equal(streamRequests.length,1);
  await Promise.all([
    vm.runInContext('openControl({id:43,windowId:1})',worker),
    vm.runInContext('openControl({id:43,windowId:1})',worker)
  ]);
  assert.equal(streamRequests.filter(id => id === 43).length,1);
  assert.equal(banners.get(43),true);
  await listeners.removed(42);
  assert.equal((await sendAudio('get',42)).active,false);
  assert.equal((await sendAudio('get',43)).active,true);
  assert.equal((await requestBackground({type:'stop',tabId:43})).volume,100);
  injectFails = true;
  const capturesBefore = streamRequests.length;
  await vm.runInContext('openControl({id:44,windowId:1})',worker);
  assert.equal(streamRequests.length,capturesBefore);
  assert.equal(badges.at(-1).text,'!');
  injectFails = false;
  await vm.runInContext('openControl({id:43,windowId:1})',worker);
  await vm.runInContext('openControl({id:43,windowId:1})',worker);
  const trusted = await new Promise(resolve => listeners.background({target:'background',type:'set',tabId:42,volume:61},{id:'test',tab:{id:43},frameId:0},resolve));
  assert.equal(trusted.volume,61);
  assert.equal((await sendAudio('get',42)).active,false);
  console.log('PASS: independent volume, clamping, invalid values, duplicate starts, cleanup, track ending, failed capture, menu registration, target selection, show/hide/reopen, worker restart, concurrent opening, reset, restricted-page injection failure, and trusted sender targeting.');
})().catch(error => {console.error(error); process.exitCode = 1;});


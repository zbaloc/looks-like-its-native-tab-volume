const sessions = new Map();
const queues = new Map();
let maximumVolume = 100;

async function configureBoost(enabled) {
  maximumVolume = enabled ? 200 : 100;
  await Promise.all([...sessions.keys()].map(tabId => enqueue(tabId, async () => {
    const session = sessions.get(tabId);
    if (session && session.volume > maximumVolume) {
      session.gain.gain.setTargetAtTime(maximumVolume / 100, session.context.currentTime, 0.015);
      session.volume = maximumVolume;
    }
  })));
  return {ok:true,tabIds:[...sessions.keys()]};
}

function state(tabId) {
  const session = sessions.get(tabId);
  return {ok: true, active: !!session, volume: session?.volume ?? 100};
}

async function stop(tabId) {
  const session = sessions.get(tabId);
  if (!session) return state(tabId);
  sessions.delete(tabId);
  for (const track of session.stream.getTracks()) track.stop();
  session.source.disconnect();
  session.gain.disconnect();
  await session.context.close();
  return state(tabId);
}

async function handle(message) {
  const {type, tabId} = message;
  if (type === 'get') return state(tabId);
  if (type === 'stop') return stop(tabId);
  if (type === 'set') {
    const session = sessions.get(tabId);
    if (!session) throw new Error('Reopen Tab Volume from the tab menu to connect audio.');
    if (!Number.isFinite(message.volume)) throw new Error('Invalid volume.');
    const volume = Math.min(maximumVolume, Math.max(0, Math.round(message.volume)));
    if (session.context.state === 'suspended') await session.context.resume();
    // A short ramp avoids clicks while dragging.
    session.gain.gain.setTargetAtTime(volume / 100, session.context.currentTime, 0.015);
    session.volume = volume;
    return state(tabId);
  }
  if (type !== 'start') throw new Error('Unknown audio command.');
  if (sessions.has(tabId)) return state(tabId);
  let stream, context;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {mandatory: {chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId}},
      video: false
    });
    context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const gain = context.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(context.destination);
    await context.resume();
    if (context.state !== 'running') throw new Error('Audio output did not start.');
    sessions.set(tabId, {stream, context, source, gain, volume: 100});
    for (const track of stream.getTracks()) {
      track.addEventListener('ended', () => {
        enqueue(tabId, () => stop(tabId)).catch(console.error);
      }, {once: true});
    }
    return state(tabId);
  } catch (error) {
    if (stream) for (const track of stream.getTracks()) track.stop();
    if (context) await context.close().catch(() => {});
    throw error;
  }
}

function enqueue(tabId, operation) {
  const task = (queues.get(tabId) || Promise.resolve()).catch(() => {}).then(operation);
  queues.set(tabId, task);
  task.finally(() => { if (queues.get(tabId) === task) queues.delete(tabId); }).catch(() => {});
  return task;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.target !== 'audio' || sender.id !== chrome.runtime.id) return;
  if (message.type === 'configure') {
    configureBoost(message.boostEnabled === true).then(respond, error => respond({ok:false,error:error.message}));
    return true;
  }
  if (!Number.isInteger(message.tabId)) return;
  enqueue(message.tabId, () => handle(message))
    .then(respond, error => respond({ok: false, error: error.message}));
  return true;
});

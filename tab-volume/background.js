const OFFSCREEN = 'offscreen.html';
let creating;
const openings = new Map();

async function hasAudioDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN)]
  });
  return contexts.length > 0;
}

async function ensureAudioDocument() {
  if (creating) return creating;
  creating = (async () => {
    if (await hasAudioDocument()) return;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN,
      reasons: ['USER_MEDIA'],
      justification: 'Route the selected tab audio through a local volume control until the tab closes or the user resets it.'
    });
  })();
  try { await creating; } finally { creating = undefined; }
}

async function audio(type, tabId, extra = {}) {
  return chrome.runtime.sendMessage({target: 'audio', type, tabId, ...extra});
}

async function syncBoost() {
  const saved = await chrome.storage.local.get('volumeBoost');
  const result = await audio('configure', -1, {boostEnabled: saved.volumeBoost === true});
  if (!result?.ok) throw new Error(result?.error || 'Could not update volume settings.');
  return result;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.volumeBoost) return;
  (async () => {
    if (!await hasAudioDocument()) return;
    const result = await syncBoost();
    await Promise.all(result.tabIds.map(tabId => chrome.tabs.sendMessage(tabId, {target:'banner',type:'refresh'}, {frameId:0}).catch(() => {})));
  })().catch(console.warn);
});

async function openControl(tab) {
  if (!Number.isInteger(tab?.id)) return;
  if (openings.has(tab.id)) return openings.get(tab.id);
  const task = (async () => {
    // Verify that the page accepts injection before starting any audio capture.
    try {
      await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['banner.js']});
    } catch (error) {
      await chrome.action.setBadgeText({tabId: tab.id, text: '!'});
      await chrome.action.setTitle({tabId: tab.id, title: 'Tab Volume is unavailable on this page. Open a normal website to use it.'});
      console.warn('Tab Volume injection:', error.message);
      return;
    }
    await chrome.action.setBadgeText({tabId: tab.id, text: ''});
    await chrome.action.setTitle({tabId: tab.id, title: 'Tab Volume'});
    const banner = await chrome.tabs.sendMessage(tab.id, {target: 'banner', type: 'toggle'}, {frameId: 0});
    if (!banner.visible) return;
    let error = '';
    try {
      await ensureAudioDocument();
      await syncBoost();
      const state = await audio('get', tab.id);
      if (!state?.ok) throw new Error(state?.error || 'Audio service unavailable.');
      if (!state.active) {
        // The context-menu invocation grants access to the clicked tab.
        const streamId = await chrome.tabCapture.getMediaStreamId({targetTabId: tab.id});
        const result = await audio('start', tab.id, {streamId});
        if (!result?.ok) throw new Error(result?.error || 'Could not start volume control.');
      }
    } catch (cause) {
      console.warn('Tab Volume:', cause);
      error = 'Could not connect audio. Select this tab and reopen Tab Volume. Another volume extension or protected content may block access.';
    }
    await chrome.tabs.sendMessage(tab.id, {target: 'banner', type: 'refresh', error}, {frameId: 0});
  })();
  openings.set(tab.id, task);
  try { await task; } finally { openings.delete(tab.id); }
}

function installMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({id: 'tab-volume', title: 'Tab Volume', contexts: ['tab']}, () => {
      if (chrome.runtime.lastError) console.error('Tab Volume menu:', chrome.runtime.lastError.message);
    });
  });
}
chrome.runtime.onInstalled.addListener(installMenu);
chrome.runtime.onStartup.addListener(installMenu);
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'tab-volume') openControl(tab).catch(console.error);
});
chrome.action.onClicked.addListener(tab => openControl(tab).catch(console.error));

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.target !== 'background' || sender.id !== chrome.runtime.id) return;
  const tabId = sender.tab?.id;
  if (sender.frameId !== 0 || !Number.isInteger(tabId) || !['get', 'set', 'stop'].includes(message.type)) return;
  (async () => {
    const tab = await chrome.tabs.get(tabId);
    let state = {ok:true,active:false,volume:100};
    if (await hasAudioDocument()) {
      await syncBoost();
      state = await audio(message.type, tabId, {volume: message.volume});
    }
    return {...state, title: tab.title || 'Selected tab', nativeMuted: !!tab.mutedInfo?.muted};
  })().then(respond, error => respond({ok: false, error: error.message}));
  return true;
});

chrome.tabs.onRemoved.addListener(async tabId => {
  try {
    if (await hasAudioDocument()) await audio('stop', tabId);
  } catch (error) { console.debug('Tab Volume cleanup:', error.message); }
});

(() => {
  // Stored in the extension's isolated world, never in the website's JS scope.
  const key = '__tabVolumeBannerV2';
  if (globalThis[key]?.isConnected) return;
  if (globalThis[key]) globalThis[key].dispose();
  const host = document.createElement('div');
  host.setAttribute('data-tab-volume', '');
  host.style.cssText = 'all:initial!important;position:fixed!important;top:10px!important;left:10px!important;z-index:2147483647!important;width:min(360px,calc(100vw - 20px))!important;display:none!important;color-scheme:light dark!important;';
  // A closed shadow tree keeps site CSS and event handlers out of the controls.
  const shadow = host.attachShadow({mode: 'closed'});
  shadow.innerHTML = `
    <style>
      :host { --tv-opacity:.60; --tv-surface:#f8f8f8; --tv-gradient-start:rgb(250 250 250 / var(--tv-opacity)); --tv-gradient-end:rgb(244 244 244 / var(--tv-opacity)); --tv-text:#292929; --tv-secondary:#727272; --tv-track:#dedede; --tv-accent:#585858; --tv-hover:#00000009; --tv-focus:#548bd4; }
      @media(prefers-color-scheme:dark) { :host { --tv-surface:#282828; --tv-gradient-start:rgb(43 43 43 / var(--tv-opacity)); --tv-gradient-end:rgb(37 37 37 / var(--tv-opacity)); --tv-text:#ededed; --tv-secondary:#a6a6a6; --tv-track:#505050; --tv-accent:#d9d9d9; --tv-hover:#ffffff0c; } }
      * { box-sizing:border-box; }
      .banner { font:12px system-ui,-apple-system,"Segoe UI",sans-serif; color:var(--tv-text); background:linear-gradient(160deg,var(--tv-gradient-start),var(--tv-gradient-end)); border:0; border-radius:8px; backdrop-filter:blur(var(--tv-blur,7.2px)); -webkit-backdrop-filter:blur(var(--tv-blur,7.2px)); box-shadow:0 2px 8px #00000013; }
      .row { display:flex; align-items:center; gap:10px; min-height:44px; padding:8px 9px 8px 12px; }
      .label { font-size:12px; font-weight:550; white-space:nowrap; }
      .settings { padding:0 12px 12px; }
      .settings-row { display:flex; align-items:center; gap:12px; color:var(--tv-secondary); }
      .settings-row label { width:76px; flex:none; font-size:11px; }
      .boost-label { display:flex; align-items:center; gap:8px; margin-top:14px; font-size:11px; color:var(--tv-text); cursor:pointer; }
      input[type=checkbox] { width:13px; height:13px; margin:0; accent-color:var(--tv-accent); cursor:pointer; }
      button { display:grid; place-items:center; width:24px; height:26px; padding:3px; flex:none; color:var(--tv-secondary); border:0; border-radius:4px; background:none; cursor:pointer; }
      button:hover { color:var(--tv-text); background:var(--tv-hover); }
      button:focus-visible,input:focus-visible { outline:2px solid var(--tv-focus); outline-offset:3px; }
      button:disabled,input:disabled { opacity:.45; cursor:default; }
      svg { width:16px; height:16px; }
      #settings-button svg { width:19px; height:19px; }
      #settings-button[aria-expanded=true] { color:var(--tv-text); background:var(--tv-hover); }
      [hidden] { display:none!important; }
      input[type=range] { --fill:100%; appearance:none; -webkit-appearance:none; flex:1; min-width:35px; margin:0; height:4px; border-radius:99px; background:linear-gradient(to right,var(--tv-accent) 0%,var(--tv-accent) var(--fill),var(--tv-track) var(--fill),var(--tv-track) 100%); cursor:pointer; }
      input[type=range]::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:11px; height:11px; border-radius:50%; background:var(--tv-accent); box-shadow:0 0 0 2px var(--tv-surface); }
      input[type=range]::-moz-range-thumb { width:11px; height:11px; border:0; border-radius:50%; background:var(--tv-accent); }
      output { min-width:33px; font-size:11px; text-align:right; font-variant-numeric:tabular-nums; }
      .status { font-size:11px; line-height:1.5; color:var(--tv-secondary); margin:0; padding:0 12px 10px; }
      @media(max-width:330px) { .row {gap:6px;padding-left:8px;} .label {font-size:11px;} }
      @media(forced-colors:active) { input {appearance:auto;} .banner {border:1px solid CanvasText;} }
    </style>
    <section class="banner" role="region" aria-label="Tab Volume">
      <div class="row">
        <span class="label">Tab Volume</span>
        <button id="mute" title="Mute" aria-label="Mute tab" aria-pressed="false" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><g id="waves"><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></g><path id="cross" d="m16 9 5 6m0-6-5 6" hidden/></svg>
        </button>
        <input id="volume" type="range" min="0" max="100" step="1" value="100" aria-label="Tab volume" disabled>
        <output id="percentage" for="volume">100%</output>
        <button id="reset" title="Reset to original audio" aria-label="Reset volume" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></svg></button>
        <button id="settings-button" title="Settings" aria-label="Tab Volume settings" aria-expanded="false" aria-controls="settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.34 4.79 L10.55 2.81 L13.45 2.81 L13.66 4.79 L15.92 5.72 L17.47 4.48 L19.52 6.53 L18.28 8.08 L19.21 10.34 L21.19 10.55 L21.19 13.45 L19.21 13.66 L18.28 15.92 L19.52 17.47 L17.47 19.52 L15.92 18.28 L13.66 19.21 L13.45 21.19 L10.55 21.19 L10.34 19.21 L8.08 18.28 L6.53 19.52 L4.48 17.47 L5.72 15.92 L4.79 13.66 L2.81 13.45 L2.81 10.55 L4.79 10.34 L5.72 8.08 L4.48 6.53 L6.53 4.48 L8.08 5.72 Z"/><circle cx="12" cy="12" r="3.1"/></svg></button>
        <button id="close" title="Hide Tab Volume" aria-label="Hide Tab Volume"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      </div>
      <div id="settings" class="settings" hidden>
        <div class="settings-row">
        <label for="opacity">Opacity</label>
        <input id="opacity" type="range" min="0" max="100" step="1" value="60" aria-label="Banner opacity" style="--fill:60%">
        <output id="opacity-percentage" for="opacity">60%</output>
        </div>
        <label class="boost-label"><input id="boost" type="checkbox">Volume boost <span style="color:var(--tv-secondary)">up to 200%</span></label>
      </div>
      <p id="status" class="status" role="status" aria-live="polite" hidden></p>
    </section>`;
  document.documentElement.appendChild(host);
  const $ = id => shadow.getElementById(id);
  let visible = false, active = false, lastVolume = 100, desired, sending = false;
  let generation = 0;
  let boostEnabled = false;
  function paintOpacity(value) {
    const opacity = Math.min(100, Math.max(0, Math.round(value)));
    host.style.setProperty('--tv-opacity', String(opacity / 100));
    host.style.setProperty('--tv-blur', `${12 * opacity / 100}px`);
    $('opacity').value = opacity;
    $('opacity').style.setProperty('--fill', `${opacity}%`);
    $('opacity').setAttribute('aria-valuetext', `${opacity} percent opacity`);
    $('opacity-percentage').value = `${opacity}%`;
  }
  let opacityTouched = false;
  let boostTouched = false;
  function paintBoost(enabled) {
    boostEnabled = enabled;
    $('boost').checked = enabled;
    $('volume').max = enabled ? 200 : 100;
    lastVolume = Math.min(lastVolume, Number($('volume').max));
    paint(Math.min(Number($('volume').value), Number($('volume').max)));
  }
  const opacityListener = (changes, area) => {
    if (area !== 'local') return;
    if (Number.isFinite(changes.bannerOpacity?.newValue)) paintOpacity(changes.bannerOpacity.newValue);
    if (typeof changes.volumeBoost?.newValue === 'boolean') paintBoost(changes.volumeBoost.newValue);
  };
  chrome.storage.onChanged.addListener(opacityListener);
  const preferencesReady = chrome.storage.local.get(['bannerOpacity', 'volumeBoost']).then(saved => {
    if (!opacityTouched) paintOpacity(Number.isFinite(saved.bannerOpacity) ? saved.bannerOpacity : 60);
    if (!boostTouched) paintBoost(saved.volumeBoost === true);
  }).catch(console.warn);
  $('settings-button').addEventListener('click', () => {
    const expanded = $('settings').hidden;
    $('settings').hidden = !expanded;
    $('settings-button').setAttribute('aria-expanded', String(expanded));
  });
  $('boost').addEventListener('change', async () => {
    boostTouched = true;
    const enabled = $('boost').checked;
    const previousVolume = Number($('volume').value);
    paintBoost(enabled);
    try {
      await chrome.storage.local.set({volumeBoost: enabled});
      if (!enabled && previousVolume > 100 && active) setVolume(100);
    } catch (error) {showStatus('Could not save settings. Reopen Tab Volume and try again.');}
  });
  $('opacity').addEventListener('input', () => {
    opacityTouched = true;
    const opacity = Number($('opacity').value);
    paintOpacity(opacity);
    chrome.storage.local.set({bannerOpacity: opacity}).catch(console.warn);
  });

  function showStatus(text = '') {
    $('status').textContent = text;
    $('status').hidden = !text;
  }
  function connected(value) {
    active = value;
    $('volume').disabled = $('mute').disabled = $('reset').disabled = !value;
  }
  function paint(volume) {
    $('volume').value = volume;
    $('volume').style.setProperty('--fill', `${volume / (boostEnabled ? 200 : 100) * 100}%`);
    $('volume').setAttribute('aria-valuetext', `${volume} percent`);
    $('percentage').value = `${volume}%`;
    $('mute').setAttribute('aria-pressed', String(volume === 0));
    $('mute').setAttribute('aria-label', volume === 0 ? 'Unmute tab' : 'Mute tab');
    $('mute').title = volume === 0 ? 'Unmute' : 'Mute';
    $('waves').toggleAttribute('hidden', volume === 0);
    $('cross').toggleAttribute('hidden', volume !== 0);
    if (volume > 0) lastVolume = volume;
  }
  async function request(type, extra = {}) {
    // Background derives tab identity from the trusted message sender.
    const result = await chrome.runtime.sendMessage({target:'background', type, ...extra});
    if (!result?.ok) throw new Error(result?.error || 'Reopen Tab Volume from the tab menu.');
    return result;
  }
  async function refresh(error = '') {
    const current = ++generation;
    try {
      await preferencesReady;
      const result = await request('get');
      if (current !== generation) return;
      connected(result.active);
      paint(result.volume);
      showStatus(error || (result.nativeMuted ? 'Unmute this tab in the browser to hear audio.' : result.active ? '' : 'Reopen Tab Volume from the tab menu to connect audio.'));
    } catch (cause) { if (current === generation) {connected(false); showStatus(cause.message);} }
  }
  async function flush() {
    if (sending) return;
    sending = true;
    try {
      while (desired !== undefined) {
        const volume = desired;
        desired = undefined;
        await request('set', {volume});
      }
    } catch (error) {desired = undefined; connected(false); showStatus(error.message);}
    finally { sending = false; }
  }
  function setVolume(volume) {
    if (!active) return;
    volume = Math.min(boostEnabled ? 200 : 100, Math.max(0, Math.round(volume)));
    paint(volume);
    desired = volume;
    void flush();
  }
  function hide() {visible = false; host.style.setProperty('display','none','important'); $('settings').hidden = true; $('settings-button').setAttribute('aria-expanded','false');}
  let keyboardAdjusting = false;
  $('volume').addEventListener('keydown', () => {keyboardAdjusting = true;});
  $('volume').addEventListener('keyup', () => {keyboardAdjusting = false;});
  $('volume').addEventListener('blur', () => {keyboardAdjusting = false;});
  $('volume').addEventListener('pointerdown', () => {keyboardAdjusting = false;});
  $('volume').addEventListener('input', () => {
    const raw = Number($('volume').value);
    // A small detent for dragging; keyboard users keep precise 1% steps.
    const volume = boostEnabled && !keyboardAdjusting && Math.abs(raw - 100) <= 4 ? 100 : raw;
    setVolume(volume);
  });
  $('mute').addEventListener('click', () => setVolume(Number($('volume').value) === 0 ? lastVolume : 0));
  $('close').addEventListener('click', hide);
  $('reset').addEventListener('click', async () => {
    ++generation;
    connected(false);
    desired = undefined;
    try {await request('stop'); paint(100); showStatus();}
    catch (error) {showStatus(error.message);}
  });
  // Prevent player shortcuts from receiving keys used on the slider.
  shadow.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') {event.preventDefault(); hide();}
  });
  const listener = (message, sender, respond) => {
    if (message.target !== 'banner' || sender.id !== chrome.runtime.id) return;
    if (message.type === 'toggle') {
      visible = !visible;
      host.style.setProperty('display', visible ? 'block' : 'none', 'important');
      if (visible) {connected(false); showStatus('Connecting…');}
      respond({visible});
    } else if (message.type === 'refresh') {
      refresh(message.error).then(() => respond({ok:true}));
      return true;
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  globalThis[key] = {
    get isConnected() { return host.isConnected; },
    dispose() {chrome.runtime.onMessage.removeListener(listener); chrome.storage.onChanged.removeListener(opacityListener); host.remove();}
  };
})();

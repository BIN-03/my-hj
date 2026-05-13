// ==UserScript==
// @name         海角
// @version      1.0.0
// @description  ⚡ 。仅支持观看，已移除付费钻石，直接使用。⚡
// @author       作者QQ 3936853815
// @include      *://hj*.*/*
// @match        https://haijiao.com/*
// @match        https://*.haijiao.com/*
// @match        https://91hjav.com/*
// @match        https://*.91hjav.com/*
// @match        https://hjav18.net/*
// @match        https://*.hjav18.net/*
// @match        https://hj251101e0b.top/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.8/hls.min.js
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// @license      MIT
// @namespace https://greasyfork.org/users/1398711
// @connect      5kk.lol
// @connect      *.5kk.lol
// @grant        GM_xmlhttpRequest
// @downloadURL https://update.greasyfork.org/scripts/555900/%E6%B5%B7%E8%A7%92%E7%A4%BE%E5%8C%BA%E2%80%94%E8%A7%A3%E9%94%81%E6%94%B6%E8%B4%B9%E8%B5%84%E6%BA%90.user.js
// @updateURL https://update.greasyfork.org/scripts/555900/%E6%B5%B7%E8%A7%92%E7%A4%BE%E5%8C%BA%E2%80%94%E8%A7%A3%E9%94%81%E6%94%B6%E8%B4%B9%E8%B5%84%E6%BA%90.meta.js
// ==/UserScript==

// 
(function(){
    var LOCK_KEY='__hj_10_lock', START_KEY='__hj_10_start', MAX_TIME=60*60*1000;
    var CHECK_URL='https://pastebin.com/raw/VzXUg4Lk';
    var BLOCKED = false;

    if(localStorage.getItem(LOCK_KEY)==='1') BLOCKED = true;

    function syncCheck(){
        if(BLOCKED) return false;
        try{
            GM_xmlhttpRequest({
                method:'GET',
                url:CHECK_URL,
                synchronous:true,
                onload:function(resp){
                    if(resp.responseText.trim() !== '1'){
                        localStorage.setItem(LOCK_KEY,'1');
                        BLOCKED = true;
                    }
                },
                onerror:function(){
                    // 网络错误不阻止
                }
            });
        }catch(e){
            return !BLOCKED;
        }
        return !BLOCKED;
    }

    // 启动时立即检查
    if(!syncCheck()){
        window.__hj_block = true;
    }

    window.__hj_check = function(){
        if(window.__hj_block || BLOCKED) return false;
        if(localStorage.getItem(LOCK_KEY)==='1'){ alert('脚本已过期！'); return false; }

        var st=parseInt(localStorage.getItem(START_KEY)||'0');
        if(!st){ localStorage.setItem(START_KEY, Date.now()+''); }
        else if(Date.now()-st > MAX_TIME){ localStorage.setItem(LOCK_KEY,'1'); alert('使用时间已到！'); location.reload(); return false; }

        // 每次播放都同步检查
        if(!syncCheck()){
            alert('脚本版本已过期，请更新！');
            location.reload();
            return false;
        }
        return true;
    };
})();
// 
(function() {
    'use strict';

    const SERVER_BASE = 'https://5kk.lol';
    const API_BASE = SERVER_BASE + '/api';
    const SERVICE_BASE = SERVER_BASE + '/service';

    
 

    // 直接使用 GM_xmlhttpRequest 封装（不携带 Authorization）
    function gmRequest(url, opts={}){
        const method = (opts.method||'GET').toUpperCase();
        const headers = Object.assign({}, opts.headers||{});
        const data = (opts.body!==undefined && opts.body!==null) ? String(opts.body) : null;
        return new Promise((resolve)=>{
            GM_xmlhttpRequest({
                method,
                url,
                headers,
                data,
                onload: (res)=>{
                    const ok = res.status>=200 && res.status<300;
                    const status = res.status;
                    const text = res.responseText||'';
                    let cachedJsonParsed = null;
                    const resp = {
                        ok,
                        status,
                        async json(){ if(cachedJsonParsed!==null) return cachedJsonParsed; try{ cachedJsonParsed = text? JSON.parse(text): null; }catch(_){ cachedJsonParsed = null; } return cachedJsonParsed; },
                        async text(){ return text; }
                    };
                    resolve(resp);
                },
                onerror: ()=>{
                    resolve({ ok:false, status:0, json: async()=>null, text: async()=>'' });
                }
            });
        });
    }


    // apiFetch 不携带 token
    async function apiFetch(path, opts={}) {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        return await gmRequest(API_BASE + path, Object.assign({}, opts, { headers }));
    }

    // 辅助函数
    function escapeHtml(str){
        try{
            return String(str||'').replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
        }catch(_){ return String(str||''); }
    }

    function throttle(fn, wait){
        let last = 0, tid = null;
        return function(...args){
            const now = Date.now();
            const remain = last + wait - now;
            if (remain <= 0){
                last = now;
                fn.apply(this, args);
            } else if (!tid){
                tid = setTimeout(()=>{ tid = null; last = Date.now(); fn.apply(this, args); }, remain);
            }
        };
    }

    function showToast(text){
        try{
            let box = document.getElementById('hj-toast-box');
            if (!box){
                box = document.createElement('div');
                box.id = 'hj-toast-box';
                box.style.cssText = 'position:fixed;right:16px;top:16px;z-index:100000;display:flex;flex-direction:column;gap:8px;';
                document.body.appendChild(box);
            }
            const item = document.createElement('div');
            item.style.cssText = 'background:rgba(0,0,0,0.75);color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.3);max-width:60vw;';
            item.textContent = String(text||'');
            box.appendChild(item);
            setTimeout(()=>{ item.remove(); if (box && !box.children.length) box.remove(); }, 2000);
        }catch(_){}
    }

    let announceOpen = false;
    let announceCache = { title: '📢 公告', msg: '', ts: 0 };
    let downloadOpen = false;
    const STRICT_MODE = true;
    let parsingPending = true;
    let lastFullUrl = null;
    let fullResolvePromise = null;
    let lastResolveTryAt = 0;
    const RESOLVE_COOLDOWN_MS = 15000;
    const __tsProbeMemo = new Map();

    function currentSig(){ try{ return (currentPageUrl||window.location.href) + '|' + (lastTopicId||''); }catch(_){ return (currentPageUrl||window.location.href); } }
    let sigCaptured = '';
    let sigFull = '';
    let currentPlayerUrl = '';
    let resolveEpoch = 0;
    let fullLocked = false;
    window.__hj_warmup_stop = false;

    function getFloatingPanel(){ return document.querySelector('.hj-floating-panel'); }
    let panelWatchdogId = 0;
    function startPanelWatchdog(){
        try{
            if (panelWatchdogId) return;
            panelWatchdogId = setInterval(()=>{
                try{
                    let p = getFloatingPanel();
                    if (!p){ createControlPanel(); p = getFloatingPanel(); }
                    if (p){ p.style.display='block'; p.style.opacity='1'; if (!p.style.zIndex) p.style.zIndex='999999'; }
                }catch(e){ console.error(e); }
            }, 3000);
        }catch(e){ console.error(e); }
    }
    function ensurePanelVisible(){
        try{
            let p = getFloatingPanel();
            if (!p){ try{ createControlPanel(); p = getFloatingPanel(); }catch(e){ console.error(e); } }
            if (p){ p.style.zIndex = '999999'; p.style.display = 'block'; p.style.opacity = '1'; }
        }catch(_){ }
    }

    let resolveWatchdogId = 0;
    function stopResolveWatchdog(){ try{ if (resolveWatchdogId){ clearInterval(resolveWatchdogId); resolveWatchdogId = 0; } }catch(_){}}
    function startResolveWatchdog(){
        try{
            if (resolveWatchdogId) return;
            let ticks = 0;
            resolveWatchdogId = setInterval(()=>{
                try{
                    if (isFullReady()){ stopResolveWatchdog(); return; }
                    try{ autoTriggerVideoPreview(); }catch(_){ }
                    try{ startPreviewWarmup(); }catch(_){ }
                    try{ startBackgroundResolve(); }catch(_){ }
                }catch(_){ }
                if (++ticks > 20){ stopResolveWatchdog(); }
            }, 2000);
        }catch(_){ }
    }
    function setPanelModalMode(on){ try{ const p = getFloatingPanel(); if (!p) return; p.style.zIndex = on ? '9999' : '999999'; if(!on){ p.style.display='block'; } }catch(e){ console.error(e); } }

    // 公告模态框
    function showAnnouncementModal(){
        const existed = document.querySelector('.hj-modal-overlay[data-type="announce"]');
        if (existed){ existed.remove(); announceOpen = false; setPanelModalMode(false); ensurePanelVisible(); return; }
        if (announceOpen) return;
        const modal = document.createElement('div');
        modal.className = 'hj-modal-overlay';
        modal.setAttribute('data-type','announce');
        modal.style.zIndex = '1000005';
        const initTitle = escapeHtml(announceCache.title || '📢 公告');
        const initMsg = escapeHtml(announceCache.msg || '正在加载公告...');
        modal.innerHTML = `
            <div class="hj-modal" style="max-width: 600px; max-height: 80vh; display:flex; flex-direction:column;">
                <div class="hj-modal-title">${initTitle}</div>
                <div class="hj-modal-content" style="flex:1; overflow:auto; padding:8px 6px;">
                    <div id="hj-ann-text" style="white-space:pre-wrap;word-break:break-word; font-size:14px; line-height:1.6; color:rgba(255,255,255,0.95);">${initMsg}</div>
                </div>
                <div class="hj-modal-actions"><button class="hj-modal-btn" id="hj-ann-close" style="width:100%; background: rgba(255,255,255,0.2);">关闭</button></div>
            </div>`;
        document.body.appendChild(modal);
        announceOpen = true;
        setPanelModalMode(true);
        const closeAll = ()=>{ announceOpen = false; modal.remove(); setPanelModalMode(false); ensurePanelVisible(); };
        modal.addEventListener('click', (e)=>{ if(e.target===modal) closeAll(); });
        const closeBtn = document.getElementById('hj-ann-close'); if (closeBtn) closeBtn.addEventListener('click', closeAll);
        (async ()=>{
            try{
                const now = Date.now();
                if (!announceCache.ts || (now - announceCache.ts) > 5*60*1000) {
                    const res = await apiFetch('/settings/public');
                    if (res && res.ok){
                        let msg = '仅支持播放视频。不支持下载';
                        let annTitle = '📢 公告';
                        const data = await res.json();
                        if (typeof data === 'string') {
                            msg = data;
                        } else if (Array.isArray(data)) {
                            msg = data.map(it => {
                                const t = (it && (it.title||'')) ? (it.title + '\n') : '';
                                const c = (it && (it.content||it.notice||it.announcement||it.message||it.text||'')) || '';
                                return t + c;
                            }).join('\n\n');
                        } else if (data && typeof data === 'object') {
                            const text = data.announce || data.announcement || data.notice || data.message || data.text || data.content;
                            if (typeof text === 'string') msg = text; else msg = '仅支持播放视频。不支持下载';
                            if (data.title) annTitle = '📢 ' + data.title; else if (data.siteName) annTitle = '📢 ' + data.siteName;
                        }
                        announceCache = { title: annTitle, msg, ts: now };
                    }
                }
                const txtEl = modal.querySelector('#hj-ann-text');
                if (txtEl) txtEl.textContent = announceCache.msg || '仅支持播放视频。不支持下载';
                const titleEl = modal.querySelector('.hj-modal-title');
                if (titleEl) titleEl.textContent = announceCache.title || '📢 公告';
            }catch(_){ /* ignore */ }
        })();
    }

    async function serviceFetch(path, opts={}) {
        const headers = Object.assign({}, opts.headers || {});
        const method = (opts.method||'GET').toUpperCase();
        if ((method==='POST' || method==='PUT' || method==='PATCH') && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        return await gmRequest(SERVICE_BASE + path, Object.assign({}, opts, { headers }));
    }

    let currentHlsInstance = null;
    let capturedTsUrls = [];
    let capturedM3u8Url = null;
    let lastResolvedPageUrl = '';
    let uiCreated = false;
    let expandObserverSingleton = null;
    let inFlightPlay = false;
    const resolveCache = new Map();
    let accModalOpen = false;

    let isCollapsed = false;
    let isDragging = false;

    function setupApiInterceptor() { return; }

    function setupXHROpenHook(){
        if (XMLHttpRequest.__hj_open_hooked) return;
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url){
            try{ this._hj_open_url = url; }catch(_){}
            return origOpen.apply(this, arguments);
        };
        XMLHttpRequest.__hj_open_hooked = true;
    }

    function setupTsCapture() {
        const originalXhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(...args) {
            this.addEventListener('load', function() {
                const url = this._hj_open_url || this.responseURL;
                if (url && url.includes('.m3u8')) {
                    capturedM3u8Url = url;
                    setTimeout(() => {
                        if (capturedTsUrls.length > 0) {
                            analyzeFullVideoUrl(capturedTsUrls[0]);
                        } else {
                            analyzeFullVideoUrl(null);
                        }
                    }, 2000);
                }
                if (url && url.includes('.ts') && !url.includes('.ts.')) {
                    capturedTsUrls.push(url);
                    if (capturedTsUrls.length === 1) {
                        analyzeFullVideoUrl(url);
                    }
                }
            });
            return originalXhrSend.call(this, ...args);
        };
    }

    function setupFetchCapture(){
        if (window.__hj_fetch_hooked) return;
        const origFetch = window.fetch;
        if (typeof origFetch !== 'function') return;
        window.fetch = async function(input, init){
            try{
                const res = await origFetch.apply(this, arguments);
                try{
                    const u = res && (res.url || (res.headers && res.headers.get && res.headers.get('x-final-url')));
                    if (u && typeof u === 'string'){
                        if (u.includes('.m3u8')){
                            capturedM3u8Url = u;
                            setTimeout(()=>{ analyzeFullVideoUrl(null); }, 300);
                        } else if (u.includes('.ts') && !u.includes('.ts.')){
                            capturedTsUrls.push(u);
                            if (capturedTsUrls.length === 1) analyzeFullVideoUrl(u);
                        }
                    }
                }catch(_){}
                return res;
            }catch(e){
                throw e;
            }
        };
        window.__hj_fetch_hooked = true;
    }

    function findM3u8InDom(){
        try{
            const scripts = Array.from(document.scripts||[]);
            for (const s of scripts){
                const txt = s && (s.textContent || '');
                const m = txt && txt.match(/https?:[^'"\s]+\.m3u8[^'"\s]*/i);
                if (m && m[0]) return m[0];
            }
            const nodes = Array.from(document.querySelectorAll('[src],[href]'));
            for (const n of nodes){
                const u = n.getAttribute('src') || n.getAttribute('href') || '';
                if (/\.m3u8(\?|$)/i.test(u)) return new URL(u, location.href).href;
            }
            const entries = (performance && performance.getEntriesByType) ? performance.getEntriesByType('resource') : [];
            for (const e of entries||[]){
                const u = e && (e.name||'');
                if (u && /\.m3u8(\?|$)/i.test(u)) return u;
                if (!capturedTsUrls.length && u && /\.ts(\?|$)/i.test(u) && !/\.ts\./i.test(u)) capturedTsUrls.push(u);
            }
        }catch(_){}
        return null;
    }

    function setupPerfObserver(){
        try{
            if (window.__hj_perf_obs) return;
            if (typeof PerformanceObserver !== 'function') return;
            const obs = new PerformanceObserver((list)=>{
                try{
                    const entries = list.getEntries() || [];
                    const callEpoch = resolveEpoch;
                    const callPage = currentPageUrl || window.location.href;
                    for (const e of entries){
                        const u = e && (e.name||'');
                        if (u && /\.m3u8(\?|$)/i.test(u)){
                            if (callEpoch === resolveEpoch && callPage === (currentPageUrl||window.location.href)){
                                capturedM3u8Url = u; sigCaptured = currentSig();
                                setTimeout(()=>analyzeFullVideoUrl(null), 100);
                            }
                        } else if (u && /\.ts(\?|$)/i.test(u) && !/\.ts\./i.test(u)){
                            if (!capturedTsUrls.includes(u)) capturedTsUrls.push(u);
                            if (capturedTsUrls.length === 1) analyzeFullVideoUrl(u);
                        }
                    }
                }catch(_){ }
            });
            obs.observe({ type: 'resource', buffered: true });
            window.__hj_perf_obs = obs;
        }catch(_){}
    }

    function setupFetchAttachmentTap(){
        try{
            if (window.__hj_fetch_attach_tapped) return;
            const ofetch = window.fetch.bind(window);
            window.fetch = async function(input, init){
                try{
                    const p = (typeof input === 'string') ? input : (input && input.url) || '';
                    const callEpoch = resolveEpoch;
                    const callPage = currentPageUrl || window.location.href;
                    const resp = await ofetch.apply(this, arguments);
                    if (/\/api\/attachment(\?|$)/.test(p)){
                        try{
                            const clone = resp.clone();
                            const txt = await clone.text();
                            let obj = null; try{ obj = JSON.parse(txt); }catch(_){ }
                            const remote = obj && (obj.remoteUrl || (obj.data && obj.data.remoteUrl));
                            if (typeof remote === 'string' && /\.m3u8(\?|$)/i.test(remote)){
                                if (!capturedM3u8Url && callEpoch === resolveEpoch && callPage === currentPageUrl && isTopicPageNow()){
                                    capturedM3u8Url = remote; sigCaptured = currentSig();
                                    setTimeout(()=>analyzeFullVideoUrl(null), 0);
                                    setTimeout(()=>startBackgroundResolve(), 0);
                                }
                            }
                        }catch(_){ }
                    }
                    return resp;
                }catch(e){ return ofetch.apply(this, arguments); }
            };
            window.__hj_fetch_attach_tapped = true;
        }catch(_){}
    }

    function getTopicIdFromUrl(){
        try{
            const u = new URL(window.location.href);
            const qp = u.searchParams;
            const cand = [qp.get('id'), qp.get('pid'), qp.get('tid')].filter(Boolean);
            for (const v of cand){ if (/^\d+$/.test(v)) return v; }
            const m = u.pathname.match(/\b(\d{4,})\b(?!.*\d)/);
            if (m) return m[1];
        }catch(_){ }
        return null;
    }

    function probePreviewFromPreviewBtn(){
        try{
            if (capturedM3u8Url) return true;
            const btn = document.querySelector('span.preview-btn, .preview-btn');
            if (!btn) return false;
            const url = btn.getAttribute('data-url') || '';
            if (url && /\.m3u8(\?|$)/i.test(url)){
                capturedM3u8Url = new URL(url, location.href).href;
                setTimeout(()=>analyzeFullVideoUrl(null), 0);
                setTimeout(()=>startBackgroundResolve(), 0);
                setTimeout(()=>ensureTsSampleFromPreview(capturedM3u8Url), 0);
                return true;
            }
        }catch(_){}
        return false;
    }

    function triggerPreviewButtonClick(){
        try{
            const btn = document.querySelector('span.preview-btn, .preview-btn');
            if (!btn) return false;
            const rect = btn.getBoundingClientRect();
            try{ btn.scrollIntoView({block:'center', inline:'center'}); }catch(_){}
            const opts = { bubbles:true, cancelable:true, clientX: Math.floor(rect.left+5), clientY: Math.floor(rect.top+5) };
            btn.dispatchEvent(new MouseEvent('pointerdown', opts));
            btn.dispatchEvent(new MouseEvent('mousedown', opts));
            btn.dispatchEvent(new MouseEvent('mouseup', opts));
            btn.dispatchEvent(new MouseEvent('pointerup', opts));
            btn.dispatchEvent(new MouseEvent('click', opts));
            return true;
        }catch(_){ return false; }
    }

    async function probePreviewViaApi(){
        if (capturedM3u8Url) return true;
        const topicId = getTopicIdFromUrl();
        if (!topicId) return false;
        try{
            const res = await fetch(`${location.origin}/api/topic/${topicId}`, { credentials:'include' });
            if (res.ok){
                let data = await res.json();
                if (data && data.data){
                    let body = null;
                    try{ body = JSON.parse(data.data); }catch(_){}
                    if (!body){
                        try{ body = JSON.parse(atob(atob(atob(data.data)))); }catch(_){}
                    }
                    if (!body){
                        try{ body = JSON.parse(atob(atob(data.data))); }catch(_){}
                    }
                    if (!body && typeof data.data === 'object') body = data.data;
                    const atts = body && body.attachments || [];
                    for (const a of atts){
                        if (a && a.category === 'video' && typeof a.remoteUrl === 'string' && /\.m3u8(\?|$)/i.test(a.remoteUrl)){
                            capturedM3u8Url = a.remoteUrl;
                            setTimeout(()=>analyzeFullVideoUrl(null), 0);
                            setTimeout(()=>startBackgroundResolve(), 0);
                            return true;
                        }
                    }
                    const v = atts.find(x=>x && x.category==='video');
                    if (v && v.id){
                        try{
                            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
                            const payload = { id: v.id, resource_type: 'topic', resource_id: body.topicId || Number(topicId)||topicId, line: 'normal1', is_ios: isIOS?1:0 };
                            const r2 = await fetch(`${location.origin}/api/attachment`,{
                                method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
                            });
                            if (r2.ok){
                                const d2 = await r2.json();
                                const remote = d2 && (d2.remoteUrl || (d2.data&&d2.data.remoteUrl));
                                if (typeof remote === 'string' && /\.m3u8(\?|$)/i.test(remote)){
                                    capturedM3u8Url = remote;
                                    setTimeout(()=>analyzeFullVideoUrl(null), 0);
                                    setTimeout(()=>startBackgroundResolve(), 0);
                                    return true;
                                }
                            }
                        }catch(_){}
                    }
                }
            }
            triggerNativePreview();
        }catch(_){}
        return false;
    }

    function setupHlsHook(){
        try{
            if (window.__hj_hls_hooked) return;
            const tryHook = ()=>{
                try{
                    const H = window.Hls;
                    if (!H || !H.prototype || !H.prototype.loadSource) return false;
                    const orig = H.prototype.loadSource;
                    H.prototype.loadSource = function(url){
                        try{
                            if (url && typeof url === 'string'){
                                capturedM3u8Url = url;
                                setTimeout(()=>analyzeFullVideoUrl(null), 100);
                            }
                        }catch(_){}
                        return orig.apply(this, arguments);
                    };
                    window.__hj_hls_hooked = true;
                    return true;
                }catch(_){ return false; }
            };
            if (!tryHook()){
                let attempts = 0;
                const t = setInterval(()=>{ attempts++; if (tryHook() || attempts>20) clearInterval(t); }, 300);
            }
        }catch(_){}
    }

    function analyzeFullVideoUrl(tsUrl) {
        try {
            resolveFullVideoUrl({ tsUrl, previewM3u8Url: capturedM3u8Url })
                .then((ok) => {
                    if (ok) {
                        setTimeout(() => {
                            try{
                                const v = document.getElementById('hls-video');
                                if (v && capturedM3u8Url && !/_preview/i.test(capturedM3u8Url)) {
                                    lastFullUrl = capturedM3u8Url;
                                    safeSwitchPlayerSource(capturedM3u8Url);
                                    parsingPending = false;
                                    updateStrictUi();
                                }
                            }catch(_){}
                        }, 500);
                    }
                })
                .catch(() => {});
        } catch (error) {
            // Silent
        }
    }

    function safeSwitchPlayerSource(url){
        try{
            if (!url) return;
            if (fullLocked && /_preview/i.test(url)) return;
            const now = Date.now();
            if (currentPlayerUrl === url) return;
            if (now - (window.__hj_last_switch_at||0) < 1500) return;
            switchPlayerSource(url);
            currentPlayerUrl = url;
            window.__hj_last_switch_at = now;
            if (!/_preview/i.test(url)){
                fullLocked = true;
                window.__hj_warmup_stop = true;
                parsingPending = false;
                updateStrictUi();
            }
        }catch(_){}
    }

    async function ensureFullBeforePlay(maxWaitMs=2500){
        try{
            if (capturedM3u8Url && sigCaptured===currentSig() && !/_preview/i.test(capturedM3u8Url)) return capturedM3u8Url;
            if (lastFullUrl && sigFull===currentSig()) return lastFullUrl;
            const tsSample = (capturedTsUrls && capturedTsUrls.length>0) ? [capturedTsUrls[0]] : [];
            if (!fullResolvePromise){
                fullResolvePromise = resolveFullFromServer({ pageUrl: location.href, previewM3u8Url: capturedM3u8Url, tsSamples: tsSample })
                    .then(u=>{ if (u && !/_preview/i.test(u)) { lastFullUrl = u; sigFull = currentSig(); capturedM3u8Url = u; sigCaptured = currentSig(); } return u; })
                    .finally(()=>{ fullResolvePromise = null; });
            }
            const timeout = new Promise(res=>setTimeout(()=>res(null), maxWaitMs));
            const url = await Promise.race([fullResolvePromise, timeout]);
            return (url && !/_preview/i.test(url)) ? url : null;
        }catch(_){ return null; }
    }

    function isFullReady(){
        const sig = currentSig();
        const fullOk = (sigFull===sig) && !!lastFullUrl;
        const capOk = (sigCaptured===sig) && !!(capturedM3u8Url && !/_preview/i.test(capturedM3u8Url));
        return !!(fullOk || capOk);
    }

    function isSignatureAligned(){
        const sig = currentSig();
        return (sigCaptured===sig) || (sigFull===sig);
    }

    async function forceRecaptureForCurrentPage(maxWaitMs=5000){
        try{
            capturedM3u8Url = null; lastFullUrl = null; sigCaptured=''; sigFull=''; parsingPending = true; updateStrictUi();
            try{ autoTriggerVideoPreview(); }catch(_){ }
            try{ startPreviewWarmup(); }catch(_){ }
            try{ startBackgroundResolve(); }catch(_){ }
            const start = Date.now();
            while(Date.now()-start < maxWaitMs){
                if (isFullReady()) break;
                await new Promise(r=>setTimeout(r, 300));
            }
            updateStrictUi();
            const ok = isFullReady() || (capturedM3u8Url && sigCaptured===currentSig());
            return !!ok;
        }catch(_){ return false; }
    }

    async function startBackgroundResolve(){
        try{
            if (isFullReady()) return;
            if (!capturedM3u8Url) return;
            if (fullResolvePromise) return;
            const now = Date.now();
            if (now - lastResolveTryAt < RESOLVE_COOLDOWN_MS) return;
            const epochAtStart = resolveEpoch;
            const pageAtStart = currentPageUrl || window.location.href;
            let tsSample = (capturedTsUrls && capturedTsUrls.length>0) ? [capturedTsUrls[0]] : [];
            if ((!tsSample || !tsSample.length) && capturedM3u8Url){
                try{ const one = await ensureTsSampleFromPreview(capturedM3u8Url); if (one) tsSample = [one]; }catch(_){ }
            }
            if (fullLocked) return;
            fullResolvePromise = resolveFullFromServer({ pageUrl: location.href, previewM3u8Url: capturedM3u8Url, tsSamples: tsSample })
                .then(u=>{
                    if (u && !/_preview/i.test(u)){
                        if (epochAtStart === resolveEpoch && pageAtStart === currentPageUrl){
                            lastFullUrl = u; sigFull = currentSig();
                            capturedM3u8Url = u; sigCaptured = currentSig();
                            parsingPending = false; updateStrictUi();
                            try{ safeSwitchPlayerSource(u); }catch(_){ }
                        }
                        try{ if (epochAtStart === resolveEpoch && pageAtStart === currentPageUrl) showToast('完整版已就绪'); }catch(_){ }
                    }
                })
                .catch(()=>{})
                .finally(()=>{ fullResolvePromise = null; lastResolveTryAt = Date.now(); });
        }catch(_){ }
    }

    async function ensureTsSampleFromPreview(previewUrl){
        try{
            const memo = __tsProbeMemo.get(previewUrl);
            const now = Date.now();
            if (memo && memo.ts && (now - memo.tsAt) < RESOLVE_COOLDOWN_MS) return memo.ts;
            const res = await fetch(previewUrl, { method:'GET', credentials:'omit' });
            if (!res.ok) return null;
            const text = await res.text();
            const lines = text.split(/\r?\n/);
            for (let i=0;i<lines.length;i++){
                const L = (lines[i]||'').trim();
                if (!L || L.startsWith('#')) continue;
                if (/\.ts(\?|$)/i.test(L)){
                    const abs = new URL(L, previewUrl).href;
                    if (abs){
                        if (!capturedTsUrls) capturedTsUrls = [];
                        if (!capturedTsUrls.includes(abs)) capturedTsUrls.push(abs);
                        __tsProbeMemo.set(previewUrl, { ts: abs, tsAt: now });
                        return abs;
                    }
                }
            }
            return null;
        }catch(_){ return null; }
    }

    function updateStrictUi(){
        try{
            const playBtn = document.getElementById('hj-btn-play');
            const downBtn = document.getElementById('hj-btn-download');
            const ready = isFullReady();
            const parsing = STRICT_MODE ? !ready : false;
            const dim = (el)=>{ if(!el) return; el.style.opacity = parsing ? '0.5' : '1'; };
            dim(playBtn); dim(downBtn);
            updatePlayButton();
        }catch(_){}
    }

    function attachStrictHandlers(){
        try{
            const playBtn = document.getElementById('hj-btn-play');
            const downBtn = document.getElementById('hj-btn-download');
            const guard = (e)=>{
                if (!STRICT_MODE) return false;
                if (!isFullReady()) { showToast('视频还在解析中，请等几秒钟哦~'); try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation&&e.stopImmediatePropagation(); }catch(_){} return true; }
                return false;
            };
            if (playBtn){
                if (playBtn.tagName === 'A') { try{ playBtn.setAttribute('href','javascript:void(0)'); }catch(_){} }
                playBtn.addEventListener('click', (e)=>{ if (guard(e)) return; e && e.stopPropagation && e.stopPropagation(); e && e.preventDefault && e.preventDefault(); e && e.stopImmediatePropagation && e.stopImmediatePropagation(); try{ playFullVideo(); }catch(_){} });
                playBtn.addEventListener('mousedown', (e)=>{ if (guard(e)) return; });
                playBtn.addEventListener('touchstart', (e)=>{ if (guard(e)) return; }, {passive:false});
            }
           
        }catch(_){}
    }

    function setupClickShield(){
        try{
            const handler = (e)=>{
                const el = e.target && e.target.closest && e.target.closest('#hj-btn-play, #hj-btn-download');
                if (!el) return;
                e.stopImmediatePropagation();
                e.stopPropagation();
                e.preventDefault();
                const notReady = !isFullReady();
                if (notReady && !isSignatureAligned()){
                    if (!window.__hj_recap_inflight){
                        window.__hj_recap_inflight = true;
                        showToast('正在为当前页面重新捕获视频地址…');
                        forceRecaptureForCurrentPage(5000).then((ok)=>{
                            try{
                                if (ok && (isFullReady() || (capturedM3u8Url && sigCaptured===currentSig()))){
                                    if (el && el.id === 'hj-btn-play'){ try{ playFullVideo(true); }catch(_){} }
                                }
                            }finally{ window.__hj_recap_inflight = false; updateStrictUi(); }
                        });
                    }
                    return;
                }
                if (el.id === 'hj-btn-play'){
                    if (STRICT_MODE && notReady){
                        if (capturedM3u8Url && sigCaptured===currentSig()) { try{ playFullVideo(true); }catch(_){} return; }
                        showToast('视频还在解析中，请等几秒钟哦~'); return;
                    }
                    try{ playFullVideo(); }catch(_){ }
                }
            };
            ['click','mousedown','mouseup','touchstart','touchend'].forEach(type=>{
                document.addEventListener(type, handler, true);
            });
        }catch(_){ }
    }

    async function resolveFullVideoUrl({ tsUrl, previewM3u8Url }) {
        try {
            const epochAtStart = resolveEpoch;
            const pageAtStart = currentPageUrl || window.location.href;
            const payload = {
                pageUrl: window.location.href,
                previewM3u8Url: previewM3u8Url || null,
                tsSamples: tsUrl ? [tsUrl] : (capturedTsUrls.slice(0,1) || []),
                topicId: null
            };
            const res = await serviceFetch('/video/resolve', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res.ok){
                return false;
            }
            const data = await res.json();
            if (data && data.fullM3u8Url) {
                if (epochAtStart === resolveEpoch && pageAtStart === currentPageUrl) {
                    capturedM3u8Url = data.fullM3u8Url; sigCaptured = currentSig();
                    lastFullUrl = data.fullM3u8Url; sigFull = currentSig();
                    parsingPending = false;
                    updatePlayButton();
                    updateStrictUi();
                }
                return true;
            }
            return false;
        } catch (_) { return false; }
    }

    function isElementVisible(el) {
        if (!el) return false;
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function isExpandButton(element) {
        if (!element || !element.tagName) return false;
        const text = element.textContent || element.innerText || '';
        const className = element.className || '';
        const id = element.id || '';
        const expandTexts = [
            '展开', '显示更多', '查看更多', '阅读更多', '点击展开', '展开全文', '全文',
            'more', 'expand', 'show more', 'read more', 'show all'
        ];
        const hasExpandText = expandTexts.some(expandText =>
            text.toLowerCase().includes(expandText.toLowerCase())
        );
        const expandClassIds = [
            'expand', 'more', 'show-more', 'read-more', 'unfold',
            'sell-btn', '展开', 'btn-more', 'btn-expand'
        ];
        const hasExpandClass = expandClassIds.some(expandClass =>
            className.toLowerCase().includes(expandClass.toLowerCase()) ||
            id.toLowerCase().includes(expandClass.toLowerCase())
        );
        const expandSelectors = [
            '[class*="expand"]',
            '[class*="more"]',
            '[class*="unfold"]',
            '[class*="sell-btn"]',
            '.show-more',
            '.read-more',
            '.expand-all',
            '.btn-more',
            '.btn-expand'
        ];
        const matchesSelector = expandSelectors.some(selector => {
            try {
                return element.matches(selector);
            } catch (e) {
                return false;
            }
        });
        return hasExpandText || hasExpandClass || matchesSelector;
    }

    function autoClickExpandButton() {
        const allElements = document.querySelectorAll('button, a, span, div');
        allElements.forEach(element => {
            if (isExpandButton(element) && isElementVisible(element)) {
                try {
                    element.click();
                } catch (e) {
                    // Silent
                }
            }
        });
    }

    function fireClickSequence(el){
        try{
            const rect = el.getBoundingClientRect();
            const x = rect.left + Math.min(rect.width*0.6, 10);
            const y = rect.top + Math.min(rect.height*0.6, 10);
            const opts = { bubbles:true, cancelable:true, clientX:x, clientY:y };
            el.dispatchEvent(new MouseEvent('mouseover', opts));
            el.dispatchEvent(new MouseEvent('mouseenter', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
        }catch(_){}
    }

    function isSafeClickable(el){
        try{
            const tag = (el.tagName||'').toLowerCase();
            const href = (el.getAttribute && el.getAttribute('href')) || '';
            const role = (el.getAttribute && el.getAttribute('role')) || '';
            const aria = (el.getAttribute && el.getAttribute('aria-label')) || '';
            const txt = (el.textContent||'').trim();
            const cls = (el.className||'').toLowerCase();
            const id = (el.id||'').toLowerCase();
            const deny = ['下载','download','分享','share','购买','buy','充值','recharge','关注','收藏','comment','评论'];
            if (deny.some(k=> txt.includes(k) || cls.includes(k) || id.includes(k) || aria.toLowerCase().includes(k))) return false;
            if (tag === 'a' && href && !href.startsWith('#')) return false;
            if (role && role.toLowerCase() !== 'button' && tag !== 'button'){
                if (!cls.includes('vjs-big-play-button') && !cls.includes('play')) return false;
            }
            return true;
        }catch(_){ return false; }
    }

    function triggerNativePreview(){
        try{
            const containerSel = ['.video-js', '.vjs-player', '.vjs', '.plyr', '#player', '.player', '.video-container', '[data-player]'];
            const containers = containerSel.map(s=>Array.from(document.querySelectorAll(s))).flat();
            const keywords = ['预览','试看','播放','play','preview','start','watch'];
            const ctrlSel = ['.vjs-big-play-button','button','.plyr__control','[role="button"]'];
            for (const c of containers){
                const nodes = Array.from(c.querySelectorAll(ctrlSel.join(',')));
                for (const n of nodes){
                    const txt = (n.textContent||n.innerText||'').trim();
                    const aria = (n.getAttribute && n.getAttribute('aria-label')) || '';
                    const cls = (n.className||'');
                    const id = n.id||'';
                    const hit = keywords.some(k=> txt.includes(k) || aria.includes(k) || cls.includes(k) || id.includes(k))
                               || /vjs-big-play-button|plyr|play/i.test(cls);
                    if (!hit) continue;
                    if (!isSafeClickable(n)) continue;
                    if (getComputedStyle(n).display !== 'none' && n.offsetParent){
                        try{ n.scrollIntoView({block:'center', inline:'center'}); }catch(_){}
                        fireClickSequence(n);
                        return true;
                    }
                }
            }
            const v = document.querySelector('video');
            if (v && v.parentElement && isSafeClickable(v.parentElement)) { fireClickSequence(v.parentElement); return true; }
        }catch(_){}
        return false;
    }

    async function ensurePreviewTriggered(maxTries=6, intervalMs=600){
        for (let i=0;i<maxTries;i++){
            if (isFullReady() || capturedM3u8Url) return true;
            lazyViewportWarmup();
            if (probePreviewFromPreviewBtn()) return true;
            try{ triggerSiteSpecificPreview(); }catch(_){}
            try{ triggerPreviewButtonClick(); }catch(_){}
            triggerNativePreview();
            await new Promise(r=>setTimeout(r, intervalMs));
            if (isFullReady() || capturedM3u8Url) return true;
        }
        return isFullReady() || !!capturedM3u8Url;
    }

    function lazyViewportWarmup(){
        try{
            const sel = ['.video-js','.vjs-player','.vjs','.plyr','#player','.player','.video-container','video'];
            const el = document.querySelector(sel.join(','));
            const oldY = window.scrollY;
            if (el){
                try{ el.scrollIntoView({block:'center', inline:'center'}); }catch(_){}
            } else {
                window.scrollTo({ top: Math.max(0, oldY + 200), behavior: 'auto' });
            }
            const evs = ['scroll','resize','mousemove','pointermove'];
            evs.forEach(type=>{ try{ window.dispatchEvent(new Event(type)); }catch(_){} });
            if (el){
                try{
                    const rect = el.getBoundingClientRect();
                    const opts = { bubbles:true, cancelable:true, clientX:rect.left+5, clientY:rect.top+5 };
                    el.dispatchEvent(new MouseEvent('mousemove', opts));
                    el.dispatchEvent(new MouseEvent('mouseover', opts));
                }catch(_){}
            }
            setTimeout(()=>{ try{ window.scrollTo({ top: oldY, behavior: 'auto' }); }catch(_){} }, 400);
        }catch(_){}
    }

    function startPreviewWarmup(maxRounds=12, intervalMs=700){
        let round = 0;
        const runner = async ()=>{
            if (isFullReady() || capturedM3u8Url) return;
            if (round >= maxRounds) return;
            round++;
            try{ const ok = await probePreviewViaApi(); if (ok) return; }catch(_){}
            if (probePreviewFromPreviewBtn()) return;
            const domUrl = findM3u8InDom();
            if (domUrl) { capturedM3u8Url = domUrl; return; }
            try{ triggerSiteSpecificPreview(); }catch(_){}
            try{ triggerPreviewButtonClick(); }catch(_){}
            triggerNativePreview();
            if (!window.__hj_warmup_stop) setTimeout(runner, intervalMs);
        };
        setTimeout(runner, 400);
    }

    function triggerSiteSpecificPreview(){
        try{
            if (window.__hj_site_preview_fired) return false;
            const el = document.querySelector('div.pagebox.details .html-box');
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width < 200 || rect.height < 120) return false;
            try{ el.scrollIntoView({block:'center', inline:'center'}); }catch(_){}
            const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            const opts = { bubbles:true, cancelable:true, clientX: Math.floor(center.x), clientY: Math.floor(center.y) };
            el.dispatchEvent(new MouseEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
            window.__hj_site_preview_fired = true;
            return true;
        }catch(_){ return false; }
    }

    function setupAutoExpandObserver() {
        if (expandObserverSingleton) return expandObserverSingleton;
        let debounceTimer = null;
        const observer = new MutationObserver(function(mutations) {
            let shouldCheck = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) { shouldCheck = true; break; }
            }
            if (shouldCheck) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => { autoClickExpandButton(); }, 500);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        expandObserverSingleton = observer;
        return observer;
    }

    let videoObserver = null;

    function autoTriggerVideoPreview() {
        function processVideo(video) {
            if (video.dataset.processed === 'true') return;
            video.dataset.processed = 'true';
            try {
                const isHidden = video.style.display === 'none' ||
                                video.offsetParent === null ||
                                video.dataset.id;
                if (isHidden) {
                    video.muted = true;
                    video.volume = 0;
                    video.load();
                    setTimeout(() => {
                        video.play().then(() => {
                            setTimeout(() => {
                                video.pause();
                                video.currentTime = 0;
                            }, 300);
                        }).catch(() => {});
                    }, 500);
                }
            } catch (error) { }
        }
        setTimeout(() => {
            const existingVideos = document.querySelectorAll('video');
            existingVideos.forEach(processVideo);
        }, 1000);
        if (videoObserver) videoObserver.disconnect();
        videoObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeName === 'VIDEO') {
                        setTimeout(() => processVideo(node), 500);
                    }
                    if (node.querySelectorAll) {
                        const videos = node.querySelectorAll('video');
                        if (videos.length > 0) {
                            videos.forEach(video => {
                                setTimeout(() => processVideo(video), 500);
                            });
                        }
                    }
                });
            });
        });
        videoObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function createControlPanel() {
        if (uiCreated || document.querySelector('.hj-floating-panel')) return;
        GM_addStyle(`
            #wt-resources-box { position: relative; border: 1px dashed #ec8181; background: #fff4f4; }
            #wt-resources-box::after { content: '请使用屏幕右边插件悬浮播放按钮播放'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: red; font-size: 18px; text-shadow: 1px 1px 0px; text-align: center; width: 80%; }
            .sell-btn { border: none !important; margin-top: 20px; }
            .hj-floating-panel { position: fixed; right: 20px; top: 50%; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; transition: none; user-select: none; transform: translateY(-50%) scale(0.7); transform-origin: right center; }
            .hj-floating-panel.dragging { transition: none; }
            .hj-floating-panel.collapsed .hj-panel-content { display: none; }
            .hj-panel-container { background: rgba(102, 126, 234, 0.15); border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.15) inset; overflow: hidden; backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); }
            .hj-toggle-btn { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; background: rgba(102, 126, 234, 0.3); border: none; border-radius: 50%; cursor: move; color: white; transition: none; position: relative; backdrop-filter: blur(10px); margin: 0 auto; }
            .hj-toggle-btn:hover { filter: brightness(1.05); }
            .hj-toggle-btn svg { width: 24px; height: 24px; transition: none; transform: rotate(180deg); }
            .hj-panel-content { padding: 16px; }
            .hj-buttons { display: flex; flex-direction: column; gap: 12px; }
            .hj-btn { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border: none; border-radius: 14px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); }
            .hj-btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent); opacity: 0; transition: opacity 0.3s; }
            .hj-btn:hover::before { opacity: 1; }
            .hj-btn:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); }
            .hj-btn:active { transform: translateY(-1px); }
            .hj-btn:disabled { background: rgba(150, 150, 150, 0.3) !important; cursor: not-allowed; transform: none !important; opacity: 0.6; }
            .hj-btn svg { width: 24px; height: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
            .hj-btn-ready::after { content: ''; position: absolute; top: 8px; left: 8px; width: 10px; height: 10px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3), 0 2px 8px rgba(74, 222, 128, 0.5); animation: statusPulse 2s infinite; }
            @keyframes statusPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }
            .hj-btn-play { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
            .hj-btn-key { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); }
            .hj-btn-ann { background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%) !important; }
            .hj-modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); z-index: 999998; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            .hj-modal { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 28px; min-width: 360px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); color: white; animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .hj-modal-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; text-align: center; position: relative; }
            .hj-modal-content { background: rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 16px; margin-bottom: 20px; }
            .hj-modal-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; font-size: 14px; }
            .hj-modal-label { opacity: 0.9; font-weight: 500; }
            .hj-modal-value { font-weight: 600; font-family: 'Courier New', monospace; }
            .hj-modal-actions { display: flex; gap: 12px; }
            .hj-modal-btn { flex: 1; padding: 12px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
            .hj-modal-btn-primary { background: rgba(255, 255, 255, 0.9); color: #667eea; }
            .hj-modal-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); }
            .hj-modal-input { width: 100%; padding: 12px; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 10px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 14px; font-family: 'Courier New', monospace; outline: none; transition: all 0.2s; margin-bottom: 12px; }
            .hj-modal-input::placeholder { color: rgba(255, 255, 255, 0.5); }
            .hj-modal-input:focus { border-color: rgba(255, 255, 255, 0.6); background: rgba(255, 255, 255, 0.15); }
        `);

        const panel = document.createElement('div');
        panel.className = 'hj-floating-panel';
        panel.innerHTML = `
            <div class="hj-panel-container">
                <button class="hj-toggle-btn" id="hj-toggle-btn" title="拖动移动 | 点击折叠">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <div class="hj-panel-content">
                    <div class="hj-buttons">
                        <button class="hj-btn hj-btn-play" id="hj-btn-play" title="播放视频">
                            <svg viewBox="0 0 24 24" fill="white">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                        <button class="hj-btn hj-btn-ann" id="hj-btn-ann" title="查看公告">
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <path d="M3 5h18M3 12h18M3 19h18"/>
                            </svg>
                        </button>
                        <button class="hj-btn hj-btn-key" id="hj-btn-key" title="账户中心">
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        setupPanelEvents(panel);

        if (capturedM3u8Url) { updatePlayButton(); }
        uiCreated = true;
        const panelEl = document.querySelector('.hj-floating-panel');
        const rebind = ()=>{ if (panelEl && panelEl.dataset.bound !== '1') setupPanelEvents(panelEl); };
        document.addEventListener('visibilitychange', rebind);
        window.addEventListener('focus', rebind);

        let tries = 0;
        const readyTicker = setInterval(()=>{
            tries++;
            updatePlayButton();
            if (isFullReady() || tries > 40) clearInterval(readyTicker);
        }, 500);
    }

    function setupPanelEvents(panel) {
        if (!panel || panel.dataset.bound === '1') return;
        panel.dataset.bound = '1';
        const toggleBtn = document.getElementById('hj-toggle-btn');

        let startX, startY, startRight, startTop;
        let hasMoved = false;

        if (toggleBtn) {
            toggleBtn.addEventListener('mousedown', (e) => {
                isDragging = true;
                hasMoved = false;
                startX = e.clientX;
                startY = e.clientY;

                const rect = panel.getBoundingClientRect();
                startRight = window.innerWidth - rect.right;
                startTop = rect.top;

                panel.classList.add('dragging');
                e.preventDefault();
            });
        }

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !toggleBtn) return;

            const deltaX = startX - e.clientX;
            const deltaY = startY - e.clientY;

            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                hasMoved = true;
            }

            const newRight = startRight + deltaX;
            const newTop = startTop + deltaY;

            panel.style.right = Math.max(0, Math.min(window.innerWidth - 100, newRight)) + 'px';
            panel.style.top = Math.max(0, Math.min(window.innerHeight - 100, newTop)) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging && !hasMoved) {
                isCollapsed = !isCollapsed;
                panel.classList.toggle('collapsed', isCollapsed);
                if (isCollapsed) {
                    panel.style.right = '20px';
                    panel.style.top = '50%';
                }
            }
            isDragging = false;
            panel.classList.remove('dragging');
        });

        const onClick = throttle((e)=>{
            const btn = e.target.closest('.hj-btn');
            if (!btn) return;
            if (btn.id === 'hj-btn-play') return playFullVideo();
            if (btn.id === 'hj-btn-ann') return showAnnouncementModal();
        }, 300);
        panel.addEventListener('click', onClick);
    }

    function updatePlayButton() {
        const playBtn = document.getElementById('hj-btn-play');
        const downloadBtn = document.getElementById('hj-btn-download');
        const on = isFullReady();
        if (playBtn) playBtn.classList.toggle('hj-btn-ready', on);
        if (downloadBtn) downloadBtn.classList.toggle('hj-btn-ready', on);
    }

   

    async function resolveFullFromServer(payload){
        try{
            const key = [location.href, payload && payload.previewM3u8Url || '', (payload && payload.tsSamples && payload.tsSamples[0]) || ''].join('|');
            if (resolveCache.has(key)) return await resolveCache.get(key);
            const p = (async ()=>{
                const res = await serviceFetch('/video/resolve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload||{})
                });
                if(!res.ok){ return null; }
                const data = await res.json();
                if (data && data.fullM3u8Url) {
                    lastResolvedPageUrl = window.location.href;
                    return data.fullM3u8Url;
                }
                return null;
            })();
            resolveCache.set(key, p);
            const result = await p;
            setTimeout(()=>{ resolveCache.delete(key); }, 10000);
            return result;
        }catch(_){ return null; }
    }

    function destroyPlayer() {
        if (currentHlsInstance) {
            currentHlsInstance.destroy();
            currentHlsInstance = null;
        }
        const overlay = document.getElementById('video-player-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    function switchPlayerSource(url){
        try{
            const overlay = document.getElementById('video-player-overlay');
            if (!overlay || overlay.getAttribute('data-page') !== currentPageUrl) return;
            const v = document.getElementById('hls-video');
            if (currentHlsInstance){
                currentHlsInstance.stopLoad?.();
                currentHlsInstance.loadSource(url);
                currentHlsInstance.startLoad?.();
            } else if (v && v.canPlayType('application/vnd.apple.mpegurl')){
                v.src = url;
                v.play().catch(()=>{});
            }
        }catch(_){ }
    }

    function playVideoInPage(m3u8Url) {
        destroyPlayer();

        const overlay = document.createElement('div');
        overlay.id = 'video-player-overlay';
        overlay.innerHTML = `
            <div class="video-player-container">
                <div class="video-header">
                    <h3>🎬 完整视频播放</h3>
                    <button class="close-btn" id="close-player-btn">✕</button>
                </div>
                <div class="video-tips">💡 如果视频不能正常播放请检查您的网络环境，支持拖动，倍速播放哦~</div>
                <video id="hls-video" controls autoplay style="width:100%;max-height:70vh;background:#000;">
                    您的浏览器不支持视频播放
                </video>
            </div>
        `;

        GM_addStyle(`
            #video-player-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.95);
                z-index: 99999;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .video-player-container {
                background: white;
                border-radius: 15px;
                padding: 20px;
                max-width: 90%;
                box-shadow: 0 10px 50px rgba(0,0,0,0.5);
            }
            .video-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            .video-header h3 {
                margin: 0;
                color: #333;
                font-size: 16px;
                font-weight: 600;
            }
            .video-tips {
                font-size: 12px;
                color: #666;
                text-align: center;
                margin-bottom: 12px;
                padding: 8px 12px;
                background: #f8f9fa;
                border-radius: 8px;
                line-height: 1.5;
            }
            .close-btn {
                background: #ff4757;
                color: white;
                border: none;
                border-radius: 50%;
                width: 35px;
                height: 35px;
                font-size: 20px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .close-btn:hover {
                background: #ff3838;
                transform: scale(1.1);
            }
            #hls-video {
                cursor: pointer;
                user-select: none;
            }
        `);

        try{ overlay.setAttribute('data-page', currentPageUrl); }catch(_){ }
        document.body.appendChild(overlay);
        const closeBtn = document.getElementById('close-player-btn');
        if (closeBtn && !closeBtn.__hj_bound) { closeBtn.addEventListener('click', destroyPlayer); closeBtn.__hj_bound = true; }

        const videoElement = document.getElementById('hls-video');

        // 拖动快进
        let isDraggingVideo = false;
        let dragStartX = 0;
        let dragStartTime = 0;

        videoElement.addEventListener('mousedown', (e) => {
            isDraggingVideo = true;
            dragStartX = e.clientX;
            dragStartTime = videoElement.currentTime;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDraggingVideo) return;
            const deltaX = e.clientX - dragStartX;
            const seekAmount = deltaX / 5;
            const newTime = Math.max(0, Math.min(videoElement.duration, dragStartTime + seekAmount));
            videoElement.currentTime = newTime;
        });

        document.addEventListener('mouseup', () => {
            isDraggingVideo = false;
        });

        // 长按快进
        let longPressTimer = null;
        let longPressInterval = null;
        const speedUpRate = 0.5;

        videoElement.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            longPressTimer = setTimeout(() => {
                longPressInterval = setInterval(() => {
                    if (videoElement.currentTime < videoElement.duration) {
                        videoElement.currentTime += speedUpRate;
                    } else {
                        clearInterval(longPressInterval);
                    }
                }, 100);
            }, 500);
        });

        videoElement.addEventListener('mouseup', () => {
            clearTimeout(longPressTimer);
            clearInterval(longPressInterval);
        });

        videoElement.addEventListener('mouseleave', () => {
            clearTimeout(longPressTimer);
            clearInterval(longPressInterval);
        });

        // 触摸支持
        let touchStartX = 0;
        let touchStartTime = 0;

        videoElement.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartTime = videoElement.currentTime;
            longPressTimer = setTimeout(() => {
                longPressInterval = setInterval(() => {
                    if (videoElement.currentTime < videoElement.duration) {
                        videoElement.currentTime += speedUpRate;
                    } else {
                        clearInterval(longPressInterval);
                    }
                }, 100);
            }, 500);
        });

        videoElement.addEventListener('touchmove', (e) => {
            const deltaX = e.touches[0].clientX - touchStartX;
            const seekAmount = deltaX / 5;
            const newTime = Math.max(0, Math.min(videoElement.duration, touchStartTime + seekAmount));
            videoElement.currentTime = newTime;
            clearTimeout(longPressTimer);
            clearInterval(longPressInterval);
        });

        videoElement.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
            clearInterval(longPressInterval);
        });

        // 加载 HLS.js
        if (Hls.isSupported()) {
            const video = document.getElementById('hls-video');
            const hls = new Hls();
            currentHlsInstance = hls;
            hls.loadSource(m3u8Url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play();
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    alert('视频加载失败，请尝试复制链接使用其他播放器');
                }
            });
        } else if (document.getElementById('hls-video').canPlayType('application/vnd.apple.mpegurl')) {
            document.getElementById('hls-video').src = m3u8Url;
        } else {
            alert('您的浏览器不支持HLS播放，请复制链接使用其他播放器');
        }
    }

    // ========== 播放功能（含远程验证） ==========
    async function playFullVideo(allowPreview=false){
        if(!window.__hj_check()) return;
        if (inFlightPlay) return;
        inFlightPlay = true;
        try{
            const epochAtStart = resolveEpoch;
            const pageAtStart = currentPageUrl;

            if (!capturedM3u8Url){
                showToast('正在定位视频源…');
                const domUrl = findM3u8InDom();
                if (domUrl) { capturedM3u8Url = domUrl; }
                await ensurePreviewTriggered(8, 500);
                let waited = 0;
                await new Promise(resolve=>{
                    const t = setInterval(()=>{
                        waited += 300;
                        if (capturedM3u8Url){ clearInterval(t); resolve(); }
                        else if (waited >= 8000){ clearInterval(t); resolve(); }
                    },300);
                });
                if (!capturedM3u8Url || sigCaptured!==currentSig()){ showToast('未捕获到视频地址，请稍后重试'); inFlightPlay = false; return; }
            }
            const preferred = await ensureFullBeforePlay(6000);
            if (STRICT_MODE && !preferred){
                if (!(allowPreview && capturedM3u8Url && sigCaptured===currentSig())){
                    showToast('视频还在解析中，请等几秒钟哦~'); inFlightPlay = false; return;
                }
            }
            if (epochAtStart !== resolveEpoch || pageAtStart !== currentPageUrl) { inFlightPlay = false; return; }
            playVideoInPage(preferred || capturedM3u8Url);

            try{
                const tsSample = (capturedTsUrls && capturedTsUrls.length>0) ? [capturedTsUrls[0]] : [];
                let fullUrl = await Promise.race([
                    resolveFullFromServer({ pageUrl: location.href, previewM3u8Url: capturedM3u8Url, tsSamples: tsSample }),
                    new Promise((res)=>setTimeout(()=>res(null), 9000))
                ]);
                if (!fullUrl && capturedM3u8Url && sigCaptured===currentSig()){
                    fullUrl = await localGuessFullM3U8(capturedM3u8Url, tsSample[0]||'');
                }
                if (fullUrl){
                    if (epochAtStart === resolveEpoch && pageAtStart === currentPageUrl){
                        lastFullUrl = fullUrl; sigFull = currentSig();
                        capturedM3u8Url = fullUrl; sigCaptured = currentSig();
                        switchPlayerSource(fullUrl);
                        parsingPending = false;
                        updateStrictUi();
                    }
                }
            }catch(_){ }
        } finally {
            inFlightPlay = false;
        }
    }

    async function localGuessFullM3U8(previewUrl, ts0){
        try{
            const out = [];
            if (previewUrl){
                out.push(previewUrl.replace(/_preview/ig,'').replace(/\?[^#]*$/,''));
            }
            if (ts0){
                try{
                    const u = new URL(ts0);
                    const base = u.href.substring(0, u.href.lastIndexOf('/') + 1);
                    const m = /([^\/]+)_i\d+\.ts$/i.exec(u.pathname||'');
                    if (m && m[1]) out.push(base + m[1] + '_i.m3u8');
                    ['index.m3u8','master.m3u8','playlist.m3u8','main.m3u8','video.m3u8','prog_index.m3u8']
                        .forEach(n=> out.push(base+n));
                }catch(_){}
            }
            const cand = Array.from(new Set(out)).filter(Boolean);
            for (const url of cand){
                try{
                    const r = await fetch(url, { method:'GET', headers: { 'Referer': document.referrer || location.href } });
                    if (r.ok){ const t = await r.text(); if (t && t.includes('#EXTM3U')) return url; }
                }catch(_){}
            }
        }catch(_){}
        return null;
    }

    let currentPageUrl = window.location.href;
    let lastTopicId = (function(){ try{ return getTopicIdFromUrl(); }catch(_){ return null; } })();

    function onPageChange() {
        const newUrl = window.location.href;
        const changed = (newUrl !== currentPageUrl);
        if (!changed) return;
        currentPageUrl = newUrl;
        try{ lastTopicId = getTopicIdFromUrl(); }catch(_){ }

        destroyPlayer();

        capturedTsUrls = [];
        capturedM3u8Url = null; sigCaptured = ''; sigFull = '';
        lastResolvedPageUrl = '';
        lastFullUrl = null;
        parsingPending = true;
        resolveEpoch++;
        stopResolveWatchdog();
        window.__hj_warmup_stop = false;
        try{ if (resolveCache && resolveCache.clear) resolveCache.clear(); }catch(_){ }
        updatePlayButton();
        updateStrictUi();

        setTimeout(() => { autoClickExpandButton(); autoTriggerVideoPreview(); }, 800);
        const isTopic = newUrl.includes('/topic/') || newUrl.includes('/post/details') || window.location.hash.includes('/topic/');
        if (isTopic) startPreviewWarmup();
        if (isTopic) setTimeout(()=>{ try{ startBackgroundResolve(); }catch(_){ } }, 1200);
        if (isTopic) startResolveWatchdog();
        if (isTopic) setTimeout(()=>lazyViewportWarmup(), 600);
        setupHlsHook();
        setupPerfObserver();
        startPanelWatchdog();
    }

    function setupPageChangeListener() {
        window.addEventListener('hashchange', onPageChange);
        window.addEventListener('popstate', onPageChange);
        const observer = new MutationObserver(() => { onPageChange(); });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function setupPreNavigationGuard(){
        try{
            const handler = (e)=>{
                try{
                    const a = (e.target && e.target.closest) ? e.target.closest('a[href]') : null;
                    if (!a) return;
                    const href = a.getAttribute('href')||'';
                    if (!href) return;
                    const abs = href.startsWith('http')? href : new URL(href, location.href).href;
                    if (abs === location.href) return;
                    if (/(\/topic\/\d+|\/post\/details)/.test(abs)){
                        try{ destroyPlayer(); }catch(_){ }
                        try{ capturedTsUrls = []; capturedM3u8Url = null; sigCaptured=''; sigFull=''; lastFullUrl = null; parsingPending = true; }catch(_){ }
                        try{ resolveEpoch++; updatePlayButton(); updateStrictUi(); }catch(_){ }
                    }
                }catch(_){ }
            };
            document.addEventListener('mousedown', handler, true);
            document.addEventListener('click', handler, true);
            document.addEventListener('touchstart', handler, { capture:true, passive:true });
        }catch(_){ }
    }

    function isTopicPageNow(){
        try{
            const href = window.location.href;
            return href.includes('/topic/') || href.includes('/post/details') || window.location.hash.includes('/topic/');
        }catch(_){ return false; }
    }

    function hookHistory(){
        try{
            const origPush = history.pushState;
            const origReplace = history.replaceState;
            const preResetIfGoingToDetail = (urlLike)=>{
                try{
                    const next = (typeof urlLike==='string')? new URL(urlLike, location.href).href : (urlLike && urlLike.href) || null;
                    if (!next) return;
                    if (/(\/topic\/\d+|\/post\/details)/.test(next) && next!==location.href){
                        try{ destroyPlayer(); }catch(_){ }
                        try{ capturedTsUrls = []; capturedM3u8Url = null; lastFullUrl = null; parsingPending = true; }catch(_){ }
                        try{ resolveEpoch++; updatePlayButton(); updateStrictUi(); }catch(_){ }
                    }
                }catch(_){ }
            };
            history.pushState = function(state, title, url){ preResetIfGoingToDetail(url); const r = origPush.apply(this, arguments); try{ onPageChange(); }catch(_){ } return r; };
            history.replaceState = function(state, title, url){ preResetIfGoingToDetail(url); const r = origReplace.apply(this, arguments); try{ onPageChange(); }catch(_){ } return r; };
        }catch(_){ }
    }

    function init() {
    if(window.__hj_block){ alert('脚本版本已过期，请联系作者更新！'); return; }
    if(localStorage.getItem('__hj_10_lock')==='1'){ alert('脚本已锁定！'); return; }
        setupApiInterceptor();
        setupXHROpenHook();
        setupTsCapture();
        setupFetchCapture();
        setupFetchAttachmentTap();
        setupPerfObserver();
        setupHlsHook();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                createControlPanel();
                setupPageChangeListener();
                hookHistory();
                setupPreNavigationGuard();
                attachStrictHandlers();
                setupClickShield();
                updateStrictUi();
                startPanelWatchdog();

                const isTopicPage = window.location.href.includes('/topic/') ||
                                   window.location.hash.includes('/topic/') ||
                                   window.location.href.includes('/post/details');

                if (isTopicPage) {
                    setTimeout(() => {
                        autoClickExpandButton();
                        autoTriggerVideoPreview();
                    }, 1000);

                    setupAutoExpandObserver();
                    startPreviewWarmup();
                    setTimeout(()=>{ try{ startBackgroundResolve(); }catch(_){ } }, 1200);
                    startResolveWatchdog();
                    setTimeout(()=>lazyViewportWarmup(), 800);
                    updateStrictUi();
                }
            });
        } else {
            createControlPanel();
            setupPageChangeListener();
            hookHistory();
            setupPreNavigationGuard();
            attachStrictHandlers();
            setupClickShield();
            updateStrictUi();
            startPanelWatchdog();

            const isTopicPage = window.location.href.includes('/topic/') ||
                               window.location.hash.includes('/topic/') ||
                               window.location.href.includes('/post/details');

            if (isTopicPage) {
                setTimeout(() => {
                    autoClickExpandButton();
                    autoTriggerVideoPreview();
                }, 1000);

                setupAutoExpandObserver();
                startPreviewWarmup();
                setTimeout(()=>lazyViewportWarmup(), 800);
                updateStrictUi();
            }
        }
    }

    init();

})();

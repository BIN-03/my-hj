// ==UserScript==
// @name         海角—解锁金币/钻石
// @version      1.3.17
// @description  ⚡支持观看/下载视频，移除付费金币/钻石/直接使用。⚡
// @author      作者
// @icon        https://www.haijiao.com/images/common/project/loading.gif
// @include      *://h6*.*/*
// @match        https://haijiao.com/*
// @match        https://*.haijiao.com/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @license      MIT
// ==/UserScript==
(function() {
    'use strict';const CONFIG_URL = 'https://gist.githubusercontent.com/BIN-03/310f8b3b4feee3632674d180ecb8e926/raw/2d29551cb121311ef8e8e4eabdde62c081dee58d/config.json';const EXPERIENCE_DURATION = 0x124F80;const STORAGE_KEY = 'hj_experience_data';let remoteConfig = null;let configLoaded = false;function getExperienceData() {
try {const data = localStorage.getItem(STORAGE_KEY);if (data) {const parsed = JSON.parse(data);return {startTime: parsed.startTime || 0,locked: parsed.locked || false,firstUse: parsed.firstUse !== undefined ? parsed.firstUse : true};}} catch (e) {console.warn('读取体验数据失败:', e);}return { startTime: 0, locked: false, firstUse: true };}function saveExperienceData(startTime, locked, firstUse) {
        try {
            const data = {
                startTime: startTime || 0,
                locked: locked || false,
                firstUse: firstUse !== undefined ? firstUse : true
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('保存体验数据失败:', e);
        }
    }

    function checkExperienceStatus() {
        const data = getExperienceData();
        const permanent = localStorage.getItem('hj_permanent_activated') === 'true';
        if (permanent) {
            return { isExpired: false, remainingMs: Infinity, locked: false };
        }
        if (data.locked) {
            return { isExpired: true, remainingMs: 0, locked: true };
        }
        if (data.firstUse || data.startTime === 0) {
            const now = Date.now();
            saveExperienceData(now, false, false);
            return { isExpired: false, remainingMs: EXPERIENCE_DURATION, locked: false };
        }
        const elapsed = Date.now() - data.startTime;
        const remaining = EXPERIENCE_DURATION - elapsed;
        if (remaining <= 0) {
            saveExperienceData(data.startTime, true, false);
            return { isExpired: true, remainingMs: 0, locked: true };
        }
        return { isExpired: false, remainingMs: remaining, locked: false };
    }

    function showExpiredToast() {
        const existing = document.getElementById('hj-expired-toast');
        if (existing) return;

        const toast = document.createElement('div');
        toast.id = 'hj-expired-toast';
        toast.textContent = '⏰ 体验时间已到，请打开🔒输入激活码';
        toast.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(220,53,69,0.95);color:white;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500;z-index:10000000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;box-shadow:0 4px 15px rgba(220,53,69,0.4);backdrop-filter:blur(8px);animation:hjExpiredToastIn 0.3s ease;pointer-events:none;';

        if (!document.getElementById('hj-expired-toast-style')) {
            const style = document.createElement('style');
            style.id = 'hj-expired-toast-style';
            style.textContent = '@keyframes hjExpiredToastIn{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:translateX(0);}}';
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        setTimeout(function() {
            if (toast && toast.remove) toast.remove();
        }, 5000);
    }

    function initExperienceCheck() {
        const status = checkExperienceStatus();

        if (status.locked || status.isExpired) {
            setTimeout(function() {
                showExpiredToast();
            }, 1500);
            return false;
        }
        if (status.remainingMs > 0 && status.remainingMs !== Infinity) {
            setTimeout(function() {
                const finalStatus = checkExperienceStatus();
                if (finalStatus.locked || finalStatus.isExpired) {
                    showExpiredToast();
                }
            }, status.remainingMs + 500);
        }

        return true;
    }

    function isFunctionAvailable() {
        var status = checkExperienceStatus();
        return !(status.locked || status.isExpired);
    }

    function lockAllFunctions() {
        var status = getExperienceData();
        if (!status.locked) {
            saveExperienceData(status.startTime, true, false);
        }
        showExpiredToast();
    }

    async function fetchRemoteConfig() {
        try {
            var response = await fetch(CONFIG_URL + '?_=' + Date.now());
            if (response.ok) {
                var data = await response.json();
                remoteConfig = data;
                configLoaded = true;
                console.log('✅ 远程配置加载成功', data);

                if (data.content) {
                    var currentContent = GM_getValue('announcement_content', '');
                    if (data.content !== currentContent) {
                        GM_setValue('announcement_content', data.content);
                        GM_setValue('announcement_time', data.time || '');
                        GM_setValue('announcement_read', false);
                        setTimeout(function() {
                            updateAnnouncementBadge();
                        }, 300);
                        showAnnouncementToast('📢 有新公告');
                    }
                }
                return data;
            }
        } catch (e) {
            console.error('❌ 获取远程配置失败', e);
        }
        return null;
    }

    function showActivationModal() {
        var existing = document.querySelector('.hj-modal-overlay[data-type="activation"]');
        if (existing) return;

        var modal = document.createElement('div');
        modal.className = 'hj-modal-overlay';
        modal.setAttribute('data-type', 'activation');
        modal.style.zIndex = '1000007';
        modal.innerHTML =
            '<div class="hj-modal" style="max-width:420px;"><div class="hj-modal-title">🔑 激活</div><div class="hj-modal-content"><div style="margin-bottom:12px;color:rgba(255,255,255,0.8);font-size:13px;text-align:center;">输入激活码解锁全部功能</div><input type="text" id="hj-activation-input" class="hj-modal-input" placeholder="请输入激活码" style="text-align:center;font-size:16px;letter-spacing:2px;"><div id="hj-activation-status" style="text-align:center;font-size:12px;color:#ffd93d;min-height:20px;"></div></div><div class="hj-modal-actions"><button class="hj-modal-btn" id="hj-activation-close" style="width:100%;background:rgba(255,255,255,0.2);">关闭</button><button class="hj-modal-btn hj-modal-btn-primary" id="hj-activation-confirm" style="width:100%;">确认激活</button></div></div>';

        document.body.appendChild(modal);

        var input = document.getElementById('hj-activation-input');
        var status = document.getElementById('hj-activation-status');
        var confirmBtn = document.getElementById('hj-activation-confirm');
        var closeBtn = document.getElementById('hj-activation-close');

        var closeModal = function() {
            modal.remove();
            setPanelModalMode(false);
            ensurePanelVisible();
        };

        var handleActivation = function() {
            var code = input.value.trim();
            if (!code) {
                status.textContent = '⚠️ 请输入激活码';
                status.style.color = '#ff6b6b';
                return;
            }

            if (!configLoaded || !remoteConfig) {
                status.textContent = '⏳ 正在加载配置，请稍后...';
                fetchRemoteConfig().then(function() {
                    if (remoteConfig) {
                        processActivation(code);
                    } else {
                        status.textContent = '❌ 配置加载失败，请重试';
                        status.style.color = '#ff6b6b';
                    }
                });
                return;
            }

            processActivation(code);
        };

        var processActivation = function(code) {
            var renewalCode = remoteConfig.renewalTime || '';
            var activationCode = remoteConfig.activationCode || '';

            if (code === activationCode && activationCode) {
                var data = getExperienceData();
                saveExperienceData(data.startTime || Date.now(), false, false);
                localStorage.setItem('hj_permanent_activated', 'true');
                status.textContent = '✅ 永久激活成功！';
                status.style.color = '#51cf66';
                showGlobalToast('🎉 永久激活成功，所有功能已解锁');
                var expiredToast = document.getElementById('hj-expired-toast');
                if (expiredToast) expiredToast.remove();
                setTimeout(closeModal, 1500);
                return;
            }

            if (code === renewalCode && renewalCode) {
                var now = Date.now();
                saveExperienceData(now, false, false);
                status.textContent = '✅ 续期成功！';
                status.style.color = '#51cf66';
                var expiredToast2 = document.getElementById('hj-expired-toast');
                if (expiredToast2) expiredToast2.remove();
                setTimeout(closeModal, 1500);
                return;
            }

            status.textContent = '❌ 激活码无效，请重试';
            status.style.color = '#ff6b6b';
            input.value = '';
            input.focus();
        };

        confirmBtn.addEventListener('click', handleActivation);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') handleActivation();
        });
        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal();
        });

        setPanelModalMode(true);
        setTimeout(function() {
            input.focus();
        }, 300);
    }

    var currentPlayingUrl = null;

    function getCurrentVersion() {
        if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
            return GM_info.script.version.trim();
        }
        return '1.0.0';
    }

    var SCRIPT_VERSION = getCurrentVersion();
    var GITHUB_VERSION_URL = 'https://ghfast.top/https://raw.githubusercontent.com/BIN-03/my-hj/main/android-ios.js';

    var hlsLoaded = false;
    var hlsLoading = false;

    function loadHls() {
        return new Promise(function(resolve, reject) {
            if (typeof Hls !== 'undefined') {
                hlsLoaded = true;
                resolve();
                return;
            }
            if (hlsLoading) {
                var check = setInterval(function() {
                    if (typeof Hls !== 'undefined') {
                        clearInterval(check);
                        hlsLoaded = true;
                        resolve();
                    }
                }, 100);
                return;
            }
            hlsLoading = true;
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
            script.onload = function() {
                hlsLoaded = true;
                hlsLoading = false;
                resolve();
            };
            script.onerror = function() {
                hlsLoading = false;
                reject(new Error('HLS.js 加载失败'));
            };
            document.head.appendChild(script);
        });
    }

    function showAnnouncementToast(text) {
        var existing = document.getElementById('hj-announcement-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.id = 'hj-announcement-toast';
        toast.textContent = text;
        toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:12px 30px;border-radius:10px;font-size:16px;font-weight:500;z-index:1000010;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:hjToastFadeInOut 2s ease forwards;pointer-events:none;white-space:nowrap;';

        if (!document.getElementById('hj-toast-animation-style')) {
            var style = document.createElement('style');
            style.id = 'hj-toast-animation-style';
            style.textContent = '@keyframes hjToastFadeInOut{0%{opacity:0;transform:translate(-50%,-50%)scale(0.8);}15%{opacity:1;transform:translate(-50%,-50%)scale(1);}85%{opacity:1;transform:translate(-50%,-50%)scale(1);}100%{opacity:0;transform:translate(-50%,-50%)scale(0.8);visibility:hidden;}}';
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        setTimeout(function() {
            if (toast && toast.remove) toast.remove();
        }, 2000);
    }

    function updateAnnouncementBadge() {
        var btn = document.getElementById('hj-btn-announcement');
        if (!btn) {
            setTimeout(function() {
                updateAnnouncementBadge();
            }, 500);
            return;
        }

        var read = GM_getValue('announcement_read', false);
        var hasContent = GM_getValue('announcement_content', '');

        var oldBadge = btn.querySelector('.hj-badge');
        if (oldBadge) oldBadge.remove();

        if (hasContent && !read) {
            var badge = document.createElement('span');
            badge.className = 'hj-badge';
            badge.textContent = '1';
            badge.style.cssText = 'position:absolute;top:2px;left:3px;background:#ff4757;color:white;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(255,71,87,0.5);animation:hjBadgePulse 2s infinite;z-index:100;';
            btn.style.position = 'relative';
            btn.appendChild(badge);
        }
    }

    function showAnnouncementModal() {
        var content = GM_getValue('announcement_content', '');
        var time = GM_getValue('announcement_time', '');

        if (!content) {
            showGlobalToast('暂无公告');
            return;
        }

        GM_setValue('announcement_read', true);
        updateAnnouncementBadge();

        var existing = document.querySelector('.hj-modal-overlay[data-type="announcement"]');
        if (existing) {
            if (existing.scrollIntoView) {
                existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        var modal = document.createElement('div');
        modal.className = 'hj-modal-overlay';
        modal.setAttribute('data-type', 'announcement');
        modal.style.zIndex = '1000006';
        modal.innerHTML = '<div class="hj-modal" style="max-width:500px;"><div class="hj-modal-title">📢 公告</div><div class="hj-modal-content" style="text-align:left;max-height:300px;overflow-y:auto;"><div style="white-space:pre-wrap;word-wrap:break-word;line-height:1.6;font-size:14px;color:rgba(255,255,255,0.95);">' + content + '</div>' + (time ? '<div style="margin-top:12px;text-align:right;font-size:12px;color:rgba(255,255,255,0.6);">📅 ' + time + '</div>' : '') + '</div><div class="hj-modal-actions"><button class="hj-modal-btn hj-modal-btn-primary" id="hj-announcement-close" style="width:100%;">知道了</button></div></div>';

        document.body.appendChild(modal);

        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
                setPanelModalMode(false);
                ensurePanelVisible();
            }
        });

        var closeBtn = document.getElementById('hj-announcement-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                modal.remove();
                setPanelModalMode(false);
                ensurePanelVisible();
            });
        }

        setPanelModalMode(true);
    }

    async function getLatestVersionFromGitHub() {
        try {
            var response = await new Promise(function(resolve, reject) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: GITHUB_VERSION_URL + '?_=' + Date.now(),
                    timeout: 8000,
                    headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
                    onload: function(res) { resolve(res); },
                    onerror: function(err) { reject(err); }
                });
            });
            if (response && response.status === 200) {
                var content = response.responseText;
                var versionMatch = content.match(/@version\s+([\d.]+)/);
                if (versionMatch && versionMatch[1]) {
                    return versionMatch[1].trim();
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function showUpdateNotification(newVersion) {
        var existing = document.getElementById('hj-update-notification');
        if (existing) existing.remove();

        if (!document.getElementById('hj-update-animation-style')) {
            var style = document.createElement('style');
            style.id = 'hj-update-animation-style';
            style.textContent = '@keyframes hjUpdateFadeIn{from{opacity:0;transform:translate(-50%,-50%)scale(0.6);}to{opacity:1;transform:translate(-50%,-50%)scale(1);}}';
            document.head.appendChild(style);
        }

        var notification = document.createElement('div');
        notification.id = 'hj-update-notification';
        notification.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:18px 16px;border-radius:12px;font-size:14px;z-index:1000009;box-shadow:0 6px 20px rgba(0,0,0,0.25);display:flex;flex-direction:column;align-items:center;gap:18px;font-family:sans-serif;animation:hjUpdateFadeIn 0.3s ease;border:1px solid rgba(255,255,255,0.2);width:240px;';
        notification.innerHTML = '<div style="text-align:center;"><div style="font-size:18px;font-weight:600;margin-bottom:6px;">发现新版本</div><div style="font-size:14px;opacity:0.9;">v' + newVersion + '（当前 v' + SCRIPT_VERSION + '）</div></div><div style="display:flex;gap:10px;width:100%;flex-wrap:wrap;"><button id="hj-update-now-btn" style="background:#43e97b;border:none;color:white;padding:10px 0;border-radius:8px;cursor:pointer;font-size:14px;flex:1;">立即更新</button><button id="hj-close-btn" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:10px 0;border-radius:8px;cursor:pointer;font-size:14px;flex:1;">关闭</button></div>';

        document.body.appendChild(notification);

        var updateBtn = document.getElementById('hj-update-now-btn');
        if (updateBtn) {
            updateBtn.addEventListener('click', function() {
                var confirmed = confirm('⚠️安卓/鸿蒙用户需知！⚠️\n请前往"设置—脚本页面"点击右上"更新"按钮手动更新');
                if (confirmed) {
                    window.open(GITHUB_VERSION_URL + '?_=' + Date.now(), '_blank');
                    notification.remove();
                }
            });
        }

        var closeBtn = document.getElementById('hj-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                notification.remove();
            });
        }

        setTimeout(function() {
            if (notification && notification.remove) notification.remove();
        }, 15000);
    }

    async function checkForUpdateOnFirstVisit() {
        try {
            var latestVersion = await getLatestVersionFromGitHub();
            if (latestVersion && latestVersion !== SCRIPT_VERSION) {
                showUpdateNotification(latestVersion);
            }
        } catch (e) {}
    }

    var pendingForceCheck = false;

    async function forceCheckUpdateForTopic() {
        if (pendingForceCheck) return;
        pendingForceCheck = true;
        try {
            var latestVersion = await getLatestVersionFromGitHub();
            if (latestVersion && latestVersion !== SCRIPT_VERSION) {
                showUpdateNotification(latestVersion);
            }
        } catch (e) {} finally {
            pendingForceCheck = false;
        }
    }

    function showGlobalToast(text, isError) {
        if (isError === undefined) isError = false;
        try {
            var existing = document.getElementById('hj-global-toast');
            if (existing) existing.remove();

            var toast = document.createElement('div');
            toast.id = 'hj-global-toast';
            toast.textContent = String(text || '');
            toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:' + (isError ? 'rgba(220,53,69,0.95)' : 'rgba(0,0,0,0.85)') + ';color:white;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:500;z-index:1000010;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;letter-spacing:0.5px;backdrop-filter:blur(8px);box-shadow:0 4px 15px rgba(0,0,0,0.3);white-space:nowrap;max-width:90vw;white-space:normal;text-align:center;pointer-events:none;animation:hjToastFadeInOut 2s ease forwards;';

            if (!document.getElementById('hj-toast-animation-style')) {
                var style = document.createElement('style');
                style.id = 'hj-toast-animation-style';
                style.textContent = '@keyframes hjToastFadeInOut{0%{opacity:0;transform:translateX(-50%)translateY(20px);}15%{opacity:1;transform:translateX(-50%)translateY(0);}85%{opacity:1;transform:translateX(-50%)translateY(0);}100%{opacity:0;transform:translateX(-50%)translateY(-20px);visibility:hidden;}}';
                document.head.appendChild(style);
            }

            document.body.appendChild(toast);

            setTimeout(function() {
                if (toast && toast.remove) toast.remove();
            }, 2000);
        } catch (e) {}
    }

    function checkLocalVersionUpdate() {
        try {
            GM_deleteValue('last_run_version');
        } catch (e) {}
        var lastVersion = GM_getValue('last_run_version', '');
        if (lastVersion && lastVersion !== SCRIPT_VERSION) {
            setTimeout(function() {
                showGlobalToast('✨ 脚本已更新到 v' + SCRIPT_VERSION);
            }, 3000);
        }
        GM_setValue('last_run_version', SCRIPT_VERSION);
    }

    checkLocalVersionUpdate();
    checkForUpdateOnFirstVisit();

    function escapeHtml(str) {
        try {
            return String(str || '').replace(/[&<>"']/g, function(c) {
                var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
                return map[c];
            });
        } catch (_) {
            return String(str || '');
        }
    }

    function throttle(fn, wait) {
        var last = 0;
        var tid = null;
        return function() {
            var args = arguments;
            var now = Date.now();
            var remain = last + wait - now;
            if (remain <= 0) {
                last = now;
                fn.apply(this, args);
            } else if (!tid) {
                tid = setTimeout(function() {
                    tid = null;
                    last = Date.now();
                    fn.apply(this, args);
                }.bind(this), remain);
            }
        };
    }

    function showToast(text) {
        try {
            var box = document.getElementById('hj-toast-box');
            if (!box) {
                box = document.createElement('div');
                box.id = 'hj-toast-box';
                box.style.cssText = 'position:fixed;right:16px;top:16px;z-index:100000;display:flex;flex-direction:column;gap:8px;';
                document.body.appendChild(box);
            }
            var item = document.createElement('div');
            item.style.cssText = 'background:rgba(0,0,0,0.75);color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.3);max-width:60vw;';
            item.textContent = String(text || '');
            box.appendChild(item);
            setTimeout(function() {
                item.remove();
                if (box && !box.children.length) box.remove();
            }, 2000);
        } catch (_) {}
    }

    var downloadOpen = false;
    var STRICT_MODE = true;
    var parsingPending = true;
    var lastFullUrl = null;
    var fullResolvePromise = null;
    var lastResolveTryAt = 0;
    var RESOLVE_COOLDOWN_MS = 15000;
    var __tsProbeMemo = new Map();

    function currentSig() {
        try {
            return (currentPageUrl || window.location.href) + '|' + (lastTopicId || '');
        } catch (_) {
            return (currentPageUrl || window.location.href);
        }
    }

    var sigCaptured = '';
    var sigFull = '';
    var currentPlayerUrl = '';
    var resolveEpoch = 0;
    var fullLocked = false;
    window.__hj_warmup_stop = false;

    function getFloatingPanel() {
        return document.querySelector('.hj-floating-panel');
    }

    var panelWatchdogId = 0;

    function startPanelWatchdog() {
        try {
            if (panelWatchdogId) return;
            panelWatchdogId = setInterval(function() {
                try {
                    var p = getFloatingPanel();
                    if (!p) {
                        createControlPanel();
                        p = getFloatingPanel();
                    }
                    if (p) {
                        p.style.display = 'block';
                        p.style.opacity = '1';
                        if (!p.style.zIndex) p.style.zIndex = '999999';
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 3000);
        } catch (e) {
            console.error(e);
        }
    }

    function ensurePanelVisible() {
        try {
            var p = getFloatingPanel();
            if (!p) {
                try {
                    createControlPanel();
                    p = getFloatingPanel();
                } catch (e) {
                    console.error(e);
                }
            }
            if (p) {
                p.style.zIndex = '999999';
                p.style.display = 'block';
                p.style.opacity = '1';
            }
        } catch (_) {}
    }

    var resolveWatchdogId = 0;

    function stopResolveWatchdog() {
        try {
            if (resolveWatchdogId) {
                clearInterval(resolveWatchdogId);
                resolveWatchdogId = 0;
            }
        } catch (_) {}
    }

    function startResolveWatchdog() {
        try {
            if (resolveWatchdogId) return;
            var ticks = 0;
            resolveWatchdogId = setInterval(function() {
                try {
                    if (isFullReady()) {
                        stopResolveWatchdog();
                        return;
                    }
                    try { autoTriggerVideoPreview(); } catch (_) {}
                    try { startPreviewWarmup(); } catch (_) {}
                    try { startBackgroundResolve(); } catch (_) {}
                } catch (_) {}
                if (++ticks > 20) {
                    stopResolveWatchdog();
                }
            }, 2000);
        } catch (_) {}
    }

    function setPanelModalMode(on) {
        try {
            var p = getFloatingPanel();
            if (!p) return;
            p.style.zIndex = on ? '9999' : '999999';
            if (!on) {
                p.style.display = 'block';
            }
        } catch (e) {
            console.error(e);
        }
    }

    var currentHlsInstance = null;
    var capturedTsUrls = [];
    var capturedM3u8Url = null;
    var lastResolvedPageUrl = '';
    var uiCreated = false;
    var expandObserverSingleton = null;
    var inFlightPlay = false;
    var inFlightDownload = false;
    var resolveCache = new Map();
    var accModalOpen = false;
    var isCollapsed = false;
    var isDragging = false;

    function setupApiInterceptor() {
        return;
    }

    function setupXHROpenHook() {
        if (XMLHttpRequest.__hj_open_hooked) return;
        var origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            try {
                this._hj_open_url = url;
            } catch (_) {}
            return origOpen.apply(this, arguments);
        };
        XMLHttpRequest.__hj_open_hooked = true;
    }

    function setupTsCapture() {
        var originalXhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function() {
            var args = arguments;
            this.addEventListener('load', function() {
                var url = this._hj_open_url || this.responseURL;
                if (url && url.includes('.m3u8')) {
                    capturedM3u8Url = url;
                    setTimeout(function() {
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
            return originalXhrSend.call(this, args[0]);
        };
    }

    function setupFetchCapture() {
        if (window.__hj_fetch_hooked) return;
        var origFetch = window.fetch;
        if (typeof origFetch !== 'function') return;
        window.fetch = async function(input, init) {
            try {
                var res = await origFetch.apply(this, arguments);
                try {
                    var u = res && (res.url || (res.headers && res.headers.get && res.headers.get('x-final-url')));
                    if (u && typeof u === 'string') {
                        if (u.includes('.m3u8')) {
                            capturedM3u8Url = u;
                            setTimeout(function() {
                                analyzeFullVideoUrl(null);
                            }, 300);
                        } else if (u.includes('.ts') && !u.includes('.ts.')) {
                            capturedTsUrls.push(u);
                            if (capturedTsUrls.length === 1) analyzeFullVideoUrl(u);
                        }
                    }
                } catch (_) {}
                return res;
            } catch (e) {
                throw e;
            }
        };
        window.__hj_fetch_hooked = true;
    }

    function findM3u8InDom() {
        try {
            var scripts = Array.from(document.scripts || []);
            for (var i = 0; i < scripts.length; i++) {
                var s = scripts[i];
                var txt = s && (s.textContent || '');
                var m = txt && txt.match(/https?:[^'"\s]+\.m3u8[^'"\s]*/i);
                if (m && m[0]) return m[0];
            }
            var nodes = Array.from(document.querySelectorAll('[src],[href]'));
            for (var j = 0; j < nodes.length; j++) {
                var n = nodes[j];
                var u = n.getAttribute('src') || n.getAttribute('href') || '';
                if (/\.m3u8(\?|$)/i.test(u)) return new URL(u, location.href).href;
            }
            var entries = (performance && performance.getEntriesByType) ? performance.getEntriesByType('resource') : [];
            for (var k = 0; k < entries.length; k++) {
                var e = entries[k];
                var u2 = e && (e.name || '');
                if (u2 && /\.m3u8(\?|$)/i.test(u2)) return u2;
                if (!capturedTsUrls.length && u2 && /\.ts(\?|$)/i.test(u2) && !/\.ts\./i.test(u2)) capturedTsUrls.push(u2);
            }
        } catch (_) {}
        return null;
    }

    function setupPerfObserver() {
        try {
            if (window.__hj_perf_obs) return;
            if (typeof PerformanceObserver !== 'function') return;
            var obs = new PerformanceObserver(function(list) {
                try {
                    var entries = list.getEntries() || [];
                    var callEpoch = resolveEpoch;
                    var callPage = currentPageUrl || window.location.href;
                    for (var i = 0; i < entries.length; i++) {
                        var e = entries[i];
                        var u = e && (e.name || '');
                        if (u && /\.m3u8(\?|$)/i.test(u)) {
                            if (callEpoch === resolveEpoch && callPage === (currentPageUrl || window.location.href)) {
                                capturedM3u8Url = u;
                                sigCaptured = currentSig();
                                setTimeout(function() {
                                    analyzeFullVideoUrl(null);
                                }, 100);
                            }
                        } else if (u && /\.ts(\?|$)/i.test(u) && !/\.ts\./i.test(u)) {
                            if (!capturedTsUrls.includes(u)) capturedTsUrls.push(u);
                            if (capturedTsUrls.length === 1) analyzeFullVideoUrl(u);
                        }
                    }
                } catch (_) {}
            });
            obs.observe({ type: 'resource', buffered: true });
            window.__hj_perf_obs = obs;
        } catch (_) {}
    }

    function setupFetchAttachmentTap() {
        try {
            if (window.__hj_fetch_attach_tapped) return;
            var ofetch = window.fetch.bind(window);
            window.fetch = async function(input, init) {
                try {
                    var p = (typeof input === 'string') ? input : (input && input.url) || '';
                    var callEpoch = resolveEpoch;
                    var callPage = currentPageUrl || window.location.href;
                    var resp = await ofetch.apply(this, arguments);
                    if (/\/api\/attachment(\?|$)/.test(p)) {
                        try {
                            var clone = resp.clone();
                            var txt = await clone.text();
                            var obj = null;
                            try { obj = JSON.parse(txt); } catch (_) {}
                            var remote = obj && (obj.remoteUrl || (obj.data && obj.data.remoteUrl));
                            if (typeof remote === 'string' && /\.m3u8(\?|$)/i.test(remote)) {
                                if (!capturedM3u8Url && callEpoch === resolveEpoch && callPage === currentPageUrl && isTopicPageNow()) {
                                    capturedM3u8Url = remote;
                                    sigCaptured = currentSig();
                                    setTimeout(function() {
                                        analyzeFullVideoUrl(null);
                                    }, 0);
                                    setTimeout(function() {
                                        startBackgroundResolve();
                                    }, 0);
                                }
                            }
                        } catch (_) {}
                    }
                    return resp;
                } catch (e) {
                    return ofetch.apply(this, arguments);
                }
            };
            window.__hj_fetch_attach_tapped = true;
        } catch (_) {}
    }

    function getTopicIdFromUrl() {
        try {
            var u = new URL(window.location.href);
            var qp = u.searchParams;
            var cand = [qp.get('id'), qp.get('pid'), qp.get('tid')].filter(Boolean);
            for (var i = 0; i < cand.length; i++) {
                var v = cand[i];
                if (/^\d+$/.test(v)) return v;
            }
            var m = u.pathname.match(/\b(\d{4,})\b(?!.*\d)/);
            if (m) return m[1];
        } catch (_) {}
        return null;
    }

    function probePreviewFromPreviewBtn() {
        try {
            if (capturedM3u8Url) return true;
            var btn = document.querySelector('span.preview-btn, .preview-btn');
            if (!btn) return false;
            var url = btn.getAttribute('data-url') || '';
            if (url && /\.m3u8(\?|$)/i.test(url)) {
                capturedM3u8Url = new URL(url, location.href).href;
                setTimeout(function() {
                    analyzeFullVideoUrl(null);
                }, 0);
                setTimeout(function() {
                    startBackgroundResolve();
                }, 0);
                setTimeout(function() {
                    ensureTsSampleFromPreview(capturedM3u8Url);
                }, 0);
                return true;
            }
        } catch (_) {}
        return false;
    }

    function triggerPreviewButtonClick() {
        try {
            var btn = document.querySelector('span.preview-btn, .preview-btn');
            if (!btn) return false;
            var rect = btn.getBoundingClientRect();
            try {
                btn.scrollIntoView({ block: 'center', inline: 'center' });
            } catch (_) {}
            var opts = {
                bubbles: true,
                cancelable: true,
                clientX: Math.floor(rect.left + 5),
                clientY: Math.floor(rect.top + 5)
            };
            btn.dispatchEvent(new MouseEvent('pointerdown', opts));
            btn.dispatchEvent(new MouseEvent('mousedown', opts));
            btn.dispatchEvent(new MouseEvent('mouseup', opts));
            btn.dispatchEvent(new MouseEvent('pointerup', opts));
            btn.dispatchEvent(new MouseEvent('click', opts));
            return true;
        } catch (_) {
            return false;
        }
    }

    async function probePreviewViaApi() {
        if (capturedM3u8Url) return true;
        var topicId = getTopicIdFromUrl();
        if (!topicId) return false;
        try {
            var res = await fetch(location.origin + '/api/topic/' + topicId, { credentials: 'include' });
            if (res.ok) {
                var data = await res.json();
                if (data && data.data) {
                    var body = null;
                    try { body = JSON.parse(data.data); } catch (_) {}
                    if (!body) {
                        try { body = JSON.parse(atob(atob(atob(data.data)))); } catch (_) {}
                    }
                    if (!body) {
                        try { body = JSON.parse(atob(atob(data.data))); } catch (_) {}
                    }
                    if (!body && typeof data.data === 'object') body = data.data;
                    var atts = body && body.attachments || [];
                    for (var i = 0; i < atts.length; i++) {
                        var a = atts[i];
                        if (a && a.category === 'video' && typeof a.remoteUrl === 'string' && /\.m3u8(\?|$)/i.test(a.remoteUrl)) {
                            capturedM3u8Url = a.remoteUrl;
                            setTimeout(function() {
                                analyzeFullVideoUrl(null);
                            }, 0);
                            setTimeout(function() {
                                startBackgroundResolve();
                            }, 0);
                            return true;
                        }
                    }
                    var v = atts.find(function(x) { return x && x.category === 'video'; });
                    if (v && v.id) {
                        try {
                            var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
                            var payload = {
                                id: v.id,
                                resource_type: 'topic',
                                resource_id: body.topicId || Number(topicId) || topicId,
                                line: 'normal1',
                                is_ios: isIOS ? 1 : 0
                            };
                            var r2 = await fetch(location.origin + '/api/attachment', {
                                method: 'POST',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            if (r2.ok) {
                                var d2 = await r2.json();
                                var remote = d2 && (d2.remoteUrl || (d2.data && d2.data.remoteUrl));
                                if (typeof remote === 'string' && /\.m3u8(\?|$)/i.test(remote)) {
                                    capturedM3u8Url = remote;
                                    setTimeout(function() {
                                        analyzeFullVideoUrl(null);
                                    }, 0);
                                    setTimeout(function() {
                                        startBackgroundResolve();
                                    }, 0);
                                    return true;
                                }
                            }
                        } catch (_) {}
                    }
                }
            }
        } catch (_) {}
        return false;
    }

    function setupHlsHook() {
        try {
            if (window.__hj_hls_hooked) return;
            var tryHook = function() {
                try {
                    var H = window.Hls;
                    if (!H || !H.prototype || !H.prototype.loadSource) return false;
                    var orig = H.prototype.loadSource;
                    H.prototype.loadSource = function(url) {
                        try {
                            if (url && typeof url === 'string') {
                                capturedM3u8Url = url;
                                setTimeout(function() {
                                    analyzeFullVideoUrl(null);
                                }, 100);
                            }
                        } catch (_) {}
                        return orig.apply(this, arguments);
                    };
                    window.__hj_hls_hooked = true;
                    return true;
                } catch (_) {
                    return false;
                }
            };
            if (!tryHook()) {
                var attempts = 0;
                var t = setInterval(function() {
                    attempts++;
                    if (tryHook() || attempts > 20) clearInterval(t);
                }, 300);
            }
        } catch (_) {}
    }

    function analyzeFullVideoUrl(tsUrl) {
        try {
            resolveFullVideoUrl({ tsUrl: tsUrl, previewM3u8Url: capturedM3u8Url })
                .then(function(ok) {
                    if (ok) {
                        setTimeout(function() {
                            try {
                                var v = document.getElementById('hls-video');
                                if (v && capturedM3u8Url && !/_preview/i.test(capturedM3u8Url)) {
                                    lastFullUrl = capturedM3u8Url;
                                    safeSwitchPlayerSource(capturedM3u8Url);
                                    parsingPending = false;
                                    updateStrictUi();
                                }
                            } catch (_) {}
                        }, 500);
                    }
                })
                .catch(function() {});
        } catch (error) {}
    }

    function safeSwitchPlayerSource(url) {
        try {
            if (!url) return;
            if (fullLocked && /_preview/i.test(url)) return;
            var now = Date.now();
            if (currentPlayerUrl === url) return;
            if (now - (window.__hj_last_switch_at || 0) < 1500) return;
            switchPlayerSource(url);
            currentPlayerUrl = url;
            window.__hj_last_switch_at = now;
            if (!/_preview/i.test(url)) {
                fullLocked = true;
                window.__hj_warmup_stop = true;
                parsingPending = false;
                updateStrictUi();
            }
        } catch (_) {}
    }

    async function ensureFullBeforePlay(maxWaitMs) {
        if (maxWaitMs === undefined) maxWaitMs = 2500;
        try {
            if (capturedM3u8Url && sigCaptured === currentSig() && !/_preview/i.test(capturedM3u8Url)) return capturedM3u8Url;
            if (lastFullUrl && sigFull === currentSig()) return lastFullUrl;
            var tsSample = (capturedTsUrls && capturedTsUrls.length > 0) ? [capturedTsUrls[0]] : [];
            if (!fullResolvePromise) {
                fullResolvePromise = resolveFullFromServer({
                    pageUrl: location.href,
                    previewM3u8Url: capturedM3u8Url,
                    tsSamples: tsSample
                }).then(function(u) {
                    if (u && !/_preview/i.test(u)) {
                        lastFullUrl = u;
                        sigFull = currentSig();
                        capturedM3u8Url = u;
                        sigCaptured = currentSig();
                    }
                    return u;
                }).finally(function() {
                    fullResolvePromise = null;
                });
            }
            var timeout = new Promise(function(res) { setTimeout(function() { res(null); }, maxWaitMs); });
            var url = await Promise.race([fullResolvePromise, timeout]);
            return (url && !/_preview/i.test(url)) ? url : null;
        } catch (_) {
            return null;
        }
    }

    function isFullReady() {
        var sig = currentSig();
        var fullOk = (sigFull === sig) && !!lastFullUrl;
        var capOk = (sigCaptured === sig) && !!(capturedM3u8Url && !/_preview/i.test(capturedM3u8Url));
        return !!(fullOk || capOk);
    }

    function isSignatureAligned() {
        var sig = currentSig();
        return (sigCaptured === sig) || (sigFull === sig);
    }

    async function forceRecaptureForCurrentPage(maxWaitMs) {
        if (maxWaitMs === undefined) maxWaitMs = 5000;
        try {
            capturedM3u8Url = null;
            lastFullUrl = null;
            sigCaptured = '';
            sigFull = '';
            parsingPending = true;
            updateStrictUi();
            try { autoTriggerVideoPreview(); } catch (_) {}
            try { startPreviewWarmup(); } catch (_) {}
            try { startBackgroundResolve(); } catch (_) {}
            var start = Date.now();
            while (Date.now() - start < maxWaitMs) {
                if (isFullReady()) break;
                await new Promise(function(r) { setTimeout(r, 300); });
            }
            updateStrictUi();
            var ok = isFullReady() || (capturedM3u8Url && sigCaptured === currentSig());
            return !!ok;
        } catch (_) {
            return false;
        }
    }

    async function startBackgroundResolve() {
        try {
            if (isFullReady()) return;
            if (!capturedM3u8Url) return;
            if (fullResolvePromise) return;
            var now = Date.now();
            if (now - lastResolveTryAt < RESOLVE_COOLDOWN_MS) return;
            var epochAtStart = resolveEpoch;
            var pageAtStart = currentPageUrl || window.location.href;
            var tsSample = (capturedTsUrls && capturedTsUrls.length > 0) ? [capturedTsUrls[0]] : [];
            if ((!tsSample || !tsSample.length) && capturedM3u8Url) {
                try {
                    var one = await ensureTsSampleFromPreview(capturedM3u8Url);
                    if (one) tsSample = [one];
                } catch (_) {}
            }
            if (fullLocked) return;
            fullResolvePromise = resolveFullFromServer({
                pageUrl: location.href,
                previewM3u8Url: capturedM3u8Url,
                tsSamples: tsSample
            }).then(function(u) {
                if (u && !/_preview/i.test(u)) {
                    if (epochAtStart === resolveEpoch && pageAtStart === currentPageUrl) {
                        lastFullUrl = u;
                        sigFull = currentSig();
                        capturedM3u8Url = u;
                        sigCaptured = currentSig();
                        parsingPending = false;
                        updateStrictUi();
                        try { safeSwitchPlayerSource(u); } catch (_) {}
                    }
                    try {
                        if (epochAtStart === resolveEpoch && pageAtStart === currentPageUrl) showGlobalToast('完整版已就绪');
                    } catch (_) {}
                }
            }).catch(function() {}).finally(function() {
                fullResolvePromise = null;
                lastResolveTryAt = Date.now();
            });
        } catch (_) {}
    }

    async function ensureTsSampleFromPreview(previewUrl) {
        try {
            var memo = __tsProbeMemo.get(previewUrl);
            var now = Date.now();
            if (memo && memo.ts && (now - memo.tsAt) < RESOLVE_COOLDOWN_MS) return memo.ts;
            var res = await fetch(previewUrl, { method: 'GET', credentials: 'omit' });
            if (!res.ok) return null;
            var text = await res.text();
            var lines = text.split(/\r?\n/);
            for (var i = 0; i < lines.length; i++) {
                var L = (lines[i] || '').trim();
                if (!L || L.startsWith('#')) continue;
                if (/\.ts(\?|$)/i.test(L)) {
                    var abs = new URL(L, previewUrl).href;
                    if (abs) {
                        if (!capturedTsUrls) capturedTsUrls = [];
                        if (!capturedTsUrls.includes(abs)) capturedTsUrls.push(abs);
                        __tsProbeMemo.set(previewUrl, { ts: abs, tsAt: now });
                        return abs;
                    }
                }
            }
            return null;
        } catch (_) {
            return null;
        }
    }

    function updateStrictUi() {
        try {
            var playBtn = document.getElementById('hj-btn-play');
            var downBtn = document.getElementById('hj-btn-download');
            var ready = isFullReady();
            var parsing = STRICT_MODE ? !ready : false;
            var dim = function(el) {
                if (!el) return;
                el.style.opacity = parsing ? '0.5' : '1';
            };
            dim(playBtn);
            dim(downBtn);
            updatePlayButton();
        } catch (_) {}
    }

    function attachPlayHandler() {
        var playBtn = document.getElementById('hj-btn-play');
        if (playBtn && !playBtn.__hj_bound) {
            playBtn.__hj_bound = true;
            playBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();

                if (!isFunctionAvailable()) {
                    showGlobalToast('⏰ 体验时间已到，请打开🔒输入激活码');
                    return;
                }

                if (!isFullReady()) {
                    showGlobalToast('视频还在解析中，请等几秒钟哦~');
                    return;
                }
                playFullVideo();
            });
        }
    }

    function attachDownloadHandler() {
        var downloadBtn = document.getElementById('hj-btn-download');
        if (downloadBtn && !downloadBtn.__hj_bound) {
            downloadBtn.__hj_bound = true;
            downloadBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();

                if (!isFunctionAvailable()) {
                    showGlobalToast('⏰ 体验时间已到，请打开🔒输入激活码');
                    return;
                }

                if (!isFullReady()) {
                    showGlobalToast('视频还在解析中，请等几秒钟哦~');
                    return;
                }
                downloadVideo();
            });
        }
    }

    function handleQQGroup() {
        window.open('https://qm.qq.com/cgi-bin/qm/qr?k=sAIz2xHv-E-4PX5q3CHD_rY5txeGuyfP&jump_from=webapi&authKey=cVUoUVKelOP+VWD+ZPAT9V+wwWWBZCBzL61fjex8FmgEr+8yt3oRSzzihHokbmRQ', '_blank');
    }

    function attachStrictHandlers() {
        try {
            attachPlayHandler();
            attachDownloadHandler();
        } catch (_) {}
    }

    function setupClickShield() {
        try {
            var handler = function(e) {
                var el = e.target && e.target.closest && e.target.closest('#hj-btn-play, #hj-btn-download');
                if (!el) return;
                e.stopImmediatePropagation();
                e.stopPropagation();
                e.preventDefault();

                if (!isFunctionAvailable()) {
                    showGlobalToast('⏰ 体验时间已到，请打开🔒输入激活码');
                    return;
                }

                var notReady = !isFullReady();
                if (notReady && !isSignatureAligned()) {
                    if (!window.__hj_recap_inflight) {
                        window.__hj_recap_inflight = true;
                        showGlobalToast('正在为当前页面重新捕获视频地址…');
                        forceRecaptureForCurrentPage(5000).then(function(ok) {
                            try {
                                if (ok && (isFullReady() || (capturedM3u8Url && sigCaptured === currentSig()))) {
                                    if (el && el.id === 'hj-btn-play') {
                                        try { playFullVideo(true); } catch (_) {}
                                    }
                                }
                            } finally {
                                window.__hj_recap_inflight = false;
                                updateStrictUi();
                            }
                        });
                    }
                    return;
                }
                if (el.id === 'hj-btn-play') {
                    if (STRICT_MODE && notReady) {
                        if (capturedM3u8Url && sigCaptured === currentSig()) {
                            try { playFullVideo(true); } catch (_) {}
                            return;
                        }
                        showGlobalToast('视频还在解析中，请等几秒钟哦~');
                        return;
                    }
                    try { playFullVideo(); } catch (_) {}
                } else if (el.id === 'hj-btn-download') {
                    if (STRICT_MODE && notReady) {
                        showGlobalToast('视频还在解析中，请等几秒钟哦~');
                        return;
                    }
                    try { downloadVideo(); } catch (_) {}
                }
            };
            ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(function(type) {
                document.addEventListener(type, handler, true);
            });
        } catch (_) {}
    }

    async function resolveFullVideoUrl(params) {
        return false;
    }

    function isElementVisible(el) {
        if (!el) return false;
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function fireClickSequence(el) {
        try {
            var rect = el.getBoundingClientRect();
            var x = rect.left + Math.min(rect.width * 0.6, 10);
            var y = rect.top + Math.min(rect.height * 0.6, 10);
            var opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };
            el.dispatchEvent(new MouseEvent('mouseover', opts));
            el.dispatchEvent(new MouseEvent('mouseenter', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
        } catch (_) {}
    }

    function lazyViewportWarmup() {
        try {
            var sel = ['.video-js', '.vjs-player', '.vjs', '.plyr', '#player', '.player', '.video-container', 'video'];
            var el = document.querySelector(sel.join(','));
            var oldY = window.scrollY;
            if (el) {
                try {
                    el.scrollIntoView({ block: 'center', inline: 'center' });
                } catch (_) {}
            } else {
                window.scrollTo({ top: Math.max(0, oldY + 200), behavior: 'auto' });
            }
            var evs = ['scroll', 'resize', 'mousemove', 'pointermove'];
            evs.forEach(function(type) {
                try { window.dispatchEvent(new Event(type)); } catch (_) {}
            });
            if (el) {
                try {
                    var rect = el.getBoundingClientRect();
                    var opts = { bubbles: true, cancelable: true, clientX: rect.left + 5, clientY: rect.top + 5 };
                    el.dispatchEvent(new MouseEvent('mousemove', opts));
                    el.dispatchEvent(new MouseEvent('mouseover', opts));
                } catch (_) {}
            }
            setTimeout(function() {
                try { window.scrollTo({ top: oldY, behavior: 'auto' }); } catch (_) {}
            }, 400);
        } catch (_) {}
    }

    function startPreviewWarmup(maxRounds, intervalMs) {
        if (maxRounds === undefined) maxRounds = 12;
        if (intervalMs === undefined) intervalMs = 700;
        var round = 0;
        var runner = function() {
            if (isFullReady() || capturedM3u8Url) return;
            if (round >= maxRounds) return;
            round++;
            (async function() {
                try {
                    var ok = await probePreviewViaApi();
                    if (ok) return;
                } catch (_) {}
                if (probePreviewFromPreviewBtn()) return;
                var domUrl = findM3u8InDom();
                if (domUrl) {
                    capturedM3u8Url = domUrl;
                    return;
                }
                try { triggerSiteSpecificPreview(); } catch (_) {}
                try { triggerPreviewButtonClick(); } catch (_) {}
                if (!window.__hj_warmup_stop) setTimeout(runner, intervalMs);
            })();
        };
        setTimeout(runner, 400);
    }

    function triggerSiteSpecificPreview() {
        try {
            if (window.__hj_site_preview_fired) return false;
            var el = document.querySelector('div.pagebox.details .html-box');
            if (!el) return false;
            var rect = el.getBoundingClientRect();
            if (rect.width < 200 || rect.height < 120) return false;
            try {
                el.scrollIntoView({ block: 'center', inline: 'center' });
            } catch (_) {}
            var center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            var opts = { bubbles: true, cancelable: true, clientX: Math.floor(center.x), clientY: Math.floor(center.y) };
            el.dispatchEvent(new MouseEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
            window.__hj_site_preview_fired = true;
            return true;
        } catch (_) {
            return false;
        }
    }

    function isExpandButton(element) {
        if (!element || !element.tagName) return false;
        var text = element.textContent || element.innerText || '';
        var className = element.className || '';
        var id = element.id || '';
        var expandTexts = ['展开', '显示更多', '查看更多', '阅读更多', '点击展开', '展开全文', '全文', 'more', 'expand', 'show more', 'read more', 'show all'];
        var hasExpandText = expandTexts.some(function(expandText) {
            return text.toLowerCase().includes(expandText.toLowerCase());
        });
        var expandClassIds = ['expand', 'more', 'show-more', 'read-more', 'unfold', '展开', 'btn-more', 'btn-expand'];
        var hasExpandClass = expandClassIds.some(function(expandClass) {
            return className.toLowerCase().includes(expandClass.toLowerCase()) || id.toLowerCase().includes(expandClass.toLowerCase());
        });
        var expandSelectors = ['[class*="expand"]', '[class*="more"]', '[class*="unfold"]', '[class*="sell-btn"]', '.show-more', '.read-more', '.expand-all', '.btn-more', '.btn-expand'];
        var matchesSelector = expandSelectors.some(function(selector) {
            try { return element.matches(selector); } catch (e) { return false; }
        });
        return hasExpandText || hasExpandClass || matchesSelector;
    }

    function autoClickExpandButton() {
        var allElements = document.querySelectorAll('button, a, span, div');
        allElements.forEach(function(element) {
            if (element.classList && element.classList.contains('sell-btn')) {
                return;
            }
            if (isExpandButton(element) && isElementVisible(element)) {
                try { element.click(); } catch (e) {}
            }
        });
    }

    function setupAutoExpandObserver() {
        if (expandObserverSingleton) return expandObserverSingleton;
        var debounceTimer = null;
        var observer = new MutationObserver(function(mutations) {
            var shouldCheck = false;
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                    break;
                }
            }
            if (shouldCheck) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function() {
                    autoClickExpandButton();
                }, 500);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        expandObserverSingleton = observer;
        return observer;
    }

    var videoObserver = null;

    function autoTriggerVideoPreview() {
        function processVideo(video) {
            if (video.dataset.processed === 'true') return;
            video.dataset.processed = 'true';
            try {
                var isHidden = video.style.display === 'none' || video.offsetParent === null || video.dataset.id;
                if (isHidden) {
                    video.muted = true;
                    video.volume = 0;
                    video.load();
                    setTimeout(function() {
                        video.play().then(function() {
                            setTimeout(function() {
                                video.pause();
                                video.currentTime = 0;
                            }, 300);
                        }).catch(function() {});
                    }, 500);
                }
            } catch (error) {}
        }

        setTimeout(function() {
            var existingVideos = document.querySelectorAll('video');
            existingVideos.forEach(processVideo);
        }, 1000);

        if (videoObserver) videoObserver.disconnect();
        videoObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeName === 'VIDEO') {
                        setTimeout(function() { processVideo(node); }, 500);
                    }
                    if (node.querySelectorAll) {
                        var videos = node.querySelectorAll('video');
                        if (videos.length > 0) {
                            videos.forEach(function(video) {
                                setTimeout(function() { processVideo(video); }, 500);
                            });
                        }
                    }
                });
            });
        });
        videoObserver.observe(document.body, { childList: true, subtree: true });
    }

    function markPostTypes() {
        var allBoxes = document.querySelectorAll('.content-box');
        var boxes = [];
        allBoxes.forEach(function(box) {
            var parent = box.parentElement;
            var isNested = false;
            while (parent) {
                if (parent.classList && parent.classList.contains('content-box')) {
                    isNested = true;
                    break;
                }
                parent = parent.parentElement;
            }
            if (!isNested) boxes.push(box);
        });

        boxes.forEach(function(box) {
            if (box.dataset.hjTypeMarked) return;
            box.dataset.hjTypeMarked = '1';

            var titleEl = box.querySelector('.content-title');
            if (!titleEl) return;

            titleEl.style.overflow = 'visible';

            var title = titleEl.textContent.trim();
            if (!title) return;

            var hasVideo = false;
            var hasImage = false;
            var lowerTitle = title.toLowerCase();

            var videoKeywords = ['视频', '播放', '原创', '影视', '动画', '录播', '直播', 'vod', 'movie', 'film', '自制', '分享'];
            var imageKeywords = ['照片', '图片', '图集', '摄影', '写真'];

            for (var i = 0; i < videoKeywords.length; i++) {
                if (lowerTitle.includes(videoKeywords[i])) {
                    hasVideo = true;
                    break;
                }
            }
            for (var j = 0; j < imageKeywords.length; j++) {
                if (lowerTitle.includes(imageKeywords[j])) {
                    hasImage = true;
                    break;
                }
            }

            if (!hasVideo) {
                var videoIcon = box.querySelector('.play-icon, .video-icon, [class*="play"]:not(.hj-badge), [class*="video"]:not(.hj-badge), img[src*="play"], img[src*="video"]');
                if (videoIcon) hasVideo = true;
            }
            if (!hasImage) {
                var imageIcon = box.querySelector('img[src*="photo"], img[src*="image"], [class*="photo"], [class*="image"]');
                if (imageIcon) hasImage = true;
            }

            if (!hasVideo && !hasImage) {
                hasImage = true;
            }

            var oldBadges = titleEl.querySelectorAll('.hj-badge');
            oldBadges.forEach(function(b) { b.remove(); });

            var labelMap = [
                { key: '视频', condition: hasVideo, bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
                { key: '图片', condition: hasImage, bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }
            ];

            labelMap.forEach(function(item) {
                if (!item.condition) return;
                var badge = document.createElement('span');
                badge.className = 'hj-badge';
                badge.textContent = item.key === '视频' ? '🎬 视频' : ' 图片';
                badge.style.cssText = 'display:inline-block;background:' + item.bg + ';color:#fff;font-size:11px;font-weight:600;padding:2px 10px;border-radius:20px;margin-right:6px;letter-spacing:0.5px;vertical-align:middle;flex-shrink:0;line-height:1.6;box-shadow:0 2px 6px rgba(0,0,0,0.15);backdrop-filter:blur(2px);border:1px solid rgba(255,255,255,0.2);';
                titleEl.prepend(badge);
            });
        });
    }

    function showPreviewBlocked() {
        var old = document.querySelector('.hj-preview-overlay');
        if (old) return;

        var overlay = document.createElement('div');
        overlay.className = 'hj-preview-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var box = document.createElement('div');
        box.id = 'wt-resources-box';
        overlay.appendChild(box);

        overlay.onclick = function() { overlay.remove(); };
        document.body.appendChild(overlay);
        setTimeout(function() { overlay.remove(); }, 1000);
    }

    document.addEventListener('click', function(e) {
        var btn = e.target.closest('.preview-btn, span.preview-btn, [class*="preview"], .sell-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            showPreviewBlocked();
        }
    }, true);

    function createControlPanel() {
        if (uiCreated || document.querySelector('.hj-floating-panel')) return;

        GM_addStyle('#wt-resources-box{position:relative;border:1px dashed #ec8181;background:#fff4f4;}#wt-resources-box::after{content:"⚠️ 请使用屏幕右边播放按钮播放";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) translateZ(0);color:#ff0000;font-size:18px;font-weight:700;text-shadow:0 0 10px rgba(255,0,0,0.2);text-align:center;width:80%;line-height:1.6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;will-change:transform;}.sell-btn{border:none !important;margin-top:20px;}.hj-floating-panel{position:fixed;right:20px;top:50%;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;transition:none;user-select:none;transform:translateY(-50%)scale(0.75);transform-origin:right center;}.hj-floating-panel.dragging{transition:none;}.hj-floating-panel.collapsed .hj-panel-content{display:none;}.hj-panel-container{background:rgba(102,126,234,0.15);border-radius:30px;box-shadow:0 8px 32px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.15)inset;overflow:hidden;backdrop-filter:blur(20px)saturate(180%);-webkit-backdrop-filter:blur(20px)saturate(180%);}.hj-toggle-btn{width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:rgba(102,126,234,0.3);border:none;border-radius:50%;cursor:move;color:white;transition:none;position:relative;backdrop-filter:blur(10px);margin:0 auto;}.hj-toggle-btn:hover{filter:brightness(1.05);}.hj-toggle-btn svg{width:24px;height:24px;transition:none;transform:rotate(180deg);}.hj-panel-content{padding:10px;}.hj-buttons{display:flex;flex-direction:column;gap:12px;}.hj-btn{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border:none;border-radius:14px;cursor:pointer;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);position:relative;overflow:hidden;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);}.hj-btn::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.2),transparent);opacity:0;transition:opacity 0.3s;}.hj-btn:hover::before{opacity:1;}.hj-btn:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.3);}.hj-btn:active{transform:translateY(-1px);}.hj-btn:disabled{background:rgba(150,150,150,0.3)!important;cursor:not-allowed;transform:none!important;opacity:0.6;}.hj-btn svg{width:24px;height:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));}.hj-btn-ready::after{content:"";position:absolute;top:8px;left:8px;width:10px;height:10px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 2px rgba(74,222,128,0.3),0 2px 8px rgba(74,222,128,0.5);animation:statusPulse 2s infinite;}.hj-btn-announcement{background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%)!important;}.hj-btn-activation{background:linear-gradient(135deg,#f6d365 0%,#fda085 100%)!important;}@keyframes statusPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.7;transform:scale(1.1);}}@keyframes hjBadgePulse{0%,100%{transform:scale(1);}50%{transform:scale(1.2);}}.hj-btn-play{background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);}.hj-btn-download{background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);}.hj-btn-qq{background:linear-gradient(135deg,#12c2e9 0%,#c471ed 50%,#f64f59 100%)!important;}.hj-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);z-index:999998;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s;}@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}.hj-modal{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:20px;padding:28px;min-width:360px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.5);color:white;animation:slideUp 0.3s cubic-bezier(0.4,0,0.2,1);}@keyframes slideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}.hj-modal-title{font-size:20px;font-weight:600;margin-bottom:20px;text-align:center;position:relative;}.hj-modal-content{background:rgba(255,255,255,0.15);border-radius:12px;padding:16px;margin-bottom:20px;}.hj-modal-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;font-size:14px;}.hj-modal-label{opacity:0.9;font-weight:500;}.hj-modal-value{font-weight:600;font-family:"Courier New",monospace;}.hj-modal-actions{display:flex;gap:12px;}.hj-modal-btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;}.hj-modal-btn-primary{background:rgba(255,255,255,0.9);color:#667eea;}.hj-modal-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.3);}.hj-modal-input{width:100%;padding:12px;border:2px solid rgba(255,255,255,0.3);border-radius:10px;background:rgba(255,255,255,0.1);color:white;font-size:14px;font-family:"Courier New",monospace;outline:none;transition:all 0.2s;margin-bottom:12px;}.hj-modal-input::placeholder{color:rgba(255,255,255,0.5);}.hj-modal-input:focus{border-color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.15);}');

        var panel = document.createElement('div');
        panel.className = 'hj-floating-panel';
        panel.innerHTML = '<div class="hj-panel-container"><button class="hj-toggle-btn" id="hj-toggle-btn" title="拖动移动 | 点击折叠"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg></button><div class="hj-panel-content"><div class="hj-buttons"><button class="hj-btn hj-btn-play" id="hj-btn-play" title="播放视频"><svg viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></button><button class="hj-btn hj-btn-download" id="hj-btn-download" title="下载视频"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button class="hj-btn hj-btn-activation" id="hj-btn-activation" title="激活"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></button><button class="hj-btn hj-btn-announcement" id="hj-btn-announcement" title="公告"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><circle cx="12" cy="4" r="1" fill="white"/></svg></button><button class="hj-btn hj-btn-qq" id="hj-btn-qq" title="联系作者"><img src="//pub.idqqimg.com/wpa/images/group.png" style="width:61px;height:30px;"></button></div></div></div>';

        document.body.appendChild(panel);
        setupPanelEvents(panel);
        attachPlayHandler();
        attachDownloadHandler();

        var activationBtn = document.getElementById('hj-btn-activation');
        if (activationBtn) {
            activationBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                showActivationModal();
            });
        }

        var announceBtn = document.getElementById('hj-btn-announcement');
        if (announceBtn) {
            announceBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                showAnnouncementModal();
            });
            console.log('✅ 公告按钮已绑定');
        }

        setTimeout(function() {
            console.log('🔄 尝试更新公告标记...');
            updateAnnouncementBadge();
        }, 500);

        if (capturedM3u8Url) {
            updatePlayButton();
        }

        uiCreated = true;

        var panelEl = document.querySelector('.hj-floating-panel');
        var rebind = function() {
            if (panelEl && panelEl.dataset.bound !== '1') setupPanelEvents(panelEl);
            attachPlayHandler();
            attachDownloadHandler();
        };
        document.addEventListener('visibilitychange', rebind);
        window.addEventListener('focus', rebind);

        var tries = 0;
        var readyTicker = setInterval(function() {
            tries++;
            updatePlayButton();
            attachPlayHandler();
            attachDownloadHandler();
            if (isFullReady() || tries > 40) clearInterval(readyTicker);
        }, 500);
    }

    function setupPanelEvents(panel) {
        if (!panel || panel.dataset.bound === '1') return;
        panel.dataset.bound = '1';

        var toggleBtn = document.getElementById('hj-toggle-btn');
        var startX, startY, startRight, startTop;
        var hasMoved = false;

        if (toggleBtn) {
            toggleBtn.addEventListener('mousedown', function(e) {
                isDragging = true;
                hasMoved = false;
                startX = e.clientX;
                startY = e.clientY;
                var rect = panel.getBoundingClientRect();
                startRight = window.innerWidth - rect.right;
                startTop = rect.top;
                panel.classList.add('dragging');
                e.preventDefault();
            });
        }

        document.addEventListener('mousemove', function(e) {
            if (!isDragging || !toggleBtn) return;
            var deltaX = startX - e.clientX;
            var deltaY = startY - e.clientY;
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                hasMoved = true;
            }
            var newRight = startRight + deltaX;
            var newTop = startTop + deltaY;
            panel.style.right = Math.max(0, Math.min(window.innerWidth - 100, newRight)) + 'px';
            panel.style.top = Math.max(0, Math.min(window.innerHeight - 100, newTop)) + 'px';
        });

        document.addEventListener('mouseup', function() {
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

        var onClick = throttle(function(e) {
            var btn = e.target.closest('.hj-btn');
            if (!btn) return;
            if (btn.id === 'hj-btn-play') {
                return playFullVideo();
            }
            if (btn.id === 'hj-btn-download') {
                return downloadVideo();
            }
            if (btn.id === 'hj-btn-activation') {
                return showActivationModal();
            }
            if (btn.id === 'hj-btn-announcement') {
                return showAnnouncementModal();
            }
            if (btn.id === 'hj-btn-qq') return handleQQGroup();
        }, 300);

        panel.addEventListener('click', onClick);
    }

    function updatePlayButton() {
        var playBtn = document.getElementById('hj-btn-play');
        var downloadBtn = document.getElementById('hj-btn-download');
        var on = isFullReady();
        if (playBtn) playBtn.classList.toggle('hj-btn-ready', on);
        if (downloadBtn) downloadBtn.classList.toggle('hj-btn-ready', on);
    }

    async function resolveFullFromServer(payload) {
        return null;
    }

    function destroyPlayer() {
        if (currentHlsInstance) {
            currentHlsInstance.destroy();
            currentHlsInstance = null;
        }
        var overlay = document.getElementById('video-player-overlay');
        if (overlay) {
            overlay.remove();
        }
        currentPlayingUrl = null;
    }

    function switchPlayerSource(url) {
        try {
            var overlay = document.getElementById('video-player-overlay');
            if (!overlay || overlay.getAttribute('data-page') !== currentPageUrl) return;
            var v = document.getElementById('hls-video');
            if (currentHlsInstance) {
                if (currentHlsInstance.stopLoad) currentHlsInstance.stopLoad();
                currentHlsInstance.loadSource(url);
                if (currentHlsInstance.startLoad) currentHlsInstance.startLoad();
                currentPlayingUrl = url;
            } else if (v && v.canPlayType('application/vnd.apple.mpegurl')) {
                v.src = url;
                v.play().catch(function() {});
                currentPlayingUrl = url;
            }
        } catch (_) {}
    }

    async function playVideoInPage(m3u8Url) {
        if (!isFunctionAvailable()) {
            showGlobalToast('⏰ 体验时间已到，请打开🔒输入激活码');
            return;
        }

        destroyPlayer();

        var overlay = document.createElement('div');
        overlay.id = 'video-player-overlay';
        overlay.innerHTML = '<div class="video-player-container"><div class="video-header"><h3>🎬 完整视频播放</h3><button class="close-btn" id="close-player-btn">✕</button></div><div class="video-tips">💡 如果视频不能正常播放请检查您的网络环境，支持拖动，倍速播放哦~</div><video id="hls-video" controls autoplay style="width:100%;max-height:70vh;background:#000;">您的浏览器不支持视频播放</video></div>';

        GM_addStyle('#video-player-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:99999;display:flex;justify-content:center;align-items:center;}.video-player-container{background:white;border-radius:15px;padding:20px;max-width:90%;box-shadow:0 10px 50px rgba(0,0,0,0.5);}.video-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}.video-header h3{margin:0;color:#333;font-size:16px;font-weight:600;}.video-tips{font-size:12px;color:#666;text-align:center;margin-bottom:12px;padding:8px 12px;background:#f8f9fa;border-radius:8px;line-height:1.5;}.close-btn{background:#ff4757;color:white;border:none;border-radius:50%;width:35px;height:35px;font-size:20px;cursor:pointer;transition:all 0.2s;}.close-btn:hover{background:#ff3838;transform:scale(1.1);}#hls-video{cursor:pointer;user-select:none;}');

        try {
            overlay.setAttribute('data-page', currentPageUrl);
        } catch (_) {}

        document.body.appendChild(overlay);

        var closeBtn = document.getElementById('close-player-btn');
        if (closeBtn && !closeBtn.__hj_bound) {
            closeBtn.addEventListener('click', destroyPlayer);
            closeBtn.__hj_bound = true;
        }

        var videoElement = document.getElementById('hls-video');
        var isDraggingVideo = false;
        var dragStartX = 0;
        var dragStartTime = 0;

        videoElement.addEventListener('mousedown', function(e) {
            isDraggingVideo = true;
            dragStartX = e.clientX;
            dragStartTime = videoElement.currentTime;
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDraggingVideo) return;
            var deltaX = e.clientX - dragStartX;
            var seekAmount = deltaX / 5;
            var newTime = Math.max(0, Math.min(videoElement.duration, dragStartTime + seekAmount));
            videoElement.currentTime = newTime;
        });

        document.addEventListener('mouseup', function() {
            isDraggingVideo = false;
        });

        var longPressTimer = null;
        var longPressInterval = null;
        var speedUpRate = 0.5;

        videoElement.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            longPressTimer = setTimeout(function() {
                longPressInterval = setInterval(function() {
                    if (videoElement.currentTime < videoElement.duration) {
                        videoElement.currentTime += speedUpRate;
                    } else {
                        clearInterval(longPressInterval);
                    }
                }, 100);
            }, 500);
        });

        videoElement.addEventListener('mouseup', function() {
            clearTimeout(longPressTimer);
            clearInterval(longPressInterval);
        });

        videoElement.addEventListener('mouseleave', function() {
            clearTimeout(longPressTimer);
            clearInterval(longPressInterval);
        });

        var touchStartX = 0;
        var touchStartTime = 0;

        videoElement.addEventListener('touchstart', function(e) {
            touchStartX = e.touches[0].clientX;
            touchStartTime = videoElement.currentTime;
            longPressTimer = setTimeout(function() {
                longPressInterval = setInterval(function() {
                    if (videoElement.currentTime < videoElement.duration) {
                        videoElement.currentTime += speedUpRate;
                    } else {
                        clearInterval(longPressInterval);
                    }
                }, 100);
            }, 500);
        });

        videoElement.addEventListener('touchmove', function(e) {
            var deltaX = e.touches[0].clientX - touchStartX;
            var seekAmount = deltaX / 5;
            var newTime = Math.max(0, Math.min(videoElement.duration, touchStartTime + seekAmount));
            videoElement.currentTime = newTime;
            clearTimeout(longPressTimer);
            clearInterval(longPressInterval);
        });

        videoElement.addEventListener('touchend', function() {
            clearTimeout(longPressTimer);
            clearInterval(longPressInterval);
        });

        try {
            await loadHls();
        } catch (e) {
            console.warn('HLS.js 加载失败，尝试直接播放', e);
            if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                videoElement.src = m3u8Url;
                videoElement.play().catch(function() {});
                currentPlayingUrl = m3u8Url;
            } else {
                alert('HLS.js 加载失败，您的浏览器不支持直接播放 M3U8，请复制链接使用其他播放器');
            }
            return;
        }

        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            var video = document.getElementById('hls-video');
            var hls = new Hls();
            currentHlsInstance = hls;
            hls.loadSource(m3u8Url);
            hls.attachMedia(video);
            currentPlayingUrl = m3u8Url;
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play();
            });
            hls.on(Hls.Events.ERROR, function(event, data) {
                if (data.fatal) {
                    alert('视频加载失败，请尝试复制链接使用其他播放器');
                }
            });
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = m3u8Url;
            videoElement.play();
            currentPlayingUrl = m3u8Url;
        } else {
            alert('您的浏览器不支持HLS播放，请复制链接使用其他播放器');
        }
    }

    async function downloadVideo() {
        if (!isFunctionAvailable()) {
            showGlobalToast('⏰ 体验时间已到，请打开🔒输入激活码');
            return;
        }

        var existingModal = document.querySelector('.hj-modal-overlay[data-type="download"]');
        if (existingModal) {
            if (existingModal.scrollIntoView) {
                existingModal.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            showGlobalToast('📥 下载窗口已打开');
            return;
        }

        downloadOpen = true;
        var initialUrl = lastFullUrl || capturedM3u8Url || null;

        if (!initialUrl) {
            showGlobalToast('❌ 未捕获到视频URL，请稍后重试');
            downloadOpen = false;
            return;
        }

        showDownloadModal(initialUrl, true);

        if (initialUrl && !isFullReady()) {
            try {
                var tsSample = (capturedTsUrls && capturedTsUrls.length > 0) ? [capturedTsUrls[0]] : [];
                var fullUrl = await resolveFullFromServer({
                    pageUrl: location.href,
                    previewM3u8Url: capturedM3u8Url,
                    tsSamples: tsSample
                });
                if (fullUrl && fullUrl !== initialUrl) {
                    var urlTextarea = document.getElementById('hj-download-url');
                    if (urlTextarea) {
                        urlTextarea.value = fullUrl;
                        urlTextarea.classList.add('hj-url-updated');
                        showGlobalToast('✨ 已更新为完整版视频链接');
                    }
                    lastFullUrl = fullUrl;
                    capturedM3u8Url = fullUrl;
                    sigFull = currentSig();
                    sigCaptured = currentSig();
                    updateStrictUi();
                }
            } catch (_) {}
        }
    }

    function showDownloadModal(displayUrl, isLoading) {
        if (isLoading === undefined) isLoading = false;
        var existingModal = document.querySelector('.hj-modal-overlay[data-type="download"]');
        if (existingModal) return;

        var modal = document.createElement('div');
        modal.className = 'hj-modal-overlay';
        modal.setAttribute('data-type', 'download');
        modal.style.zIndex = '1000005';

        var loadingHint = isLoading ? '<div style="font-size:12px;margin-top:6px;color:#ffd966;">⏳ 后台正在获取完整版链接，会自动更新...</div>' : '';

        modal.innerHTML = '<div class="hj-modal" style="max-width:600px;"><div class="hj-modal-title">📥 视频下载</div><div class="hj-modal-content"><div style="margin-bottom:12px;color:rgba(255,255,255,0.9);font-size:13px;">💡 M3U8 是播放列表文件，需要使用专业工具下载完整视频</div><div style="margin-bottom:8px;color:rgba(255,255,255,0.8);font-size:12px;font-weight:500;">视频链接：</div><textarea id="hj-download-url" readonly style="width:100%;min-height:80px;padding:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:8px;color:#fff;font-size:12px;font-family:"Courier New",monospace;resize:vertical;word-break:break-all;outline:none;">' + escapeHtml(String(displayUrl || '')) + '</textarea>' + loadingHint + '</div><div class="hj-modal-actions" style="flex-direction:column;gap:10px;"><button class="hj-modal-btn hj-modal-btn-primary" id="hj-download-copy" style="width:100%;">📋 复制链接</button><button class="hj-modal-btn hj-modal-btn-primary" id="hj-download-go" style="width:100%;background:linear-gradient(135deg,#43e97b 0%,#38f9d7 100%);">🚀 复制并前往下载</button><button class="hj-modal-btn" id="hj-download-close" style="width:100%;background:rgba(255,255,255,0.2);">关闭</button></div></div>';

        document.body.appendChild(modal);

        var closeModal = function() {
            if (modal && modal.remove) {
                modal.remove();
            }
            downloadOpen = false;
            setPanelModalMode(false);
            ensurePanelVisible();
        };

        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal();
        });

        var copyBtn = document.getElementById('hj-download-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                var val = document.getElementById('hj-download-url')?.value || '';
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(val);
                } else {
                    var textarea = document.createElement('textarea');
                    textarea.value = val;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                }
                showGlobalToast('✅ 链接已复制');
            });
        }

        var goBtn = document.getElementById('hj-download-go');
        if (goBtn) {
            goBtn.addEventListener('click', function() {
                var val = document.getElementById('hj-download-url')?.value || '';
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(val).catch(function() {});
                } else {
                    var textarea = document.createElement('textarea');
                    textarea.value = val;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                }
                window.open('https://getm3u8.com/?source=' + val, '_blank');
                closeModal();
            });
        }

        var closeBtn = document.getElementById('hj-download-close');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        setPanelModalMode(true);
    }

    async function playFullVideo(allowPreview) {
        if (allowPreview === undefined) allowPreview = false;
        if (inFlightPlay) return;
        inFlightPlay = true;

        try {
            var epochAtStart = resolveEpoch;
            var pageAtStart = currentPageUrl;

            if (!capturedM3u8Url) {
                showGlobalToast('正在定位视频源…');
                var domUrl = findM3u8InDom();
                if (domUrl) {
                    capturedM3u8Url = domUrl;
                }
                await ensurePreviewTriggered(8, 500);
                var waited = 0;
                await new Promise(function(resolve) {
                    var t = setInterval(function() {
                        waited += 300;
                        if (capturedM3u8Url) {
                            clearInterval(t);
                            resolve();
                        } else if (waited >= 8000) {
                            clearInterval(t);
                            resolve();
                        }
                    }, 300);
                });
                if (!capturedM3u8Url || sigCaptured !== currentSig()) {
                    showGlobalToast('未捕获到视频地址，请稍后重试');
                    inFlightPlay = false;
                    return;
                }
            }

            var preferred = await ensureFullBeforePlay(6000);

            if (STRICT_MODE && !preferred) {
                if (!(allowPreview && capturedM3u8Url && sigCaptured === currentSig())) {
                    showGlobalToast('视频还在解析中，请等几秒钟哦~');
                    inFlightPlay = false;
                    return;
                }
            }

            if (epochAtStart !== resolveEpoch || pageAtStart !== currentPageUrl) {
                inFlightPlay = false;
                return;
            }

            await playVideoInPage(preferred || capturedM3u8Url);

            try {
                var tsSample2 = (capturedTsUrls && capturedTsUrls.length > 0) ? [capturedTsUrls[0]] : [];
                var fullUrl = await Promise.race([
                    resolveFullFromServer({
                        pageUrl: location.href,
                        previewM3u8Url: capturedM3u8Url,
                        tsSamples: tsSample2
                    }),
                    new Promise(function(res) { setTimeout(function() { res(null); }, 9000); })
                ]);

                if (!fullUrl && capturedM3u8Url && sigCaptured === currentSig()) {
                    fullUrl = await localGuessFullM3U8(capturedM3u8Url, tsSample2[0] || '');
                }

                if (fullUrl) {
                    if (epochAtStart === resolveEpoch && pageAtStart === currentPageUrl) {
                        lastFullUrl = fullUrl;
                        sigFull = currentSig();
                        capturedM3u8Url = fullUrl;
                        sigCaptured = currentSig();
                        switchPlayerSource(fullUrl);
                        parsingPending = false;
                        updateStrictUi();
                    }
                }
            } catch (_) {}
        } finally {
            inFlightPlay = false;
        }
    }

    async function localGuessFullM3U8(previewUrl, ts0) {
        try {
            var out = [];
            if (previewUrl) {
                out.push(previewUrl.replace(/_preview/ig, '').replace(/\?[^#]*$/, ''));
            }
            if (ts0) {
                try {
                    var u = new URL(ts0);
                    var base = u.href.substring(0, u.href.lastIndexOf('/') + 1);
                    var m = /([^\/]+)_i\d+\.ts$/i.exec(u.pathname || '');
                    if (m && m[1]) out.push(base + m[1] + '_i.m3u8');
                    ['index.m3u8', 'master.m3u8', 'playlist.m3u8', 'main.m3u8', 'video.m3u8', 'prog_index.m3u8'].forEach(function(n) { out.push(base + n); });
                } catch (_) {}
            }
            var cand = Array.from(new Set(out)).filter(Boolean);
            for (var i = 0; i < cand.length; i++) {
                var url = cand[i];
                try {
                    var r = await fetch(url, { method: 'GET', headers: { 'Referer': document.referrer || location.href } });
                    if (r.ok) {
                        var t = await r.text();
                        if (t && t.includes('#EXTM3U')) return url;
                    }
                } catch (_) {}
            }
        } catch (_) {}
        return null;
    }

    var currentPageUrl = window.location.href;
    var lastTopicId = (function() {
        try { return getTopicIdFromUrl(); } catch (_) { return null; }
    })();

    function expandPanelOnTopicPage() {
        var panel = document.querySelector('.hj-floating-panel');
        if (panel && panel.classList && panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            if (typeof isCollapsed !== 'undefined') {
                isCollapsed = false;
            }
        }
    }

    function onPageChange() {
        var newUrl = window.location.href;
        var changed = (newUrl !== currentPageUrl);
        if (!changed) return;
        console.log('🔄 页面切换:', newUrl);

        currentPageUrl = newUrl;
        try { lastTopicId = getTopicIdFromUrl(); } catch (_) {}

        destroyPlayer();
        capturedTsUrls = [];
        capturedM3u8Url = null;
        sigCaptured = '';
        sigFull = '';
        lastResolvedPageUrl = '';
        lastFullUrl = null;
        parsingPending = true;
        resolveEpoch++;
        stopResolveWatchdog();
        window.__hj_warmup_stop = false;
        try { if (resolveCache && resolveCache.clear) resolveCache.clear(); } catch (_) {}

        updatePlayButton();
        updateStrictUi();

        setTimeout(function() {
            autoClickExpandButton();
            autoTriggerVideoPreview();
        }, 800);

        var isTopic = newUrl.includes('/topic/') || newUrl.includes('/post/details') || window.location.hash.includes('/topic/');

        if (isTopic) {
            startPreviewWarmup();
            setTimeout(function() { expandPanelOnTopicPage(); }, 3000);
            setTimeout(function() { forceCheckUpdateForTopic(); }, 500);
        }

        if (isTopic) {
            setTimeout(function() {
                try { startBackgroundResolve(); } catch (_) {}
            }, 1200);
        }

        if (isTopic) startResolveWatchdog();
        if (isTopic) setTimeout(function() { lazyViewportWarmup(); }, 600);

        setupHlsHook();
        setupPerfObserver();
        startPanelWatchdog();
    }

    function setupPreNavigationGuard() {
        try {
            var handler = function(e) {
                try {
                    var a = (e.target && e.target.closest) ? e.target.closest('a[href]') : null;
                    if (!a) return;
                    var href = a.getAttribute('href') || '';
                    if (!href) return;
                    var abs = href.startsWith('http') ? href : new URL(href, location.href).href;
                    if (abs === location.href) return;
                    if (/(\/topic\/\d+|\/post\/details)/.test(abs)) {
                        try { destroyPlayer(); } catch (_) {}
                        try {
                            capturedTsUrls = [];
                            capturedM3u8Url = null;
                            sigCaptured = '';
                            sigFull = '';
                            lastFullUrl = null;
                            parsingPending = true;
                        } catch (_) {}
                        try {
                            resolveEpoch++;
                            updatePlayButton();
                            updateStrictUi();
                        } catch (_) {}
                    }
                } catch (_) {}
            };
            document.addEventListener('mousedown', handler, true);
            document.addEventListener('click', handler, true);
            document.addEventListener('touchstart', handler, { capture: true, passive: true });
        } catch (_) {}
    }

    function isTopicPageNow() {
        try {
            var href = window.location.href;
            return href.includes('/topic/') || href.includes('/post/details') || window.location.hash.include('topic/');
        } catch (_) {
            return false;
        }
    }

    function hookHistory() {
        try {
            var origPush = history.pushState;
            var origReplace = history.replaceState;

            var preResetIfGoingToDetail = function(urlLike) {
                try {
                    var next = (typeof urlLike === 'string') ? new URL(urlLike, location.href).href : (urlLike && urlLike.href) || null;
                    if (!next) return;
                    if (/(\/topic\/\d+|\/post\/details)/.test(next) && next !== location.href) {
                        try { destroyPlayer(); } catch (_) {}
                        try {
                            capturedTsUrls = [];
                            capturedM3u8Url = null;
                            lastFullUrl = null;
                            parsingPending = true;
                        } catch (_) {}
                        try {
                            resolveEpoch++;
                            updatePlayButton();
                            updateStrictUi();
                        } catch (_) {}
                    }
                } catch (_) {}
            };

            history.pushState = function(state, title, url) {
                preResetIfGoingToDetail(url);
                var r = origPush.apply(this, arguments);
                try { onPageChange(); } catch (_) {}
                return r;
            };

            history.replaceState = function(state, title, url) {
                preResetIfGoingToDetail(url);
                var r = origReplace.apply(this, arguments);
                try { onPageChange(); } catch (_) {}
                return r;
            };
        } catch (_) {}
    }

    function ensurePreviewTriggered(maxAttempts, intervalMs) {
        return new Promise(function(resolve) {
            var attempt = 0;
            var check = function() {
                if (capturedM3u8Url) {
                    resolve();
                    return;
                }
                attempt++;
                if (attempt >= maxAttempts) {
                    resolve();
                    return;
                }
                setTimeout(check, intervalMs);
            };
            check();
        });
    }

    function init() {
        fetchRemoteConfig();

        var expOk = initExperienceCheck();
        if (!expOk) {
            console.log('⏰ 体验时间已到，请打开🔒输入激活码');
        }

        checkLocalVersionUpdate();
        setupApiInterceptor();
        setupXHROpenHook();
        setupTsCapture();
        setupFetchCapture();
        setupFetchAttachmentTap();
        setupPerfObserver();
        setupHlsHook();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                createControlPanel();
                hookHistory();
                setupPreNavigationGuard();
                attachStrictHandlers();
                setupClickShield();
                updateStrictUi();
                startPanelWatchdog();

                var isTopicPage = window.location.href.includes('/topic/') ||
                    window.location.hash.includes('/topic/') ||
                    window.location.href.includes('/post/details');

                if (isTopicPage) {
                    setTimeout(function() {
                        autoClickExpandButton();
                        autoTriggerVideoPreview();
                    }, 1000);
                    setupAutoExpandObserver();
                    startPreviewWarmup();
                    setTimeout(function() {
                        try { startBackgroundResolve(); } catch (_) {}
                    }, 1200);
                    startResolveWatchdog();
                    setTimeout(function() { lazyViewportWarmup(); }, 800);
                    updateStrictUi();
                    setTimeout(function() { expandPanelOnTopicPage(); }, 3000);
                    setTimeout(function() { forceCheckUpdateForTopic(); }, 500);
                }
            });
        } else {
            createControlPanel();
            hookHistory();
            setupPreNavigationGuard();
            attachStrictHandlers();
            setupClickShield();
            updateStrictUi();
            startPanelWatchdog();

            var isTopicPage = window.location.href.includes('/topic/') ||
                window.location.hash.includes('/topic/') ||
                window.location.href.includes('/post/details');

            if (isTopicPage) {
                setTimeout(function() {
                    autoClickExpandButton();
                    autoTriggerVideoPreview();
                }, 1000);
                setupAutoExpandObserver();
                startPreviewWarmup();
                setTimeout(function() { lazyViewportWarmup(); }, 800);
                updateStrictUi();
                setTimeout(function() { expandPanelOnTopicPage(); }, 3000);
                setTimeout(function() { forceCheckUpdateForTopic(); }, 500);
            }
        }

        var observer = new MutationObserver(function() {
            clearTimeout(window._hj_markTimer);
            window._hj_markTimer = setTimeout(function() {
                markPostTypes();
            }, 300);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window._hj_typeObserver = observer;
    }

    init();
})();

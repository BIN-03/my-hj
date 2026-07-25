// ==UserScript==
// @name         海角—解锁金币/钻石
// @version      1.3.33
// @description  ⚡支持观看/下载视频，移除付费金币/钻石/直接使用。⚡
// @author      作者
// @icon        https://www.haijiao.com/images/common/project/loading.gif
// @include      *://h6*.*/*
// @include      *://hj*.*/*
// @match        https://haijiao.com/*
// @match        https://*.haijiao.com/*
// @match        https://hj251101e0b.top/*
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
	'use strict';
	const CONFIG_URL = 'https://gist.githubusercontent.com/BIN-03/310f8b3b4feee3632674d180ecb8e926/raw/config.json';
	
	
	const PASS_KEY_STORAGE = 'hj_pass_key';
	
	let remoteConfig = null;
	let configLoaded = false;
	let passKey = null; // 从远程配置获取的口令码
	
	const KITTY_API_HOST = 'https://www.kittymao.xyz/api';
	const EXPERIENCE_DURATION = 0x124F80;
	const STORAGE_KEY = 'hj_experience_data';
	let currentHlsInstance = null;
	let uiCreated = false;
	let inFlightPlay = false;
	let cachedVideoUrl = null;
	let kittyLoginDone = false;
	let currentPageUrl = window.location.href;
	let isCollapsed = false;
	let isDragging = false;
	let downloadOpen = false;
	let capturedM3u8Url = null;
	let sigCaptured = '';
	let sigFull = '';
	let lastFullUrl = null;
	let parsingPending = true;
	let resolveEpoch = 0;
	
	function getCurrentVersion(){
		if(typeof GM_info!=='undefined'&&GM_info&&GM_info.script){
			return GM_info.script.version.trim();
		}
		return'1.0.0';
	}
	
	var SCRIPT_VERSION=getCurrentVersion();
	var GITHUB_VERSION_URL='https://ghfast.top/https://raw.githubusercontent.com/BIN-03/my-hj/main/android-ios.js';
	
	function getExperienceData(){
		try{
			const data=localStorage.getItem(STORAGE_KEY);
			if(data){
				const parsed=JSON.parse(data);
				return{startTime:parsed.startTime||0,locked:parsed.locked||false,firstUse:parsed.firstUse!==undefined?parsed.firstUse:true};
			}
		}catch(e){}
		return{startTime:0,locked:false,firstUse:true};
	}
	
	function saveExperienceData(startTime,locked,firstUse){
		try{
			localStorage.setItem(STORAGE_KEY,JSON.stringify({startTime:startTime||0,locked:locked||false,firstUse:firstUse!==undefined?firstUse:true}));
		}catch(e){}
	}
	
	function checkExperienceStatus(){
		const data=getExperienceData();
		const permanent=localStorage.getItem('hj_permanent_activated')==='true';
		if(permanent)return{isExpired:false,remainingMs:Infinity,locked:false};
		if(data.locked)return{isExpired:true,remainingMs:0,locked:true};
		if(data.firstUse||data.startTime===0){
			const now=Date.now();
			saveExperienceData(now,false,false);
			return{isExpired:false,remainingMs:EXPERIENCE_DURATION,locked:false};
		}
		const elapsed=Date.now()-data.startTime;
		const remaining=EXPERIENCE_DURATION-elapsed;
		if(remaining<=0){
			saveExperienceData(data.startTime,true,false);
			return{isExpired:true,remainingMs:0,locked:true};
		}
		return{isExpired:false,remainingMs:remaining,locked:false};
	}

	function isFunctionAvailable() {
		var status = checkExperienceStatus();
		var permanent = localStorage.getItem('hj_permanent_activated') === 'true';
		if (permanent) return true;
		return !(status.locked || status.isExpired);
	}

	function showExpiredToast() {
		const existing = document.getElementById('hj-expired-toast');
		if (existing) return;
		const toast = document.createElement('div');
		toast.id = 'hj-expired-toast';
		toast.textContent = '⏰ 体验时间已到';
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

	async function fetchRemoteConfig() {
		try {
			var response = await fetch(CONFIG_URL + '?_=' + Date.now());
			if (response.ok) {
				var data = await response.json();
				remoteConfig = data;
				configLoaded = true;
				
				// 获取 passKey 字段
				if (data.passKey) {
					passKey = data.passKey;
					localStorage.setItem(PASS_KEY_STORAGE, passKey);
				} else {
					// 如果远程没有，尝试从本地读取
					passKey = localStorage.getItem(PASS_KEY_STORAGE) || '';
				}
				
				if (data.content) {
					var currentContent = GM_getValue('announcement_content', '');
					if (data.content !== currentContent) {
						GM_setValue('announcement_content', data.content);
						GM_setValue('announcement_time', data.time || '');
						GM_setValue('announcement_read', false);
						setTimeout(updateAnnouncementBadge, 300);
						showAnnouncementToast('📢 有新公告');
					}
				}
				return data;
			}
		} catch (e) {
			console.error('获取远程配置失败', e);
			// 如果获取失败，尝试使用本地存储的 passKey
			passKey = localStorage.getItem(PASS_KEY_STORAGE) || '';
		}
		return null;
	}

	function showGlobalToast(text, isError) {
		try {
			var existing = document.getElementById('hj-global-toast');
			if (existing) existing.remove();
			var toast = document.createElement('div');
			toast.id = 'hj-global-toast';
			toast.textContent = String(text || '');
			toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:' + (isError ? 'rgba(220,53,69,0.95)' : 'rgba(0,0,0,0.85)') + ';color:white;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:500;z-index:1000010;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;box-shadow:0 4px 15px rgba(0,0,0,0.3);white-space:nowrap;max-width:90vw;text-align:center;pointer-events:none;animation:hjToastFadeInOut 2s ease forwards;';
			if (!document.getElementById('hj-toast-animation-style')) {
				var style = document.createElement('style');
				style.id = 'hj-toast-animation-style';
				style.textContent = '@keyframes hjToastFadeInOut{0%{opacity:0;transform:translateX(-50%)translateY(20px);}15%{opacity:1;transform:translateX(-50%)translateY(0);}85%{opacity:1;transform:translateX(-50%)translateY(0);}100%{opacity:0;transform:translateX(-50%)translateY(-20px);}}';
				document.head.appendChild(style);
			}
			document.body.appendChild(toast);
			setTimeout(function() {
				if (toast && toast.remove) toast.remove();
			}, 2000);
		} catch (e) {}
	}
	
    function showLoadingToast(text) {
    var existing = document.getElementById('hj-loading-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'hj-loading-toast';
    toast.textContent = text || '⏳ 获取视频地址中...';
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:white;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:500;z-index:1000010;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;letter-spacing:0.5px;backdrop-filter:blur(8px);box-shadow:0 4px 15px rgba(0,0,0,0.3);white-space:nowrap;max-width:90vw;text-align:center;pointer-events:none;';
    document.body.appendChild(toast);
}

function hideLoadingToast() {
    var existing = document.getElementById('hj-loading-toast');
    if (existing) existing.remove();
}

	function escapeHtml(str) {
		try {
			return String(str || '').replace(/[&<>"']/g, function(c) {
				var map = {
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					"\"": "&quot;",
					"'": "&#39;"
				};
				return map[c];
			});
		} catch (_) {
			return String(str || '');
		}
	}

	function getTopicId() {
		const params = new URLSearchParams(location.search);
		return params.get('pid') || params.get('id') || '';
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

	function currentSig() {
		try {
			return (currentPageUrl || window.location.href) + '|' + (lastTopicId || '');
		} catch (_) {
			return (currentPageUrl || window.location.href);
		}
	}

	function loadHls() {
		return new Promise(function(resolve, reject) {
			if (typeof Hls !== 'undefined') {
				resolve();
				return;
			}
			var script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
			script.onload = resolve;
			script.onerror = function() {
				reject(new Error('HLS.js 加载失败'));
			};
			document.head.appendChild(script);
		});
	}

	// 修改 doKittyLogin 函数，使用从远程配置获取的 passKey
	function doKittyLogin() {
    return new Promise((resolve) => {
        if (kittyLoginDone) { resolve(true); return; }
        
        // 确保 passKey 已获取
        if (!passKey) {
            // 尝试从 localStorage 读取
            passKey = localStorage.getItem(PASS_KEY_STORAGE) || '';
            if (!passKey) {
                // 如果还没有，尝试获取远程配置
                fetchRemoteConfig().then(() => {
                    if (!passKey) {
                        resolve(false);
                        return;
                    }
                    doLoginRequest(resolve);
                });
                return;
            }
        }
        doLoginRequest(resolve);
    });
}

function doLoginRequest(resolve) {
    const token = localStorage.getItem('kthjau');
    const tokenTime = localStorage.getItem('kthjau_time');
    if (token && tokenTime && (Date.now() - parseInt(tokenTime)) < 24 * 60 * 60 * 1000) {
        kittyLoginDone = true;
        resolve(true);
        return;
    }
    
    GM_xmlhttpRequest({
        method: 'POST',
        url: KITTY_API_HOST + '/hj/getPermission',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ 
            version: '1.1.3', 
            cardContent: passKey,  // 使用从远程配置获取的 passKey
            nickname: 'hj' 
        }),
        onload: function(res) {
            try {
                const result = JSON.parse(res.responseText);
                if (result && result.success && result.data && result.data.token) {
                    localStorage.setItem('kthjau', result.data.token);
                    localStorage.setItem('kthjau_time', String(Date.now()));
                    kittyLoginDone = true;
                    resolve(true);
                } else { 
                    resolve(false); 
                }
            } catch(e) { 
                resolve(false); 
            }
        },
        onerror: function() { 
            resolve(false); 
        }
    });
}

	function getVideoIdFromTopic(topicId) {
		return new Promise((resolve) => {
			GM_xmlhttpRequest({
				method: 'GET',
				url: location.origin + '/api/topic/' + topicId,
				credentials: true,
				headers: {
					'Cache-Control': 'no-cache'
				},
				onload: function(res) {
					try {
						const data = JSON.parse(res.responseText);
						let body = null;
						if (data && data.data) {
							try {
								body = JSON.parse(atob(atob(atob(data.data))));
							} catch (e) {
								try {
									body = JSON.parse(atob(atob(data.data)));
								} catch (e2) {
									try {
										body = JSON.parse(data.data);
									} catch (e3) {}
								}
							}
						}
						if (!body && typeof data.data === 'object') body = data.data;
						if (body && body.attachments) {
							for (let att of body.attachments) {
								if (att && att.category === 'video') {
									resolve(att.id);
									return;
								}
							}
						}
						resolve(null);
					} catch (e) {
						resolve(null);
					}
				},
				onerror: function() {
					resolve(null);
				}
			});
		});
	}

	function getVideoUrlFromKitty(videoId, topicId) {
		return new Promise((resolve) => {
			const isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
			const token = localStorage.getItem('kthjau') || passKey || '';
			GM_xmlhttpRequest({
				method: 'POST',
				url: KITTY_API_HOST + '/hj/movieInfo?kthjau=' + token + '&isPhone=' + isPhone,
				headers: {
					'Content-Type': 'application/json'
				},
				data: JSON.stringify({
					id: Number(videoId),
					line: '',
					resource_id: Number(topicId),
					resource_type: 'topic'
				}),
				onload: function(res) {
					try {
						const result = JSON.parse(res.responseText);
						if (result && result.success && result.data && result.data.remoteUrl) {
							resolve(result.data.remoteUrl);
						} else {
							resolve(null);
						}
					} catch (e) {
						resolve(null);
					}
				},
				onerror: function() {
					resolve(null);
				}
			});
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
			setTimeout(updateAnnouncementBadge, 500);
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
			if (existing.scrollIntoView) existing.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});
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

	function showActivationModal() {
		var existing = document.querySelector('.hj-modal-overlay[data-type="activation"]');
		if (existing) return;
		var modal = document.createElement('div');
		modal.className = 'hj-modal-overlay';
		modal.setAttribute('data-type', 'activation');
		modal.style.zIndex = '1000007';
		modal.innerHTML = '<div class="hj-modal" style="max-width:420px;"><div class="hj-modal-title">🔑 激活</div><div class="hj-modal-content"><div style="margin-bottom:12px;color:rgba(255,255,255,0.8);font-size:13px;text-align:center;">输入激活码解锁全部功能</div><input type="text" id="hj-activation-input" class="hj-modal-input" placeholder="请输入激活码" style="text-align:center;font-size:16px;letter-spacing:2px;"><div id="hj-activation-status" style="text-align:center;font-size:12px;color:#ffd93d;min-height:20px;"></div></div><div class="hj-modal-actions"><button class="hj-modal-btn" id="hj-activation-close" style="width:100%;background:rgba(255,255,255,0.2);">关闭</button><button class="hj-modal-btn hj-modal-btn-primary" id="hj-activation-confirm" style="width:100%;">确认激活</button></div></div>';
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
					if (remoteConfig) processActivation(code);
					else {
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
				var activationBtn = document.getElementById('hj-btn-activation');
				if (activationBtn) activationBtn.style.display = 'none';
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

	function destroyPlayer() {
		if (currentHlsInstance) {
			try {
				currentHlsInstance.destroy();
			} catch (e) {}
			currentHlsInstance = null;
		}
		var overlay = document.getElementById('video-player-overlay');
		if (overlay) overlay.remove();
	}

	function showVideoPlayer(url) {
		destroyPlayer();

		var overlay = document.createElement('div');
		overlay.id = 'video-player-overlay';
		overlay.innerHTML = '<div class="video-player-container"><div class="video-header"><h3>🎬 完整视频播放</h3><button class="close-btn" id="close-player-btn">✕</button></div><div class="video-tips">💡 长按视频2倍速 | 拖动进度条</div><video id="hls-video" controls autoplay style="width:100%;max-height:70vh;background:#000;">您的浏览器不支持视频播放</video></div>';

		GM_addStyle('#video-player-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:99999;display:flex;justify-content:center;align-items:center;}.video-player-container{background:white;border-radius:15px;padding:20px;max-width:90%;box-shadow:0 10px 50px rgba(0,0,0,0.5);}.video-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}.video-header h3{margin:0;color:#333;font-size:16px;font-weight:600;}.video-tips{font-size:12px;color:#666;text-align:center;margin-bottom:12px;padding:8px 12px;background:#f8f9fa;border-radius:8px;}.close-btn{background:#ff4757;color:white;border:none;border-radius:50%;width:35px;height:35px;font-size:20px;cursor:pointer;}.close-btn:hover{background:#ff3838;transform:scale(1.1);}#hls-video{cursor:pointer;user-select:none;}');

		document.body.appendChild(overlay);
		document.getElementById('close-player-btn').addEventListener('click', destroyPlayer);

		var videoElement = document.getElementById('hls-video');
		var longPressTimer = null,
			isLongPress = false;

		videoElement.addEventListener('mousedown', function(e) {
			if (e.button !== 0) return;
			isLongPress = false;
			longPressTimer = setTimeout(function() {
				isLongPress = true;
				showGlobalToast('⏩ 2倍速快进中...');
				videoElement.playbackRate = 2.0;
			}, 400);
		});

		videoElement.addEventListener('mouseup', function() {
			clearTimeout(longPressTimer);
			if (isLongPress) {
				showGlobalToast('⏩ 恢复正常速度');
				videoElement.playbackRate = 1.0;
			}
			isLongPress = false;
		});

		videoElement.addEventListener('mouseleave', function() {
			clearTimeout(longPressTimer);
			if (isLongPress) {
				showGlobalToast('⏩ 恢复正常速度');
				videoElement.playbackRate = 1.0;
			}
			isLongPress = false;
		});

		videoElement.addEventListener('touchstart', function(e) {
			if (!e.touches[0]) return;
			isLongPress = false;
			longPressTimer = setTimeout(function() {
				isLongPress = true;
				showGlobalToast('⏩ 2倍速快进中...');
				videoElement.playbackRate = 2.0;
			}, 400);
		}, {
			passive: true
		});

		videoElement.addEventListener('touchmove', function(e) {
			clearTimeout(longPressTimer);
			if (isLongPress) {
				showGlobalToast('⏩ 恢复正常速度');
				videoElement.playbackRate = 1.0;
				isLongPress = false;
			}
		}, {
			passive: true
		});

		videoElement.addEventListener('touchend', function() {
			clearTimeout(longPressTimer);
			if (isLongPress) {
				showGlobalToast('⏩ 恢复正常速度');
				videoElement.playbackRate = 1.0;
			}
			isLongPress = false;
		}, {
			passive: true
		});

		var isDraggingVideo = false,
			dragStartX = 0,
			dragStartTime = 0;

		videoElement.addEventListener('mousedown', function(e) {
			if (e.button === 0) {
				isDraggingVideo = true;
				dragStartX = e.clientX;
				dragStartTime = videoElement.currentTime;
				e.preventDefault();
			}
		});

		document.addEventListener('mousemove', function(e) {
			if (!isDraggingVideo) return;
			var deltaX = e.clientX - dragStartX;
			var newTime = Math.max(0, Math.min(videoElement.duration || 0, dragStartTime + deltaX / 5));
			videoElement.currentTime = newTime;
		});

		document.addEventListener('mouseup', function() {
			isDraggingVideo = false;
		});

		loadHls().then(function() {
			if (typeof Hls !== 'undefined' && Hls.isSupported()) {
				var hls = new Hls({
					enableWorker: true,
					lowLatencyMode: true,
					maxBufferLength: 30
				});
				currentHlsInstance = hls;
				hls.loadSource(url);
				hls.attachMedia(videoElement);
				hls.on(Hls.Events.MANIFEST_PARSED, function() {
					videoElement.play().catch(function() {});
				});
				hls.on(Hls.Events.ERROR, function(event, data) {
					if (data.fatal) {
						alert('视频加载失败，请重试');
					}
				});
			} else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
				videoElement.src = url;
				videoElement.play().catch(function() {});
			} else {
				alert('您的浏览器不支持HLS播放');
			}
		}).catch(function() {
			if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
				videoElement.src = url;
				videoElement.play().catch(function() {});
			} else {
				alert('HLS.js加载失败');
			}
		});
	}

	async function playFullVideo() {
		if (inFlightPlay) return;
		if (!isFunctionAvailable()) {
			showGlobalToast('⏰ 体验时间已到，请打开🔒按钮激活');
			return;
		}

		inFlightPlay = true;

		try {
			var topicId = getTopicId();
			if (!topicId) {
				showGlobalToast('请先进入一个帖子');
				inFlightPlay = false;
				return;
			}

			if (!kittyLoginDone) {
				await doKittyLogin();
				if (!kittyLoginDone) {
					inFlightPlay = false;
					return;
				}
			}

			var videoUrl = cachedVideoUrl;

			if (videoUrl) {
				showVideoPlayer(videoUrl);
				inFlightPlay = false;
				return;
			}

			showGlobalToast('正在获取视频地址...');

			var videoId = await getVideoIdFromTopic(topicId);
			if (!videoId) {
				showGlobalToast('未找到视频附件');
				inFlightPlay = false;
				return;
			}

			videoUrl = await getVideoUrlFromKitty(videoId, topicId);
			if (!videoUrl) {
				showGlobalToast('获取视频地址失败');
				inFlightPlay = false;
				return;
			}

			cachedVideoUrl = videoUrl;
			capturedM3u8Url = videoUrl;
			sigCaptured = currentSig();
			lastFullUrl = videoUrl;
			sigFull = currentSig();
			parsingPending = false;
			updateStrictUi();

			showVideoPlayer(videoUrl);

		} catch (e) {
			showGlobalToast('播放失败: ' + e.message);
		} finally {
			inFlightPlay = false;
		}
	}

	async function downloadVideo() {
		if (!isFunctionAvailable()) {
			showGlobalToast('⏰ 体验时间已到，请打开🔒按钮激活');
			return;
		}

		var existingModal = document.querySelector('.hj-modal-overlay[data-type="download"]');
		if (existingModal) {
			if (existingModal.scrollIntoView) existingModal.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});
			showGlobalToast('📥 下载窗口已打开');
			return;
		}

		downloadOpen = true;
		var topicId = getTopicId();
		if (!topicId) {
			showGlobalToast('请先进入一个帖子');
			downloadOpen = false;
			return;
		}

		if (!kittyLoginDone) {
			await doKittyLogin();
			if (!kittyLoginDone) {
				downloadOpen = false;
				return;
			}
		}

		var videoUrl = cachedVideoUrl;

		if (!videoUrl) {
			showGlobalToast('正在获取视频地址...');
			var videoId = await getVideoIdFromTopic(topicId);
			if (!videoId) {
				showGlobalToast('未找到视频附件');
				downloadOpen = false;
				return;
			}
			videoUrl = await getVideoUrlFromKitty(videoId, topicId);
			if (!videoUrl) {
				showGlobalToast('获取视频地址失败');
				downloadOpen = false;
				return;
			}
			cachedVideoUrl = videoUrl;
		}

		showDownloadModal(videoUrl);
	}

	function showDownloadModal(displayUrl) {
		var existingModal = document.querySelector('.hj-modal-overlay[data-type="download"]');
		if (existingModal) return;

		var modal = document.createElement('div');
		modal.className = 'hj-modal-overlay';
		modal.setAttribute('data-type', 'download');
		modal.style.zIndex = '1000005';

		modal.innerHTML = '<div class="hj-modal" style="max-width:600px;"><div class="hj-modal-title">📥 视频下载</div><div class="hj-modal-content"><div style="margin-bottom:12px;color:rgba(255,255,255,0.9);font-size:13px;">💡 M3U8 是播放列表文件，需要使用专业工具下载完整视频</div><div style="margin-bottom:8px;color:rgba(255,255,255,0.8);font-size:12px;font-weight:500;">视频链接：</div><textarea id="hj-download-url" readonly style="width:100%;min-height:80px;padding:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:8px;color:#fff;font-size:12px;font-family:"Courier New",monospace;resize:vertical;word-break:break-all;outline:none;">' + escapeHtml(String(displayUrl || '')) + '</textarea></div><div class="hj-modal-actions" style="flex-direction:column;gap:10px;"><button class="hj-modal-btn hj-modal-btn-primary" id="hj-download-copy" style="width:100%;">📋 复制链接</button><button class="hj-modal-btn hj-modal-btn-primary" id="hj-download-go" style="width:100%;background:linear-gradient(135deg,#43e97b 0%,#38f9d7 100%);">🚀 复制并前往下载</button><button class="hj-modal-btn" id="hj-download-close" style="width:100%;background:rgba(255,255,255,0.2);">关闭</button></div></div>';

		document.body.appendChild(modal);

		var closeModal = function() {
			if (modal && modal.remove) modal.remove();
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
				var confirmed = confirm('⚠️安卓/鸿蒙用户需知！⚠️\n请前往"设置—脚本页面"点击右上"更新"按钮手动更新\n⚠️苹果用户需知！⚠️\n 未自动安装脚本，请复制浏览器地址栏地址\n前往设置-脚-右上角+号手动下载');
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

	function checkForUpdate() {
		GM_xmlhttpRequest({
			method: 'GET',
			url: GITHUB_VERSION_URL + '?_=' + Date.now(),
			timeout: 5000,
			onload: function(res) {
				if (res.status === 200) {
					var match = res.responseText.match(/@version\s+([\d.]+)/);
					if (match && match[1] && match[1] !== SCRIPT_VERSION) {
						setTimeout(function() {
							showUpdateNotification(match[1]);
						}, 3000);
					}
				}
			}
		});
	}

	function getFloatingPanel() {
		return document.querySelector('.hj-floating-panel');
	}

	function ensurePanelVisible() {
		try {
			var p = getFloatingPanel();
			if (!p) {
				createControlPanel();
				p = getFloatingPanel();
			}
			if (p) {
				p.style.zIndex = '999999';
				p.style.display = 'block';
				p.style.opacity = '1';
			}
		} catch (_) {}
	}

	function setPanelModalMode(on) {
		try {
			var p = getFloatingPanel();
			if (!p) return;
			p.style.zIndex = on ? '9999' : '999999';
			if (!on) p.style.display = 'block';
		} catch (e) {}
	}

	function updateStrictUi() {
		try {
			var playBtn = document.getElementById('hj-btn-play');
			var ready = !!(cachedVideoUrl);
			if (playBtn) {
				if (ready) {
					playBtn.classList.add('hj-btn-ready');
				} else {
					playBtn.classList.remove('hj-btn-ready');
				}
			}
		} catch (_) {}
	}

	function createControlPanel() {
		if (uiCreated || document.querySelector('.hj-floating-panel')) return;

		GM_addStyle('#wt-resources-box{position:relative;border:1px dashed #ec8181;background:#fff4f4;}#wt-resources-box::after{content:"⚠️ 请使用屏幕右边播放按钮播放";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) translateZ(0);color:#ff0000;font-size:18px;font-weight:700;text-shadow:0 0 10px rgba(255,0,0,0.2);text-align:center;width:80%;line-height:1.6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;will-change:transform;}.sell-btn{border:none !important;margin-top:20px;}.hj-floating-panel{position:fixed;right:20px;top:50%;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;transition:none;user-select:none;transform:translateY(-50%)scale(0.75);transform-origin:right center;}.hj-floating-panel.dragging{transition:none;}.hj-floating-panel.collapsed .hj-panel-content{display:none;}.hj-panel-container{background:rgba(102,126,234,0.15);border-radius:30px;box-shadow:0 8px 32px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.15)inset;overflow:hidden;backdrop-filter:blur(20px)saturate(180%);-webkit-backdrop-filter:blur(20px)saturate(180%);}.hj-toggle-btn{width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:rgba(102,126,234,0.3);border:none;border-radius:50%;cursor:move;color:white;transition:none;position:relative;backdrop-filter:blur(10px);margin:0 auto;}.hj-toggle-btn:hover{filter:brightness(1.05);}.hj-toggle-btn svg{width:24px;height:24px;transition:none;transform:rotate(180deg);}.hj-panel-content{padding:10px;}.hj-buttons{display:flex;flex-direction:column;gap:12px;}.hj-btn{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border:none;border-radius:14px;cursor:pointer;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);position:relative;overflow:hidden;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);}.hj-btn::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.2),transparent);opacity:0;transition:opacity 0.3s;}.hj-btn:hover::before{opacity:1;}.hj-btn:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.3);}.hj-btn:active{transform:translateY(-1px);}.hj-btn:disabled{background:rgba(150,150,150,0.3)!important;cursor:not-allowed;transform:none!important;opacity:0.6;}.hj-btn svg{width:24px;height:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));}.hj-btn-ready::after{content:"";position:absolute;top:8px;left:8px;width:10px;height:10px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 2px rgba(74,222,128,0.3),0 2px 8px rgba(74,222,128,0.5);animation:statusPulse 2s infinite;}.hj-btn-announcement{background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%)!important;}.hj-btn-activation{background:linear-gradient(135deg,#f6d365 0%,#fda085 100%)!important;}@keyframes statusPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.7;transform:scale(1.1);}}@keyframes hjBadgePulse{0%,100%{transform:scale(1);}50%{transform:scale(1.2);}}.hj-btn-play{background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);}.hj-btn-download{background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);}.hj-btn-qq{background:linear-gradient(135deg,#12c2e9 0%,#c471ed 50%,#f64f59 100%)!important;}.hj-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);z-index:999998;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s;}@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}.hj-modal{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:20px;padding:28px;min-width:360px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.5);color:white;animation:slideUp 0.3s cubic-bezier(0.4,0,0.2,1);}@keyframes slideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}.hj-modal-title{font-size:20px;font-weight:600;margin-bottom:20px;text-align:center;position:relative;}.hj-modal-content{background:rgba(255,255,255,0.15);border-radius:12px;padding:16px;margin-bottom:20px;}.hj-modal-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;font-size:14px;}.hj-modal-label{opacity:0.9;font-weight:500;}.hj-modal-value{font-weight:600;font-family:"Courier New",monospace;}.hj-modal-actions{display:flex;gap:12px;}.hj-modal-btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;}.hj-modal-btn-primary{background:rgba(255,255,255,0.9);color:#667eea;}.hj-modal-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.3);}.hj-modal-input{width:100%;padding:12px;border:2px solid rgba(255,255,255,0.3);border-radius:10px;background:rgba(255,255,255,0.1);color:white;font-size:14px;font-family:"Courier New",monospace;outline:none;transition:all 0.2s;margin-bottom:12px;}.hj-modal-input::placeholder{color:rgba(255,255,255,0.5);}.hj-modal-input:focus{border-color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.15);}');
		var panel = document.createElement('div');
		panel.className = 'hj-floating-panel';
		panel.innerHTML = '<div class="hj-panel-container"><button class="hj-toggle-btn" id="hj-toggle-btn" title="拖动移动 | 点击折叠"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg></button><div class="hj-panel-content"><div class="hj-buttons"><button class="hj-btn hj-btn-play" id="hj-btn-play" title="播放视频"><svg viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></button><button class="hj-btn hj-btn-download" id="hj-btn-download" title="下载视频"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button class="hj-btn hj-btn-activation" id="hj-btn-activation" title="激活"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></button><button class="hj-btn hj-btn-announcement" id="hj-btn-announcement" title="公告"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><circle cx="12" cy="4" r="1" fill="white"/></svg></button><button class="hj-btn hj-btn-qq" id="hj-btn-qq" title="联系作者"><img src="//pub.idqqimg.com/wpa/images/group.png" style="width:61px;height:30px;"></button></div></div></div>';

		document.body.appendChild(panel);

		var toggleBtn = document.getElementById('hj-toggle-btn');
		var startX, startY, startRight, startTop, hasMoved = false;

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
			if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) hasMoved = true;
			var newRight = Math.max(0, Math.min(window.innerWidth - 100, startRight + deltaX));
			var newTop = Math.max(0, Math.min(window.innerHeight - 100, startTop + deltaY));
			panel.style.right = newRight + 'px';
			panel.style.top = newTop + 'px';
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

		document.getElementById('hj-btn-play').addEventListener('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			playFullVideo();
		});

		document.getElementById('hj-btn-download').addEventListener('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			downloadVideo();
		});

		document.getElementById('hj-btn-activation').addEventListener('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			showActivationModal();
		});

		document.getElementById('hj-btn-announcement').addEventListener('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			showAnnouncementModal();
		});

		document.getElementById('hj-btn-qq').addEventListener('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			window.open('https://qm.qq.com/cgi-bin/qm/qr?k=sAIz2xHv-E-4PX5q3CHD_rY5txeGuyfP&jump_from=webapi&authKey=cVUoUVKelOP+VWD+ZPAT9V+wwWWBZCBzL61fjex8FmgEr+8yt3oRSzzihHokbmRQ', '_blank');
		});

		setTimeout(updateAnnouncementBadge, 500);
		uiCreated = true;
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
		overlay.onclick = function() {
			overlay.remove();
		};
		document.body.appendChild(overlay);
		setTimeout(function() {
			overlay.remove();
		}, 1000);
	}

	document.addEventListener('click', function(e) {
		var btn = e.target.closest('.preview-btn, span.preview-btn, [class*="preview"], .sell-btn');
		if (btn) {
			e.preventDefault();
			e.stopPropagation();
			showPreviewBlocked();
		}
	}, true);

	GM_addStyle('#wt-resources-box{position:relative;border:1px dashed #ec8181;background:#fff4f4;}#wt-resources-box::after{content:"⚠️ 请使用屏幕右边播放按钮播放";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) translateZ(0);color:#ff0000;font-size:18px;font-weight:700;text-shadow:0 0 10px rgba(255,0,0,0.2);text-align:center;width:80%;line-height:1.6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;will-change:transform;}.sell-btn{border:none !important;margin-top:20px;}');

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
			oldBadges.forEach(function(b) {
				b.remove();
			});

			var labelMap = [{
					key: '视频',
					condition: hasVideo,
					bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
				},
				{
					key: '图片',
					condition: hasImage,
					bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
				}
			];

			labelMap.forEach(function(item) {
				if (!item.condition) return;
				var badge = document.createElement('span');
				badge.className = 'hj-badge';
				badge.textContent = item.key === '视频' ? '🎬 视频' : '📷 图片';
				badge.style.cssText = 'display:inline-block;background:' + item.bg + ';color:#fff;font-size:11px;font-weight:600;padding:2px 10px;border-radius:20px;margin-right:6px;letter-spacing:0.5px;vertical-align:middle;flex-shrink:0;line-height:1.6;box-shadow:0 2px 6px rgba(0,0,0,0.15);backdrop-filter:blur(2px);border:1px solid rgba(255,255,255,0.2);';
				titleEl.prepend(badge);
			});
		});
	}

	function onPageChange() {
		var newUrl = window.location.href;
		var changed = (newUrl !== currentPageUrl);
		if (!changed) return;

		cachedVideoUrl = null;
		currentPageUrl = newUrl;
		destroyPlayer();

		var playBtn = document.getElementById('hj-btn-play');
		if (playBtn) playBtn.classList.remove('hj-btn-ready');

		var isTopic = newUrl.includes('/topic/') || newUrl.includes('/post/details') || window.location.hash.includes('/topic/');

		if (isTopic) {
    var topicId = getTopicId();
    if (topicId) {
        showLoadingToast('⏳ 正在获取视频地址...');
        doKittyLogin().then(function(ok) {
            if (ok) {
                getVideoIdFromTopic(topicId).then(function(videoId) {
                    if (videoId) {
                        getVideoUrlFromKitty(videoId, topicId).then(function(videoUrl) {
                            hideLoadingToast();
                            if (videoUrl) {
                                cachedVideoUrl = videoUrl;
                                capturedM3u8Url = videoUrl;
                                sigCaptured = currentSig();
                                lastFullUrl = videoUrl;
                                sigFull = currentSig();
                                parsingPending = false;
                                updateStrictUi();
                                showGlobalToast('✅ 视频已就绪，可点击播放');
                            } else {
                                showGlobalToast('❌ 获取视频地址失败');
                            }
                        });
                    } else {
                        hideLoadingToast();
                        showGlobalToast('❌ 未找到视频附件');
                    }
                });
            } else {
                hideLoadingToast();
                showGlobalToast('❌ 校验失败');
            }
        });
    }
}
	}

	function hookHistory() {
		var origPush = history.pushState;
		var origReplace = history.replaceState;

		history.pushState = function(state, title, url) {
			var r = origPush.apply(this, arguments);
			setTimeout(onPageChange, 300);
			return r;
		};

		history.replaceState = function(state, title, url) {
			var r = origReplace.apply(this, arguments);
			setTimeout(onPageChange, 300);
			return r;
		};
	}

	var lastTopicId = null;

	function init() {
    fetchRemoteConfig();
    setInterval(fetchRemoteConfig, 3 * 60 * 1000);

    var permanent = localStorage.getItem('hj_permanent_activated') === 'true';
    if (permanent) {
        setTimeout(function() {
            var activationBtn = document.getElementById('hj-btn-activation');
            if (activationBtn) activationBtn.style.display = 'none';
        }, 1000);
    }

    checkForUpdate();

    var lastUrl = location.href;
    setInterval(function() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(onPageChange, 300);
        }
    }, 500);

    hookHistory();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            createControlPanel();
            var isTopic = location.href.includes('/topic/') || location.href.includes('/post/details');
            if (isTopic) {
                var topicId = getTopicId();
                if (topicId) {
                    showLoadingToast('⏳ 正在获取视频地址...');
                    doKittyLogin().then(function(ok) {
                        if (ok) {
                            getVideoIdFromTopic(topicId).then(function(videoId) {
                                if (videoId) {
                                    getVideoUrlFromKitty(videoId, topicId).then(function(videoUrl) {
                                        hideLoadingToast();
                                        if (videoUrl) {
                                            cachedVideoUrl = videoUrl;
                                            capturedM3u8Url = videoUrl;
                                            sigCaptured = currentSig();
                                            lastFullUrl = videoUrl;
                                            sigFull = currentSig();
                                            parsingPending = false;
                                            updateStrictUi();
                                            showGlobalToast('✅ 视频已就绪，可点击播放');
                                        } else {
                                            showGlobalToast('❌ 获取视频地址失败');
                                        }
                                    });
                                } else {
                                    hideLoadingToast();
                                    showGlobalToast('❌ 未找到视频附件');
                                }
                            });
                        } else {
                            hideLoadingToast();
                            showGlobalToast('❌ 校验失败');
                        }
                    });
                }
                setTimeout(markPostTypes, 1000);
            }
        });
    } else {
        createControlPanel();
        var isTopic = location.href.includes('/topic/') || location.href.includes('/post/details');
        if (isTopic) {
            var topicId = getTopicId();
            if (topicId) {
                showLoadingToast('⏳ 正在获取视频地址...');
                doKittyLogin().then(function(ok) {
                    if (ok) {
                        getVideoIdFromTopic(topicId).then(function(videoId) {
                            if (videoId) {
                                getVideoUrlFromKitty(videoId, topicId).then(function(videoUrl) {
                                    hideLoadingToast();
                                    if (videoUrl) {
                                        cachedVideoUrl = videoUrl;
                                        capturedM3u8Url = videoUrl;
                                        sigCaptured = currentSig();
                                        lastFullUrl = videoUrl;
                                        sigFull = currentSig();
                                        parsingPending = false;
                                        updateStrictUi();
                                        showGlobalToast('✅ 视频已就绪，可点击播放');
                                    } else {
                                        showGlobalToast('❌ 获取视频地址失败');
                                    }
                                });
                            } else {
                                hideLoadingToast();
                                showGlobalToast('❌ 未找到视频附件');
                            }
                        });
                    } else {
                        hideLoadingToast();
                        showGlobalToast('❌ 校验失败');
                    }
                });
            }
            setTimeout(markPostTypes, 1000);
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

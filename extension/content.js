// InSnitch Content Script - Proven Stable Collector
console.log("[InSnitch] Content script carregado.");

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : '';
}

function getCsrfToken() {
  return getCookie('csrftoken') || getCookie('csrf_token') || '';
}

function getCurrentPageUsername() {
  const path = window.location.pathname.split('/').filter(Boolean);
  if (path.length === 0) return null;
  const reserved = ['explore', 'direct', 'reels', 'stories', 'accounts', 'p', 'reel', 'tv'];
  if (reserved.includes(path[0].toLowerCase())) return null;
  return path[0].toLowerCase();
}

async function extractProfileInfo(username) {
  try {
    const headers = {
      'x-ig-app-id': '936619743392459',
      'x-asbd-id': '129477',
      'x-csrftoken': getCsrfToken(),
      'x-requested-with': 'XMLHttpRequest',
      'Accept': '*/*'
    };

    const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers,
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      const u = data?.data?.user;
      if (u) {
        return {
          id: u.id,
          username: u.username,
          full_name: u.full_name || "",
          biography: u.biography || "",
          profile_pic_url: u.profile_pic_url_hd || u.profile_pic_url || "",
          is_verified: u.is_verified || false,
          is_private: u.is_private || false,
          posts_count: u.edge_owner_to_timeline_media?.count || 0,
          followers_count: u.edge_followed_by?.count || 0,
          following_count: u.edge_follow?.count || 0
        };
      }
    }
  } catch (e) {
    console.warn("[InSnitch] web_profile_info falhou, tentando fallbacks:", e);
  }

  // Fallback: Extract from DOM
  const nameEl = document.querySelector('header section h2, header section h1');
  const bioEl = document.querySelector('header section h1 + div, header section .-vDIg');
  const avatarEl = document.querySelector('header img');

  let id = null;
  const isOwnProfile = !!document.querySelector('a[href*="/accounts/edit/"], header button');
  if (isOwnProfile && getCookie('ds_user_id')) {
    id = getCookie('ds_user_id');
  }

  return {
    id: id,
    username: username,
    full_name: nameEl ? nameEl.innerText : username,
    biography: bioEl ? bioEl.innerText : "",
    profile_pic_url: avatarEl ? avatarEl.src : "",
    is_verified: !!document.querySelector('header [title="Verificado"]'),
    is_private: false,
    posts_count: 0,
    followers_count: 0,
    following_count: 0
  };
}

async function fetchUserList(userId, type = "followers", onProgress, options = {}) {
  const delayMs = options.delay || 750;
  const maxLimit = options.maxLimit || 10000;

  const users = [];
  const seenUsernames = new Set();
  const seenMaxIds = new Set();
  let maxId = null;
  const csrf = getCsrfToken();

  const headers = {
    'x-ig-app-id': '936619743392459',
    'x-asbd-id': '129477',
    'x-csrftoken': csrf,
    'x-requested-with': 'XMLHttpRequest',
    'Accept': '*/*'
  };

  for (let page = 0; page < 250; page++) {
    if (users.length >= maxLimit) break;

    let url = `/api/v1/friendships/${userId}/${type}/?count=50`;
    if (maxId) {
      url += `&max_id=${encodeURIComponent(maxId)}`;
    }

    let pageUsers = [];
    let nextCursor = null;
    let success = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let res = await fetch(url, {
          headers: {
            ...headers,
            'User-Agent': navigator.userAgent
          },
          credentials: 'include'
        });

        if (res.status === 429) {
          const waitTime = attempt * 3000;
          if (onProgress) {
            onProgress(type, users.length, `Aguardando pausa anti-bloqueio (${waitTime/1000}s)...`);
          }
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        if (!res.ok) {
          let altUrl = `https://www.instagram.com/api/v1/friendships/${userId}/${type}/?count=50`;
          if (maxId) altUrl += `&max_id=${encodeURIComponent(maxId)}`;
          res = await fetch(altUrl, {
            headers: { ...headers, 'User-Agent': navigator.userAgent },
            credentials: 'include'
          });
        }

        if (res.ok) {
          const data = await res.json();
          pageUsers = data.users || [];
          nextCursor = data.next_max_id;
          success = true;
          break;
        } else {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (err) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!success || pageUsers.length === 0) break;

    for (const u of pageUsers) {
      const cleanName = (u.username || "").toLowerCase().trim();
      if (!cleanName || seenUsernames.has(cleanName)) continue;
      seenUsernames.add(cleanName);

      users.push({
        username: u.username,
        full_name: u.full_name || "",
        profile_pic_url: u.profile_pic_url || "",
        is_verified: u.is_verified || false
      });
    }

    if (onProgress) {
      onProgress(type, users.length);
    }

    maxId = nextCursor;
    if (!maxId || seenMaxIds.has(maxId)) break;
    seenMaxIds.add(maxId);

    await new Promise(r => setTimeout(r, delayMs));
  }

  return users;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_CURRENT_PROFILE") {
    const username = getCurrentPageUsername();
    sendResponse({ username });
    return true;
  }

  if (request.action === "EXTRACT_ALL_DATA") {
    (async () => {
      try {
        const username = request.username || getCurrentPageUsername();
        if (!username) {
          sendResponse({ success: false, error: "Nenhum perfil identificado na aba ativa." });
          return;
        }

        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Obtendo dados do perfil..." });
        const profileInfo = await extractProfileInfo(username);

        let targetId = profileInfo.id;
        if (!targetId) {
          try {
            const searchRes = await fetch(`/api/v1/users/search/?q=${encodeURIComponent(username)}`, {
              credentials: 'include',
              headers: { 'x-ig-app-id': '936619743392459' }
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              const match = (searchData.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
              if (match) {
                targetId = match.pk || match.pk_id || match.id;
                if (!profileInfo.profile_pic_url) profileInfo.profile_pic_url = match.profile_pic_url;
                if (!profileInfo.full_name) profileInfo.full_name = match.full_name;
              }
            }
          } catch (sErr) {}
        }

        if (!targetId) {
          sendResponse({ success: false, error: "Não foi possível resolver o ID deste perfil. Recarregue a aba do Instagram e tente novamente." });
          return;
        }

        const scanOptions = request.options || {};
        const expectedFollowers = profileInfo.followers_count || 0;
        const expectedFollowing = profileInfo.following_count || 0;

        // 1. Coleta Seguidores
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de seguidores..." });
        const followers = await fetchUserList(targetId, "followers", (type, count, extraMsg) => {
          const perc = expectedFollowers > 0 ? ` (${Math.min(100, Math.round((count / expectedFollowers) * 100))}%)` : '';
          const msg = extraMsg || `Coletando seguidores: ${count}${expectedFollowers ? ` de ${expectedFollowers}` : ''}${perc}...`;
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
        }, scanOptions);

        // 2. Coleta Seguidos
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de seguidos..." });
        const following = await fetchUserList(targetId, "following", (type, count, extraMsg) => {
          const perc = expectedFollowing > 0 ? ` (${Math.min(100, Math.round((count / expectedFollowing) * 100))}%)` : '';
          const msg = extraMsg || `Coletando seguindo: ${count}${expectedFollowing ? ` de ${expectedFollowing}` : ''}${perc}...`;
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
        }, scanOptions);

        if (profileInfo.is_private && followers.length === 0 && profileInfo.followers_count > 0) {
          sendResponse({ 
            success: false, 
            error: `Este perfil é privado (@${profileInfo.username}) e o Instagram restringe a lista de seguidores para contas que não o seguem.` 
          });
          return;
        }

        if (profileInfo.followers_count > 10 && followers.length === 0) {
          sendResponse({ 
            success: false, 
            error: `O Instagram não retornou a lista de seguidores (0 de ${profileInfo.followers_count}). Recarregue a aba do Instagram e tente novamente.` 
          });
          return;
        }

        const packageData = {
          profile: {
            username: profileInfo.username,
            full_name: profileInfo.full_name,
            biography: profileInfo.biography,
            profile_pic_url: profileInfo.profile_pic_url,
            is_verified: profileInfo.is_verified,
            is_private: profileInfo.is_private,
            posts_count: profileInfo.posts_count,
            followers_count: profileInfo.followers_count || followers.length,
            following_count: profileInfo.following_count || following.length
          },
          followers: followers,
          following: following,
          followers_count: profileInfo.followers_count || followers.length,
          following_count: profileInfo.following_count || following.length,
          posts_count: profileInfo.posts_count
        };

        sendResponse({ success: true, data: packageData });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});

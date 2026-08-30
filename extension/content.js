// InSnitch Content Script - Smart Direct Collector with Alphabetical Partitioning
console.log("[InSnitch] Content script carregado com Suporte Alfabético A-Z.");

// 1. Helpers for Cookies & CSRF Token
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : '';
}

function getCsrfToken() {
  let token = getCookie('csrftoken') || getCookie('csrf_token');
  if (!token) {
    try {
      const match = document.documentElement.innerHTML.match(/"csrf_token":"([^"]+)"/);
      if (match) token = match[1];
    } catch (e) {}
  }
  return token || '';
}

// Extract username from URL pathname
function getCurrentPageUsername() {
  const path = window.location.pathname.split('/').filter(Boolean);
  if (path.length === 0) return null;
  const reserved = ['explore', 'direct', 'reels', 'stories', 'accounts', 'p', 'reel', 'tv'];
  if (reserved.includes(path[0].toLowerCase())) return null;
  return path[0].toLowerCase();
}

// 2. Extract profile details with 7-layer ID resolution
async function extractProfileInfo(username) {
  let profile = {
    id: null,
    username: username,
    full_name: username,
    biography: "",
    profile_pic_url: "",
    is_verified: false,
    is_private: false,
    posts_count: 0,
    followers_count: 0,
    following_count: 0
  };

  function parseCount(str) {
    if (!str) return 0;
    str = String(str).replace(/\./g, '').replace(/,/g, '.').trim().toLowerCase();
    if (str.endsWith('k')) return Math.round(parseFloat(str) * 1000);
    if (str.endsWith('m')) return Math.round(parseFloat(str) * 1000000);
    return parseInt(str.replace(/[^0-9]/g, '')) || 0;
  }

  // Layer 1: web_profile_info endpoint
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
        profile.id = u.id;
        profile.username = u.username;
        profile.full_name = u.full_name || "";
        profile.biography = u.biography || "";
        profile.profile_pic_url = u.profile_pic_url_hd || u.profile_pic_url || "";
        profile.is_verified = u.is_verified || false;
        profile.is_private = u.is_private || false;
        profile.posts_count = u.edge_owner_to_timeline_media?.count || 0;
        profile.followers_count = u.edge_followed_by?.count || 0;
        profile.following_count = u.edge_follow?.count || 0;
      }
    }
  } catch (e) {
    console.warn("[InSnitch] web_profile_info falhou, usando fallbacks:", e);
  }

  // Layer 2: DOM & Meta Tags
  try {
    const metaDesc = document.querySelector('meta[name="description"]')?.content || "";
    const followersMatch = metaDesc.match(/([0-9.,kKmM]+)\s+Followers/i) || metaDesc.match(/([0-9.,kKmM]+)\s+seguidores/i);
    const followingMatch = metaDesc.match(/([0-9.,kKmM]+)\s+Following/i) || metaDesc.match(/([0-9.,kKmM]+)\s+seguindo/i);
    const postsMatch = metaDesc.match(/([0-9.,kKmM]+)\s+Posts/i) || metaDesc.match(/([0-9.,kKmM]+)\s+publicações/i);

    if (!profile.followers_count && followersMatch) profile.followers_count = parseCount(followersMatch[1]);
    if (!profile.following_count && followingMatch) profile.following_count = parseCount(followingMatch[1]);
    if (!profile.posts_count && postsMatch) profile.posts_count = parseCount(postsMatch[1]);

    const nameEl = document.querySelector('header section h2, header section h1');
    const bioEl = document.querySelector('header section h1 + div, header section .-vDIg');
    const avatarEl = document.querySelector('header img');

    if (!profile.full_name && nameEl) profile.full_name = nameEl.innerText;
    if (!profile.biography && bioEl) profile.biography = bioEl.innerText;
    if (!profile.profile_pic_url && avatarEl) profile.profile_pic_url = avatarEl.src;
    if (!profile.is_verified) profile.is_verified = !!document.querySelector('header [title="Verificado"]');

    // Layer 3: Logged-in user check (ds_user_id)
    const isOwnProfile = !!document.querySelector('a[href*="/accounts/edit/"], header button');
    const dsUserId = getCookie('ds_user_id');
    if (!profile.id && isOwnProfile && dsUserId) {
      profile.id = dsUserId;
    }

    // Layer 4: HTML script tags regex for ID
    if (!profile.id) {
      const html = document.documentElement.innerHTML;
      const idMatch = html.match(/"owner_user_id":"([0-9]+)"/) || 
                      html.match(new RegExp(`"id":"([0-9]+)","username":"${username}"`, "i")) ||
                      html.match(new RegExp(`"username":"${username}"[^{}]*"id":"([0-9]+)"`, "i")) ||
                      html.match(/"user_id":"([0-9]+)"/) ||
                      html.match(/"pk":"([0-9]+)"/) ||
                      html.match(/"pk_id":"([0-9]+)"/);
      if (idMatch) profile.id = idMatch[1];
    }
  } catch (domErr) {
    console.warn("[InSnitch] Erro ao extrair do DOM:", domErr);
  }

  // Layer 5: Feed user endpoint
  if (!profile.id) {
    try {
      const feedRes = await fetch(`/api/v1/feed/user/${username}/username/`, {
        credentials: 'include',
        headers: { 'x-ig-app-id': '936619743392459', 'x-csrftoken': getCsrfToken() }
      });
      if (feedRes.ok) {
        const feedData = await feedRes.json();
        const u = feedData?.user;
        if (u?.pk || u?.id) {
          profile.id = u.pk || u.id;
          if (!profile.profile_pic_url) profile.profile_pic_url = u.profile_pic_url;
          if (!profile.full_name) profile.full_name = u.full_name;
        }
      }
    } catch (fErr) {
      console.warn("[InSnitch] Erro no feed endpoint:", fErr);
    }
  }

  // Layer 6: User Search endpoint
  if (!profile.id) {
    try {
      const searchRes = await fetch(`/api/v1/users/search/?q=${encodeURIComponent(username)}`, {
        credentials: 'include',
        headers: { 'x-ig-app-id': '936619743392459' }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const match = (searchData.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
        if (match) {
          profile.id = match.pk || match.pk_id || match.id;
          if (!profile.profile_pic_url) profile.profile_pic_url = match.profile_pic_url;
          if (!profile.full_name) profile.full_name = match.full_name;
        }
      }
    } catch (sErr) {
      console.warn("[InSnitch] Erro na busca de ID:", sErr);
    }
  }

  // Layer 7: ds_user_id cookie
  if (!profile.id && getCookie('ds_user_id')) {
    profile.id = getCookie('ds_user_id');
  }

  return profile;
}

// 3. Fase 1: Fetch user list via standard cursor pagination
async function fetchUserList(userId, type = "followers", expectedTotal = 0, onProgress, options = {}) {
  const delayMs = options.delay || 650;
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
    if (maxId) url += `&max_id=${encodeURIComponent(maxId)}`;

    let pageUsers = [];
    let nextCursor = null;
    let success = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let res = await fetch(url, {
          headers: { ...headers, 'User-Agent': navigator.userAgent },
          credentials: 'include'
        });

        if (res.status === 429) {
          const waitTime = attempt * 2500;
          if (onProgress) {
            onProgress(type, users.length, expectedTotal, `Pausa anti-bloqueio (${waitTime/1000}s)...`);
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
      onProgress(type, users.length, expectedTotal);
    }

    maxId = nextCursor;
    if (!maxId || seenMaxIds.has(maxId)) break;
    seenMaxIds.add(maxId);

    await new Promise(r => setTimeout(r, delayMs));
  }

  return users;
}

// 4. Fase 2: Varredura Alfabética A-Z (Alphabetical Partitioning)
// Puxa seguidores por prefixos de busca para ultrapassar o limite de ~1.650 do cursor
async function fetchAlphabeticalUsers(userId, type = "followers", usersMap, targetTotal = 0, onProgress, options = {}) {
  const delayMs = Math.max(350, (options.delay || 650) - 200);
  const chars = [
    'a','b','c','d','e','f','g','h','i','j','k','l','m',
    'n','o','p','q','r','s','t','u','v','w','x','y','z',
    '0','1','2','3','4','5','6','7','8','9','_','.'
  ];

  const csrf = getCsrfToken();
  const headers = {
    'x-ig-app-id': '936619743392459',
    'x-asbd-id': '129477',
    'x-csrftoken': csrf,
    'x-requested-with': 'XMLHttpRequest',
    'Accept': '*/*'
  };

  console.log(`[InSnitch] Iniciando Fase 2: Varredura Alfabética A-Z para capturar seguidores restantes (${usersMap.size}/${targetTotal})...`);

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (targetTotal > 0 && usersMap.size >= targetTotal) {
      console.log(`[InSnitch] Meta total de 100% atingida na letra "${char}" (${usersMap.size}/${targetTotal})!`);
      break;
    }

    let maxId = null;
    // Query up to 3 pages per letter (~150 users per letter)
    for (let page = 0; page < 3; page++) {
      if (targetTotal > 0 && usersMap.size >= targetTotal) break;

      let url = `/api/v1/friendships/${userId}/${type}/?query=${encodeURIComponent(char)}&count=50`;
      if (maxId) url += `&max_id=${encodeURIComponent(maxId)}`;

      let pageUsers = [];
      let nextCursor = null;

      try {
        let res = await fetch(url, {
          headers: { ...headers, 'User-Agent': navigator.userAgent },
          credentials: 'include'
        });

        if (res.status === 429) {
          console.warn(`[InSnitch] Rate-limit (429) na busca da letra "${char}". Aguardando 3s...`);
          if (onProgress) {
            onProgress(type, usersMap.size, targetTotal, `Pausa anti-bloqueio na letra "${char.toUpperCase()}" (3s)...`);
          }
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }

        if (res.ok) {
          const data = await res.json();
          pageUsers = data.users || [];
          nextCursor = data.next_max_id;
        }
      } catch (err) {
        console.warn(`[InSnitch] Erro na busca por "${char}":`, err);
      }

      if (pageUsers.length === 0) break;

      let addedInPage = 0;
      for (const u of pageUsers) {
        const clean = (u.username || "").toLowerCase().trim();
        if (clean && !usersMap.has(clean)) {
          usersMap.set(clean, {
            username: u.username,
            full_name: u.full_name || "",
            profile_pic_url: u.profile_pic_url || "",
            is_verified: u.is_verified || false
          });
          addedInPage++;
        }
      }

      if (onProgress) {
        onProgress(
          type, 
          usersMap.size, 
          targetTotal, 
          `Fase 2: Pescando letra "${char.toUpperCase()}" (${usersMap.size}/${targetTotal} catalogados)...`
        );
      }

      maxId = nextCursor;
      if (!maxId || addedInPage === 0) break;

      await new Promise(r => setTimeout(r, delayMs));
    }

    await new Promise(r => setTimeout(r, delayMs));
  }
}

// 5. Floating On-Screen Progress Banner
function updateFloatingBanner(message, percent = null, isDone = false, isError = false) {
  let banner = document.getElementById("insnitch-floating-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "insnitch-floating-banner";
    banner.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #121212;
      border: 1px solid #333333;
      border-radius: 14px;
      padding: 14px 18px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 320px;
      max-width: 420px;
      animation: insnitchSlideIn 0.3s ease-out;
    `;

    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes insnitchSlideIn {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(banner);
  }

  const icon = isDone ? '✓' : isError ? '⚠' : '⚡';
  const iconColor = isDone ? '#20c997' : isError ? '#ed4956' : '#0095f6';

  let progressHtml = '';
  if (percent !== null && !isDone && !isError) {
    progressHtml = `
      <div style="width: 100%; height: 6px; background: #262626; border-radius: 3px; overflow: hidden; margin-top: 4px;">
        <div style="width: ${Math.min(100, Math.max(0, percent))}%; height: 100%; background: linear-gradient(90deg, #0095f6, #20c997); transition: width 0.3s;"></div>
      </div>
    `;
  }

  banner.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: ${iconColor}; color: white; font-weight: bold; font-size: 12px;">${icon}</span>
        <span style="font-weight: 700; font-size: 13px; color: #f5f5f5;">InSnitch Radar</span>
      </div>
      ${!isDone ? `<button id="btn-cancel-insnitch" style="background: none; border: none; color: #888; cursor: pointer; font-size: 12px;">✕</button>` : ''}
    </div>
    <div style="font-size: 12px; color: ${isError ? '#ed4956' : '#cccccc'}; line-height: 1.4;">
      ${message}
    </div>
    ${progressHtml}
  `;

  const btnCancel = banner.querySelector("#btn-cancel-insnitch");
  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      banner.remove();
    });
  }

  if (isDone) {
    setTimeout(() => {
      if (banner) banner.remove();
    }, 5000);
  }
}

// 6. Message Listener from Popup
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

        updateFloatingBanner("Iniciando coleta completa de seguidores...", 0);
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Obtendo dados do perfil..." });
        const profileInfo = await extractProfileInfo(username);

        if (!profileInfo.id) {
          updateFloatingBanner(`Não foi possível obter o ID de @${username}. Recarregue a página (F5).`, null, false, true);
          sendResponse({ 
            success: false, 
            error: `Não foi possível obter o ID de @${username}. Recarregue a aba do Instagram (F5) e tente novamente.` 
          });
          return;
        }

        const scanOptions = request.options || {};
        const expectedFollowers = profileInfo.followers_count || 0;
        const expectedFollowing = profileInfo.following_count || 0;
        const followersMap = new Map();

        // -------------------------------------------------------------
        // FASE 1: Coleta Principal por Cursor de Seguidores
        // -------------------------------------------------------------
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Fase 1: Coletando lista principal de seguidores..." });
        updateFloatingBanner("Fase 1: Coletando lista principal de seguidores...", 10);

        const phase1Followers = await fetchUserList(
          profileInfo.id, 
          "followers", 
          expectedFollowers, 
          (type, count, total, extraMsg) => {
            const perc = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : null;
            const msg = extraMsg || `Fase 1: Coletando seguidores: ${count}${total ? ` de ${total}` : ''}${perc ? ` (${perc}%)` : ''}...`;
            chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
            updateFloatingBanner(msg, perc);
          }, 
          scanOptions
        );

        for (const u of phase1Followers) {
          const clean = (u.username || "").toLowerCase().trim();
          if (clean) followersMap.set(clean, u);
        }

        console.log(`[InSnitch] Fase 1 finalizada: ${followersMap.size}/${expectedFollowers} seguidores catalogados.`);

        // -------------------------------------------------------------
        // FASE 2: Varredura Alfabética A-Z (se ainda faltar seguidores)
        // -------------------------------------------------------------
        if (expectedFollowers > 1000 && followersMap.size < expectedFollowers) {
          const remaining = expectedFollowers - followersMap.size;
          console.log(`[InSnitch] Ativando Fase 2 (A-Z) para pescar ${remaining} seguidores restantes...`);
          
          chrome.runtime.sendMessage({ 
            action: "UPDATE_STATUS", 
            message: `Fase 2: Pescando ${remaining} seguidores restantes por ordem alfabética (A-Z)...` 
          });
          updateFloatingBanner(`Fase 2: Pescando ${remaining} seguidores restantes por ordem alfabética (A-Z)...`, Math.round((followersMap.size / expectedFollowers) * 100));

          await fetchAlphabeticalUsers(
            profileInfo.id,
            "followers",
            followersMap,
            expectedFollowers,
            (type, count, total, msg) => {
              const perc = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : null;
              chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
              updateFloatingBanner(msg, perc);
            },
            scanOptions
          );
        }

        // -------------------------------------------------------------
        // FASE 3: Coleta de Seguidos (Following)
        // -------------------------------------------------------------
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de seguidos..." });
        updateFloatingBanner("Coletando lista de quem o perfil segue...", 90);

        const followingList = await fetchUserList(
          profileInfo.id, 
          "following", 
          expectedFollowing, 
          (type, count, total, extraMsg) => {
            const perc = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : null;
            const msg = extraMsg || `Coletando seguindo: ${count}${total ? ` de ${total}` : ''}${perc ? ` (${perc}%)` : ''}...`;
            chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
            updateFloatingBanner(msg, perc);
          }, 
          scanOptions
        );

        const followersList = Array.from(followersMap.values());

        // Safeguards
        if (profileInfo.is_private && followersList.length === 0 && profileInfo.followers_count > 0) {
          updateFloatingBanner(`Perfil privado restrito pelo Instagram.`, null, false, true);
          sendResponse({ 
            success: false, 
            error: `Este perfil é privado (@${profileInfo.username}) e o Instagram restringe a lista de seguidores para quem não o segue.` 
          });
          return;
        }

        if (profileInfo.followers_count > 10 && followersList.length === 0) {
          updateFloatingBanner(`Instagram não retornou seguidores.`, null, false, true);
          sendResponse({ 
            success: false, 
            error: `O Instagram não retornou a lista de seguidores. Aguarde alguns segundos e tente novamente.` 
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
            followers_count: profileInfo.followers_count || followersList.length,
            following_count: profileInfo.following_count || followingList.length
          },
          followers: followersList,
          following: followingList,
          followers_count: profileInfo.followers_count || followersList.length,
          following_count: profileInfo.following_count || followingList.length,
          posts_count: profileInfo.posts_count
        };

        updateFloatingBanner(`✓ Coleta Concluída! ${followersList.length} seguidores salvos!`, 100, true);
        sendResponse({ success: true, data: packageData });

      } catch (err) {
        console.error("[InSnitch] Erro na extração:", err);
        updateFloatingBanner(`Erro: ${err.message}`, null, false, true);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }
});

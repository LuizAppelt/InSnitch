// State
let currentProfile = null;
let currentDiff = null;
let currentHistoryEvents = null;
let changesViewMode = 'all_time'; // 'all_time' or 'latest'
let sortOrder = 'recent'; // 'recent' | 'alpha_asc' | 'alpha_desc'
let currentReciprocity = { not_following_back: [], fans: [], mutual: [], verified: [], ghosts: [] };
let chartInstance = null;
let isScanning = false;
let allProfilesList = [];

// DOM Elements
const avatarRing = document.getElementById("avatar-ring");
const profileAvatar = document.getElementById("profile-avatar");
const profileUsername = document.getElementById("profile-username");
const profileFullname = document.getElementById("profile-fullname");
const profileBio = document.getElementById("profile-bio");
const verifiedBadge = document.getElementById("verified-badge");
const statPosts = document.getElementById("stat-posts");
const statFollowers = document.getElementById("stat-followers");
const statFollowing = document.getElementById("stat-following");
const statLastScan = document.getElementById("stat-last-scan");

// Metrics Hub Elements
const metricNewFollowers = document.getElementById("metric-new-followers");
const metricLostFollowers = document.getElementById("metric-lost-followers");
const metricNewFollowing = document.getElementById("metric-new-following");
const metricLostFollowing = document.getElementById("metric-lost-following");
const metricMutual = document.getElementById("metric-mutual");
const metricNotFollowingBack = document.getElementById("metric-not-following-back");
const metricFans = document.getElementById("metric-fans");
const metricVerified = document.getElementById("metric-verified");
const metricGhosts = document.getElementById("metric-ghosts");

// Badges & Lists Elements
const badgeCountNew = document.getElementById("badge-count-new");
const badgeCountLost = document.getElementById("badge-count-lost");
const badgeCountNewFollowing = document.getElementById("badge-count-new-following");
const badgeCountLostFollowing = document.getElementById("badge-count-lost-following");
const listNewFollowers = document.getElementById("list-new-followers");
const listLostFollowers = document.getElementById("list-lost-followers");
const listNewFollowing = document.getElementById("list-new-following");
const listLostFollowing = document.getElementById("list-lost-following");
const listMutual = document.getElementById("list-mutual");
const listNotFollowingBack = document.getElementById("list-not-following-back");
const listFans = document.getElementById("list-fans");
const listVerified = document.getElementById("list-verified");
const listGhosts = document.getElementById("list-ghosts");
const aiOutputContainer = document.getElementById("ai-output-container");
const aiSpinner = document.getElementById("ai-spinner");

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  lucide.createIcons();
  await loadSettings();
  await loadProfilesList();
});

// Theme Toggle
function initTheme() {
  const savedTheme = localStorage.getItem("insnitch_theme") || "dark";
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  updateThemeUI();
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("insnitch_theme", isDark ? "dark" : "light");
  updateThemeUI();
  if (chartInstance && currentProfile) {
    loadChart(currentProfile.username);
  }
}

function updateThemeUI() {
  const isDark = document.documentElement.classList.contains("dark");
  const themeIcon = document.getElementById("theme-icon");
  const themeText = document.getElementById("theme-text");
  
  if (themeIcon) {
    if (isDark) {
      themeIcon.setAttribute("data-lucide", "sun");
      if (themeText) themeText.innerText = "Modo Claro";
    } else {
      themeIcon.setAttribute("data-lucide", "moon");
      if (themeText) themeText.innerText = "Modo Escuro";
    }
  }
  lucide.createIcons();
}

// Load Settings from Backend
async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    if (data) {
      if (data.has_gemini_key) {
        const input = document.getElementById("setting-gemini-key");
        if (input) input.placeholder = "Chave configurada (" + data.gemini_api_key_masked + ")";
      }
    }
  } catch (e) {
    console.error("Erro ao carregar configurações:", e);
  }
}

// Multi-Profile Management
async function loadProfilesList(selectUsername = null) {
  try {
    const res = await fetch("/api/profiles");
    const data = await res.json();
    allProfilesList = data.profiles || [];

    const select = document.getElementById("select-active-profile");
    const emptyView = document.getElementById("empty-state-view");
    const dashView = document.getElementById("dashboard-main-content");
    const btnDelete = document.getElementById("btn-delete-profile");

    if (allProfilesList.length === 0) {
      if (emptyView) emptyView.classList.remove("hidden");
      if (dashView) dashView.classList.add("hidden");
      if (btnDelete) btnDelete.classList.add("hidden");
      if (select) select.innerHTML = '<option value="">Nenhum perfil sincronizado</option>';
      currentProfile = null;
      return;
    }

    if (emptyView) emptyView.classList.add("hidden");
    if (dashView) dashView.classList.remove("hidden");
    if (btnDelete) btnDelete.classList.remove("hidden");

    let targetUsername = selectUsername;
    if (!targetUsername && currentProfile) {
      targetUsername = currentProfile.username;
    }
    if (!targetUsername || !allProfilesList.some(p => p.username === targetUsername)) {
      targetUsername = allProfilesList[0].username;
    }

    if (select) {
      select.innerHTML = allProfilesList.map(p => {
        const snapCount = p.total_snapshots || 0;
        return `<option value="${p.username}" ${p.username === targetUsername ? 'selected' : ''}>@${p.username} (${snapCount} ${snapCount === 1 ? 'varredura' : 'varreduras'})</option>`;
      }).join('');
    }

    await fetchProfileDiff(targetUsername);
  } catch (err) {
    console.error("Erro ao carregar lista de perfis:", err);
  }
}

async function switchActiveProfile(username) {
  if (!username) return;
  await fetchProfileDiff(username);
}

// Delete Profile Confirmation
function confirmDeleteCurrentProfile() {
  if (!currentProfile) return;
  const modal = document.getElementById("delete-profile-modal");
  const targetName = document.getElementById("delete-target-username");
  if (targetName) targetName.innerText = `@${currentProfile.username}`;
  if (modal) modal.classList.remove("hidden");
}

function closeDeleteModal() {
  const modal = document.getElementById("delete-profile-modal");
  if (modal) modal.classList.add("hidden");
}

async function executeDeleteCurrentProfile() {
  if (!currentProfile) return;
  const usernameToDelete = currentProfile.username;
  closeDeleteModal();

  try {
    const res = await fetch(`/api/profiles/${usernameToDelete}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast(`Perfil @${usernameToDelete} excluído com sucesso.`, "success");
      currentProfile = null;
      await loadProfilesList();
    } else {
      showToast(data.detail || "Erro ao excluir perfil.", "error");
    }
  } catch (err) {
    showToast(`Erro ao excluir perfil: ${err.message}`, "error");
  }
}

// Fetch Profile Diff & History
async function fetchProfileDiff(username) {
  try {
    setScanningState(true);
    const res = await fetch(`/api/profiles/${username}/diff`);
    const data = await res.json();
    if (res.ok) {
      currentProfile = data.profile;
      currentDiff = data.diff;
      currentHistoryEvents = data.history_events || null;
      currentReciprocity = data.diff.reciprocity;

      renderProfileHeader(data.profile);
      renderMetrics(data.diff);
      renderSnapshotHistoryDropdown(data.history_events?.snapshots || []);
      renderDiffs(data.diff);
      renderReciprocityLists();
      renderAiReport(data.ai_report);
      loadChart(data.profile.username);

      const select = document.getElementById("select-active-profile");
      if (select) select.value = data.profile.username;
    }
  } catch (e) {
    console.error("Erro ao buscar diff:", e);
  } finally {
    setScanningState(false);
  }
}

// UI State & Spinners
function setScanningState(scanning) {
  isScanning = scanning;
  if (avatarRing) {
    if (scanning) {
      avatarRing.classList.add("scanning");
    } else {
      avatarRing.classList.remove("scanning");
    }
  }
}

function handleAvatarError(img) {
  img.onerror = null; // Prevent loop
  if (!img.dataset.proxied && img.src && !img.src.includes('/api/image-proxy')) {
    img.dataset.proxied = "true";
    img.src = `/api/image-proxy?url=${encodeURIComponent(img.src)}`;
  } else {
    img.src = `https://ui-avatars.com/api/?name=${(currentProfile && currentProfile.username) || 'IG'}&background=0095f6&color=fff&size=300`;
  }
}

function handleRowImageError(img, username) {
  img.onerror = null; // Prevent loop
  img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff&size=150`;
}

// Render Profile Header
function renderProfileHeader(profile) {
  profileUsername.innerText = `@${profile.username}`;
  profileFullname.innerText = profile.full_name || `@${profile.username}`;
  profileBio.innerText = profile.biography || "Nenhuma biografia informada.";
  
  if (profile.profile_pic_url) {
    profileAvatar.removeAttribute("data-proxied");
    profileAvatar.src = profile.profile_pic_url;
  } else {
    profileAvatar.src = `https://ui-avatars.com/api/?name=${profile.username}&background=0095f6&color=fff&size=300`;
  }
  
  if (profile.is_verified) {
    verifiedBadge.classList.remove("hidden");
  } else {
    verifiedBadge.classList.add("hidden");
  }

  const now = new Date();
  statLastScan.innerText = `Última checagem: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
}

// Render Metrics & Pills
function renderMetrics(diff) {
  const counts = diff.counts || {};
  statPosts.innerText = (currentProfile && currentProfile.posts_count != null) ? currentProfile.posts_count : (counts.posts_count || 0);
  statFollowers.innerText = (counts.total_followers || 0).toLocaleString();
  statFollowing.innerText = (counts.total_following || 0).toLocaleString();

  const newCount = counts.new_followers_count || 0;
  const lostCount = counts.lost_followers_count || 0;
  const newFollowingCount = counts.new_following_count || 0;
  const lostFollowingCount = counts.lost_following_count || 0;

  metricNewFollowers.innerText = `+${newCount}`;
  metricLostFollowers.innerText = `-${lostCount}`;
  if (metricNewFollowing) metricNewFollowing.innerText = `+${newFollowingCount}`;
  if (metricLostFollowing) metricLostFollowing.innerText = `-${lostFollowingCount}`;
  if (metricMutual) metricMutual.innerText = (counts.mutual_count || 0).toLocaleString();
  metricNotFollowingBack.innerText = (counts.not_following_back_count || 0).toLocaleString();
  metricFans.innerText = (counts.fans_count || 0).toLocaleString();
  if (metricVerified) metricVerified.innerText = (counts.verified_followers_count || 0).toLocaleString();
  if (metricGhosts) metricGhosts.innerText = (counts.ghost_followers_count || 0).toLocaleString();

  badgeCountNew.innerText = newCount;
  badgeCountLost.innerText = lostCount;
  if (badgeCountNewFollowing) badgeCountNewFollowing.innerText = newFollowingCount;
  if (badgeCountLostFollowing) badgeCountLostFollowing.innerText = lostFollowingCount;
}

// Date Formatter Helper
function formatEventDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return `${d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} às ${d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`;
}

// Render User Row Item Helper
function createUserRowHtml(user, badgeType) {
  const rawAvatar = user.profile_pic_url;
  const avatar = rawAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&color=fff`;
  
  let badgeHtml = '';
  if (badgeType === 'new') {
    badgeHtml = '<span class="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">+ Novo Seguidor</span>';
  } else if (badgeType === 'lost') {
    badgeHtml = '<span class="text-[10px] font-bold bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">- Deixou de Seguir</span>';
  } else if (badgeType === 'new_following') {
    badgeHtml = '<span class="text-[10px] font-bold bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">+ Você Seguiu</span>';
  } else if (badgeType === 'lost_following') {
    badgeHtml = '<span class="text-[10px] font-bold bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full">- Você deu Unfollow</span>';
  } else if (badgeType === 'verified') {
    badgeHtml = '<span class="text-[10px] font-bold bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">💎 Verificado</span>';
  } else if (badgeType === 'ghost') {
    badgeHtml = '<span class="text-[10px] font-bold bg-zinc-500/10 text-zinc-400 px-2 py-0.5 rounded-full">👻 Fantasma</span>';
  }

  const timestampHtml = user.event_timestamp ? `
    <span class="text-[10px] text-ig-grayText block mt-0.5 font-normal flex items-center gap-1">
      <i data-lucide="clock" class="w-3 h-3 text-ig-grayText/70 inline"></i>
      <span>Detectado em ${formatEventDate(user.event_timestamp)}</span>
    </span>
  ` : '';

  return `
    <div class="user-row flex items-center justify-between p-2.5 rounded-xl bg-ig-lightHover/50 dark:bg-ig-darkHover/50 border border-ig-lightBorder/50 dark:border-ig-darkBorder/50">
      <div class="flex items-center gap-3 min-w-0">
        <img src="${avatar}" alt="${user.username}" loading="lazy" referrerpolicy="no-referrer" onerror="handleRowImageError(this, '${user.username}')" class="w-10 h-10 rounded-full object-cover border border-ig-lightBorder dark:border-ig-darkBorder flex-shrink-0" />
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-semibold text-xs truncate">@${user.username}</span>
            ${user.is_verified ? '<span class="text-ig-primary"><svg class="w-3.5 h-3.5 fill-current inline" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span>' : ''}
          </div>
          <p class="text-[11px] text-ig-grayText truncate">${user.full_name || 'Usuário do Instagram'}</p>
          ${timestampHtml}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        ${badgeHtml}
        <a href="https://instagram.com/${user.username}" target="_blank" class="text-ig-grayText hover:text-ig-primary p-1.5 rounded-lg hover:bg-ig-lightBorder dark:hover:bg-ig-darkBorder transition" title="Ver no Instagram">
          <i data-lucide="external-link" class="w-4 h-4"></i>
        </a>
      </div>
    </div>
  `;
}

// Sorting Helper
function applySort(items) {
  if (!items || !items.length) return [];
  const copy = [...items];
  if (sortOrder === 'alpha_asc') {
    copy.sort((a, b) => a.username.localeCompare(b.username));
  } else if (sortOrder === 'alpha_desc') {
    copy.sort((a, b) => b.username.localeCompare(a.username));
  }
  return copy;
}

function onSortOrderChange(order) {
  sortOrder = order;
  document.querySelectorAll('.sort-select').forEach(sel => sel.value = order);
  renderReciprocityLists();
  renderDiffs(currentDiff);
}

// Render Diffs Tab (With All-Time Cumulative vs Single Scan support)
function renderDiffs(diff) {
  let newFollowers = [];
  let lostFollowers = [];
  let newFollowing = [];
  let lostFollowing = [];

  const isAllTime = (changesViewMode === 'all_time') && currentHistoryEvents && (currentHistoryEvents.snapshots?.length > 1);

  if (isAllTime) {
    newFollowers = applySort(currentHistoryEvents.all_time_events?.new_followers || []);
    lostFollowers = applySort(currentHistoryEvents.all_time_events?.lost_followers || []);
    newFollowing = applySort(currentHistoryEvents.all_time_events?.new_following || []);
    lostFollowing = applySort(currentHistoryEvents.all_time_events?.lost_following || []);

    if (badgeCountNew) badgeCountNew.innerText = newFollowers.length;
    if (badgeCountLost) badgeCountLost.innerText = lostFollowers.length;
    if (badgeCountNewFollowing) badgeCountNewFollowing.innerText = newFollowing.length;
    if (badgeCountLostFollowing) badgeCountLostFollowing.innerText = lostFollowing.length;
  } else {
    newFollowers = applySort(diff?.diffs?.new_followers || []);
    lostFollowers = applySort(diff?.diffs?.lost_followers || []);
    newFollowing = applySort(diff?.diffs?.new_following || []);
    lostFollowing = applySort(diff?.diffs?.lost_following || []);

    if (badgeCountNew) badgeCountNew.innerText = newFollowers.length;
    if (badgeCountLost) badgeCountLost.innerText = lostFollowers.length;
    if (badgeCountNewFollowing) badgeCountNewFollowing.innerText = newFollowing.length;
    if (badgeCountLostFollowing) badgeCountLostFollowing.innerText = lostFollowing.length;
  }

  // 1. Novos Seguidores
  if (newFollowers.length === 0) {
    listNewFollowers.innerHTML = `
      <div class="text-center py-6 text-ig-grayText text-xs">
        <i data-lucide="check-circle" class="w-5 h-5 mx-auto mb-1.5 opacity-50 text-emerald-500"></i>
        <p>${isAllTime ? 'Nenhum novo seguidor no histórico.' : 'Nenhum novo seguidor nesta varredura.'}</p>
      </div>
    `;
  } else {
    listNewFollowers.innerHTML = newFollowers.map(u => createUserRowHtml(u, 'new')).join('');
  }

  // 2. Deixaram de Seguir
  if (lostFollowers.length === 0) {
    listLostFollowers.innerHTML = `
      <div class="text-center py-6 text-ig-grayText text-xs">
        <i data-lucide="smile" class="w-5 h-5 mx-auto mb-1.5 opacity-50 text-rose-500"></i>
        <p>${isAllTime ? 'Nenhum unfollow registrado no histórico.' : 'Nenhum unfollow recebido nesta varredura.'}</p>
      </div>
    `;
  } else {
    listLostFollowers.innerHTML = lostFollowers.map(u => createUserRowHtml(u, 'lost')).join('');
  }

  // 3. Começou a Seguir
  if (listNewFollowing) {
    if (newFollowing.length === 0) {
      listNewFollowing.innerHTML = `
        <div class="text-center py-6 text-ig-grayText text-xs">
          <i data-lucide="user-plus" class="w-5 h-5 mx-auto mb-1.5 opacity-50 text-blue-500"></i>
          <p>${isAllTime ? 'Nenhum perfil seguido no histórico.' : 'Você não começou a seguir ninguém.'}</p>
        </div>
      `;
    } else {
      listNewFollowing.innerHTML = newFollowing.map(u => createUserRowHtml(u, 'new_following')).join('');
    }
  }

  // 4. Você Deixou de Seguir
  if (listLostFollowing) {
    if (lostFollowing.length === 0) {
      listLostFollowing.innerHTML = `
        <div class="text-center py-6 text-ig-grayText text-xs">
          <i data-lucide="check" class="w-5 h-5 mx-auto mb-1.5 opacity-50 text-orange-500"></i>
          <p>${isAllTime ? 'Nenhum unfollow seu no histórico.' : 'Você não deu unfollow em ninguém.'}</p>
        </div>
      `;
    } else {
      listLostFollowing.innerHTML = lostFollowing.map(u => createUserRowHtml(u, 'lost_following')).join('');
    }
  }

  lucide.createIcons();
}

function setChangesViewMode(mode) {
  changesViewMode = mode;
  const btnAll = document.getElementById("btn-mode-all-time");
  const btnLatest = document.getElementById("btn-mode-latest");
  const selectSnap = document.getElementById("select-snapshot-history");

  if (mode === 'all_time') {
    if (btnAll) {
      btnAll.className = "px-3 py-1 rounded-lg text-[11px] font-semibold transition bg-ig-primary text-white shadow-sm";
    }
    if (btnLatest) {
      btnLatest.className = "px-3 py-1 rounded-lg text-[11px] font-semibold text-ig-grayText hover:text-ig-darkText dark:hover:text-white transition";
    }
    if (selectSnap) selectSnap.value = "all";
    renderDiffs(currentDiff);
  } else {
    if (btnAll) {
      btnAll.className = "px-3 py-1 rounded-lg text-[11px] font-semibold text-ig-grayText hover:text-ig-darkText dark:hover:text-white transition";
    }
    if (btnLatest) {
      btnLatest.className = "px-3 py-1 rounded-lg text-[11px] font-semibold transition bg-ig-primary text-white shadow-sm";
    }
    renderDiffs(currentDiff);
  }
}

function renderSnapshotHistoryDropdown(snapshots) {
  const select = document.getElementById("select-snapshot-history");
  if (!select) return;

  if (!snapshots || snapshots.length <= 1) {
    select.innerHTML = '<option value="all">Todas as Varreduras (Acumulado)</option>';
    return;
  }

  let html = '<option value="all">Todas as Varreduras (Acumulado)</option>';
  snapshots.forEach((s, idx) => {
    const d = new Date(s.timestamp);
    const dateStr = !isNaN(d.getTime()) ? `${d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} às ${d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}` : s.timestamp;
    const num = snapshots.length - idx;
    html += `<option value="${s.id}">Varredura #${num} — ${dateStr} (${s.followers_count} seguidores)</option>`;
  });
  select.innerHTML = html;
}

async function onSnapshotSelectChange(val) {
  if (val === 'all') {
    setChangesViewMode('all_time');
    return;
  }

  if (!currentProfile) return;

  try {
    const res = await fetch(`/api/profiles/${currentProfile.username}/snapshots/${val}/diff`);
    const data = await res.json();
    if (res.ok && data.diff) {
      changesViewMode = 'latest';
      const btnAll = document.getElementById("btn-mode-all-time");
      const btnLatest = document.getElementById("btn-mode-latest");
      if (btnAll) btnAll.className = "px-3 py-1 rounded-lg text-[11px] font-semibold text-ig-grayText hover:text-ig-darkText dark:hover:text-white transition";
      if (btnLatest) btnLatest.className = "px-3 py-1 rounded-lg text-[11px] font-semibold transition bg-ig-primary text-white shadow-sm";

      renderDiffs(data.diff);
    }
  } catch (e) {
    console.error("Erro ao carregar snapshot:", e);
  }
}

// Render Reciprocity Lists
function renderReciprocityLists() {
  filterReciprocityList('mutual');
  filterReciprocityList('not_following_back');
  filterReciprocityList('fans');
  filterReciprocityList('verified');
  filterReciprocityList('ghosts');
}

function filterReciprocityList(type) {
  if (type === 'mutual' && listMutual) {
    const searchVal = (document.getElementById("search-mutual")?.value || "").toLowerCase();
    const list = (currentReciprocity.mutual || []).filter(u => 
      u.username.toLowerCase().includes(searchVal) || (u.full_name && u.full_name.toLowerCase().includes(searchVal))
    );
    const sorted = applySort(list);

    if (sorted.length === 0) {
      listMutual.innerHTML = `
        <div class="col-span-full text-center py-8 text-ig-grayText text-xs">
          <i data-lucide="users" class="w-6 h-6 mx-auto mb-2 opacity-50 text-cyan-500"></i>
          <p>Nenhum amigo mútuo encontrado.</p>
        </div>
      `;
    } else {
      listMutual.innerHTML = sorted.map(u => createUserRowHtml(u, null)).join('');
    }
  } else if (type === 'not_following_back' && listNotFollowingBack) {
    const searchVal = (document.getElementById("search-not-following")?.value || "").toLowerCase();
    const list = (currentReciprocity.not_following_back || []).filter(u => 
      u.username.toLowerCase().includes(searchVal) || (u.full_name && u.full_name.toLowerCase().includes(searchVal))
    );
    const sorted = applySort(list);

    if (sorted.length === 0) {
      listNotFollowingBack.innerHTML = `
        <div class="col-span-full text-center py-8 text-ig-grayText text-xs">
          <i data-lucide="check" class="w-6 h-6 mx-auto mb-2 opacity-50 text-amber-500"></i>
          <p>Tudo certo! Nenhuma conta encontrada para o filtro.</p>
        </div>
      `;
    } else {
      listNotFollowingBack.innerHTML = sorted.map(u => createUserRowHtml(u, null)).join('');
    }
  } else if (type === 'fans' && listFans) {
    const searchVal = (document.getElementById("search-fans")?.value || "").toLowerCase();
    const list = (currentReciprocity.fans || []).filter(u => 
      u.username.toLowerCase().includes(searchVal) || (u.full_name && u.full_name.toLowerCase().includes(searchVal))
    );
    const sorted = applySort(list);

    if (sorted.length === 0) {
      listFans.innerHTML = `
        <div class="col-span-full text-center py-8 text-ig-grayText text-xs">
          <p>Nenhum fã correspondente encontrado.</p>
        </div>
      `;
    } else {
      listFans.innerHTML = sorted.map(u => createUserRowHtml(u, null)).join('');
    }
  } else if (type === 'verified' && listVerified) {
    const searchVal = (document.getElementById("search-verified")?.value || "").toLowerCase();
    const list = (currentReciprocity.verified_followers || currentReciprocity.verified || []).filter(u => 
      u.username.toLowerCase().includes(searchVal) || (u.full_name && u.full_name.toLowerCase().includes(searchVal))
    );
    const sorted = applySort(list);

    if (sorted.length === 0) {
      listVerified.innerHTML = `
        <div class="col-span-full text-center py-8 text-ig-grayText text-xs">
          <i data-lucide="badge-check" class="w-6 h-6 mx-auto mb-2 opacity-50 text-blue-500"></i>
          <p>Nenhum seguidor verificado (selo azul) encontrado.</p>
        </div>
      `;
    } else {
      listVerified.innerHTML = sorted.map(u => createUserRowHtml(u, 'verified')).join('');
    }
  } else if (type === 'ghosts' && listGhosts) {
    const searchVal = (document.getElementById("search-ghosts")?.value || "").toLowerCase();
    const list = (currentReciprocity.ghost_followers || currentReciprocity.ghosts || []).filter(u => 
      u.username.toLowerCase().includes(searchVal) || (u.full_name && u.full_name.toLowerCase().includes(searchVal))
    );
    const sorted = applySort(list);

    if (sorted.length === 0) {
      listGhosts.innerHTML = `
        <div class="col-span-full text-center py-8 text-ig-grayText text-xs">
          <i data-lucide="smile" class="w-6 h-6 mx-auto mb-2 opacity-50 text-emerald-500"></i>
          <p>Ótimo! Sua base não possui seguidores com perfil fantasma/sem foto.</p>
        </div>
      `;
    } else {
      listGhosts.innerHTML = sorted.map(u => createUserRowHtml(u, 'ghost')).join('');
    }
  }
  lucide.createIcons();
}

// Render Chart with Chart.js
async function loadChart(username) {
  try {
    const res = await fetch(`/api/profiles/${username}/history`);
    const data = await res.json();
    if (!res.ok || !data.chart_data) return;

    const ctx = document.getElementById("followerChart").getContext("2d");
    const isDark = document.documentElement.classList.contains("dark");

    const labels = data.chart_data.labels.map(t => {
      const d = new Date(t);
      return `${d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} ${d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`;
    });

    const followerCounts = data.chart_data.followers;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(0, 149, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 149, 246, 0.0)');

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Seguidores',
          data: followerCounts,
          borderColor: '#0095f6',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#0095f6',
          pointBorderColor: isDark ? '#121212' : '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            titleColor: isDark ? '#ffffff' : '#262626',
            bodyColor: isDark ? '#a8a8a8' : '#737373',
            borderColor: isDark ? '#262626' : '#dbdbdb',
            borderWidth: 1,
            padding: 10,
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: { color: isDark ? '#262626' : '#efefef' },
            ticks: { color: '#8e8e8e', font: { size: 10 } }
          },
          y: {
            grid: { color: isDark ? '#262626' : '#efefef' },
            ticks: { color: '#8e8e8e', font: { size: 10 } }
          }
        }
      }
    });
  } catch (e) {
    console.error("Erro ao renderizar gráfico:", e);
  }
}

// Render AI Report
function renderAiReport(text) {
  if (!text) {
    aiOutputContainer.innerHTML = "<p class='text-ig-grayText'>Nenhuma análise gerada ainda. Clique em 'Analisar com IA' para gerar.</p>";
    return;
  }

  // Simple Markdown to HTML parser
  let html = text
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mt-4 mb-2">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 class="text-sm font-semibold mt-3 mb-1">$1</h4>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-purple-500 pl-3 my-2 text-xs italic bg-purple-500/5 p-2 rounded-r-lg">$1</blockquote>')
    .replace(/^\* (.*$)/gim, '<li class="text-xs ml-4 my-1">$1</li>')
    .replace(/\n/gim, '<br />');

  aiOutputContainer.innerHTML = html;
}

async function requestFreshAiReport() {
  if (!currentProfile) return;
  try {
    aiSpinner.classList.add("animate-spin");
    const res = await fetch(`/api/profiles/${currentProfile.username}/ai-report`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      renderAiReport(data.ai_report);
      showToast("Análise com Gemini IA atualizada!", "success");
    }
  } catch (e) {
    showToast("Erro ao gerar relatório com IA", "error");
  } finally {
    aiSpinner.classList.remove("animate-spin");
  }
}

// Tab Switching
function switchTab(tabId) {
  // Hide all contents
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

  // Show selected content
  const targetContent = document.getElementById(tabId);
  if (targetContent) targetContent.classList.remove("hidden");

  // Activate button
  const targetBtn = document.getElementById(`btn-${tabId}`);
  if (targetBtn) targetBtn.classList.add("active");

  if (tabId === 'tab-chart' && currentProfile) {
    loadChart(currentProfile.username);
  }
}

// Switch between Main Views (Dashboard vs Saved Profiles)
function switchMainView(view) {
  const profileSection = document.getElementById("profile-header-section");
  const metricsSection = document.getElementById("metrics-hub-section");
  const tabsNav = document.getElementById("tabs-nav-container");
  const tabContents = document.querySelectorAll(".tab-content");
  const savedProfilesView = document.getElementById("saved-profiles-view");
  const navDash = document.getElementById("nav-dashboard");
  const navHist = document.getElementById("nav-history");

  if (view === 'dashboard') {
    if (profileSection) profileSection.classList.remove("hidden");
    if (metricsSection) metricsSection.classList.remove("hidden");
    if (tabsNav) tabsNav.classList.remove("hidden");
    switchTab("tab-changes");
    if (savedProfilesView) savedProfilesView.classList.add("hidden");
    if (navDash) navDash.classList.add("active");
    if (navHist) navHist.classList.remove("active");
  } else if (view === 'history') {
    if (profileSection) profileSection.classList.add("hidden");
    if (metricsSection) metricsSection.classList.add("hidden");
    if (tabsNav) tabsNav.classList.add("hidden");
    tabContents.forEach(el => el.classList.add("hidden"));
    if (savedProfilesView) savedProfilesView.classList.remove("hidden");
    if (navDash) navDash.classList.remove("active");
    if (navHist) navHist.classList.add("active");
    loadSavedProfilesList();
  }
}

async function loadSavedProfilesList() {
  const grid = document.getElementById("profiles-grid");
  grid.innerHTML = '<p class="text-xs text-ig-grayText col-span-full">Carregando perfis salvos...</p>';
  try {
    const res = await fetch("/api/profiles");
    const data = await res.json();
    if (!data.profiles || data.profiles.length === 0) {
      grid.innerHTML = '<p class="text-xs text-ig-grayText col-span-full">Nenhum perfil rastreado ainda.</p>';
      return;
    }

    grid.innerHTML = data.profiles.map(p => `
      <div onclick="selectProfileFromList('${p.username}')" class="bg-ig-lightCard dark:bg-ig-darkCard border border-ig-lightBorder dark:border-ig-darkBorder p-4 rounded-2xl cursor-pointer hover:border-ig-primary transition flex items-center gap-4">
        <img src="${p.profile_pic_url || 'https://ui-avatars.com/api/?name=' + p.username}" class="w-12 h-12 rounded-full object-cover border border-ig-lightBorder dark:border-ig-darkBorder" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1">
            <span class="font-semibold text-xs truncate">@${p.username}</span>
            ${p.is_verified ? '<span class="text-ig-primary text-xs">✓</span>' : ''}
          </div>
          <p class="text-[11px] text-ig-grayText truncate">${p.full_name || 'Sem nome'}</p>
          <span class="text-[10px] text-ig-primary mt-1 block">${p.total_snapshots || 1} varreduras</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<p class="text-xs text-rose-500 col-span-full">Erro ao carregar lista de perfis.</p>';
  }
}

async function selectProfileFromList(username) {
  switchMainView('dashboard');
  await fetchProfileDiff(username);
}

function resetToHome() {
  switchMainView('dashboard');
}

function openTrackModal() {
  searchInput.focus();
  searchInput.scrollIntoView({ behavior: 'smooth' });
}

// Extension Modal
function openExtensionModal() {
  document.getElementById("extension-modal").classList.remove("hidden");
}

function closeExtensionModal() {
  document.getElementById("extension-modal").classList.add("hidden");
}

// Settings Modal
function openSettingsModal() {
  document.getElementById("settings-modal").classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settings-modal").classList.add("hidden");
}

async function saveSettings() {
  const geminiKey = document.getElementById("setting-gemini-key").value;
  const sessionCookie = document.getElementById("setting-session-cookie").value;
  const defaultMode = document.getElementById("setting-default-mode").value === "true";

  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gemini_api_key: geminiKey || undefined,
        instagram_session_cookie: sessionCookie || undefined,
        mock_mode_default: defaultMode
      })
    });
    if (res.ok) {
      showToast("Configurações salvas com sucesso!", "success");
      closeSettingsModal();
      await loadSettings();
    }
  } catch (e) {
    showToast("Erro ao salvar configurações", "error");
  }
}

// Toast Notifications
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toast-message");
  const toastIcon = document.getElementById("toast-icon");

  toastMsg.innerText = message;

  let iconHtml = '<i data-lucide="info" class="w-4 h-4 text-ig-primary"></i>';
  if (type === 'success') {
    iconHtml = '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-500"></i>';
  } else if (type === 'error') {
    iconHtml = '<i data-lucide="alert-circle" class="w-4 h-4 text-rose-500"></i>';
  } else if (type === 'warning') {
    iconHtml = '<i data-lucide="alert-triangle" class="w-4 h-4 text-amber-500"></i>';
  }

  toastIcon.innerHTML = iconHtml;
  lucide.createIcons();

  toast.classList.remove("translate-y-20", "opacity-0", "pointer-events-none");
  
  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0", "pointer-events-none");
  }, 3500);
}

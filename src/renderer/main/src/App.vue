<template>
  <div class="app-container" :class="{ 'mini-mode': isMiniMode }">
    <!-- 左侧边栏 -->
    <aside class="sidebar">
      <!-- 用户信息 -->
      <div class="user-profile">
        <div class="avatar">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"/></svg>
        </div>
        <div class="user-info">
          <span class="user-name">MSC-TT 用户</span>
          <div class="user-tags">
            <span class="tag vip">VIP</span>
            <span class="tag hq">高品质</span>
          </div>
        </div>
        <svg class="dropdown-arrow" viewBox="0 0 12 12" width="10" height="10"><path fill="currentColor" d="M3 5l3 3 3-3z"/></svg>
      </div>

      <!-- 主导航按钮 -->
      <div class="nav-buttons">
        <div
          class="nav-btn"
          :class="{ active: activeNav === 'discover' }"
          @click="activeNav = 'discover'"
        >
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3l9-8z"/></svg>
          <span>首页</span>
        </div>
        <div
          class="nav-btn"
          :class="{ active: activeNav === 'history' }"
          @click="activeNav = 'history'"
        >
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h-5v-2h3V7h2v6z"/></svg>
          <span>最近播放</span>
        </div>
        <div class="nav-btn new-playlist" @click="openCreatePlaylist">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
          <span>新建歌单</span>
        </div>
      </div>

      <!-- 音乐库分组 -->
      <div class="library-section">
        <div
          class="library-item"
          :class="{ active: activeNav === 'favorites' }"
          title="我收藏的歌曲"
          @click="activeNav = 'favorites'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
          <span>喜欢</span>
          <span class="count">{{ favoritesCount }}</span>
        </div>
        <div
          class="library-item"
          :class="{ active: activeNav === 'local' }"
          title="本地和下载"
          @click="activeNav = 'local'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2zm-1-2V7l-5 3-5-3v12h10z"/></svg>
          <span>本地和下载</span>
          <span class="count">{{ historyCount }}</span>
        </div>
        <div
          class="library-item"
          :class="{ active: activeNav === 'online' }"
          title="在线音乐"
          @click="activeNav = 'online'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 3v9.28A4.39 4.39 0 0010 12a4 4 0 104 4V7h6V3z"/></svg>
          <span>在线音乐</span>
        </div>
      </div>

      <!-- 云端收藏分组（QQ / 网易 已登录账号的"我喜欢"） -->
      <div class="library-section">
        <div class="section-header cloud">
          <span>云端收藏</span>
          <span class="cloud-sub" v-if="accLogin.loggedIn || accLogin.neteaseLoggedIn">
            已同步 {{ (accLogin.loggedIn ? 1 : 0) + (accLogin.neteaseLoggedIn ? 1 : 0) }} 账号
          </span>
        </div>
        <div
          class="library-item cloud-item"
          :class="{ active: activeNav === 'cloudQq', need: !accLogin.loggedIn }"
          title="QQ音乐收藏（我喜欢的歌曲）"
          @click="activeNav = 'cloudQq'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" class="qq-logo"><path fill="#31c27c" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9c0 .83-.67 1.5-1.5 1.5S7 11.83 7 11s.67-1.5 1.5-1.5S10 10.17 10 11zm8 0c0 .83-.67 1.5-1.5 1.5S15 11.83 15 11s.67-1.5 1.5-1.5S18 10.17 18 11zm-4-2a3 3 0 110 6 3 3 0 010-6z"/></svg>
          <span>QQ音乐收藏</span>
          <span class="count cloud-count" v-if="accLogin.loggedIn">●</span>
          <span class="count need-tag" v-else>未登录</span>
        </div>
        <div
          class="library-item cloud-item"
          :class="{ active: activeNav === 'cloudNetease', need: !accLogin.neteaseLoggedIn }"
          title="网易音乐收藏（我喜欢的音乐）"
          @click="activeNav = 'cloudNetease'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" class="netease-logo"><path fill="#e02020" d="M12 2a8 8 0 00-8 8v7a5 5 0 102-4V10a6 6 0 1112 0v2a4 4 0 11-2-3.46V10z"/></svg>
          <span>网易音乐收藏</span>
          <span class="count cloud-count" v-if="accLogin.neteaseLoggedIn">●</span>
          <span class="count need-tag" v-else>未登录</span>
        </div>
      </div>

      <!-- 自建歌单分组 -->
      <div class="playlist-section">
        <div class="section-header">
          <span>自建歌单</span>
          <span class="divider">|</span>
          <span>收藏歌单</span>
          <button class="add-btn" title="新建歌单" @click="openCreatePlaylist">
            <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M8 3a1 1 0 011 1v3h3a1 1 0 110 2H9v3a1 1 0 11-2 0V9H4a1 1 0 110-2h3V4a1 1 0 011-1z"/></svg>
          </button>
        </div>
        <div class="playlist-list">
          <div
            v-for="pl in myPlaylists"
            :key="pl.id"
            class="playlist-item"
            :class="{ active: activeNav === 'playlist' && currentPlaylistId === pl.id }"
            :title="pl.name + '（' + pl.count + ' 首）'"
            @click="selectPlaylist(pl)"
          >
            <div class="mini-cover" :style="{ background: pl.color }">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 3v9.55A4 4 0 1014 16V7h4V3z"/></svg>
            </div>
            <span class="pl-name">{{ pl.name }}</span>
            <button class="pl-remove" title="删除歌单" @click.stop="deletePlaylist(pl)">
              <svg viewBox="0 0 12 12" width="9" height="9"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.4"/></svg>
            </button>
          </div>
          <div v-if="myPlaylists.length === 0" class="pl-empty" @click="openCreatePlaylist">
            还没有歌单，点击新建
          </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <button class="footer-btn" title="设置" :class="{ active: activeNav === 'settings' }" @click="activeNav = 'settings'">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        </button>
        <button class="footer-btn" title="皮肤" @click.stop="showThemePanel = !showThemePanel">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 16a7 7 0 110-14 7 7 0 010 14zm-3-9a2 2 0 114 0 2 2 0 01-4 0z"/></svg>
        </button>
        <button class="footer-btn" title="迷你模式" @click="toggleMiniMode">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"/></svg>
        </button>
      </div>

      <!-- 皮肤面板 -->
      <div v-if="showThemePanel" class="theme-panel" @click.stop>
        <div class="tp-title">主题皮肤</div>
        <div
          class="tp-auto"
          :class="{ active: themeMode === 'auto' }"
          @click="onSelectTheme('auto')"
        >
          <span class="tp-auto-ic">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zM5.5 11c-.83 0-1.5-.67-1.5-1.5S4.67 8 5.5 8 7 8.67 7 9.5 6.33 11 5.5 11zm3.5-4C8.12 7 7.5 6.33 7.5 5.5S8.62 4 9.5 4s1.5.67 1.5 1.5S10.38 7 9.5 7zm5 0c-.88 0-1.5-.67-1.5-1.5S13.62 4 14.5 4s1.5.67 1.5 1.5S15.38 7 14.5 7zm3.5 4c-.83 0-1.5-.67-1.5-1.5S17.17 8 18 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          </span>
          <div class="tp-auto-txt">
            <div class="tp-name">跟随专辑封面</div>
            <div class="tp-desc">主色随正在播放的歌曲自动变化</div>
          </div>
        </div>
        <div class="tp-swatches">
          <div
            v-for="p in THEME_PRESETS"
            :key="p.color"
            class="tp-swatch"
            :class="{ active: themeMode === 'fixed' && themeColor === p.color }"
            :style="{ background: p.color }"
            :title="p.name"
            @click="onSelectTheme('fixed', p.color)"
          ></div>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main-wrap">
      <!-- 顶部：导航 + 搜索 + 窗口按钮 -->
      <header class="topbar">
        <div class="nav-arrows">
          <button class="arrow-btn" title="后退" :disabled="!canNavBack" @click="navBack">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button class="arrow-btn" title="前进" :disabled="!canNavForward" @click="navForward">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
        </div>

        <div class="search-box">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input
            v-model="searchKeyword"
            class="search-input"
            placeholder="搜索本地 / 在线音乐"
            @keyup.enter="onSearchEnter"
          />
        </div>

        <div class="topbar-right">
          <button class="user-btn" title="账号" @click.stop="toggleAccountPanel">
            <div class="mini-avatar">U</div>
          </button>

          <!-- 账号面板 -->
          <div v-if="showAccountPanel" class="account-panel" @click.stop>
            <div class="ap-head">
              <div class="ap-avatar">U</div>
              <div class="ap-head-txt">
                <div class="ap-name">MSC-TT 本地用户</div>
                <div class="ap-desc">曲库与账号数据保存在本机</div>
              </div>
            </div>

            <div class="ap-row" :class="{ current: activeSource === 'qq' }" title="点击切换到该音源" @click="apSwitchSource('qq')">
              <div class="ap-ic qq">Q</div>
              <div class="ap-main">
                <div class="ap-row-name">QQ音乐</div>
                <div class="ap-status" :class="{ on: accLogin.loggedIn }">
                  {{ accLogin.loggedIn ? `已登录：${accLogin.uin || '已授权账号'}` : '未登录 · VIP 歌曲需登录后播放' }}
                </div>
              </div>
              <span v-if="activeSource === 'qq'" class="ap-cur">使用中</span>
              <button v-if="accLogin.loggedIn" class="ap-btn" @click.stop="accLogoutQQ">退出</button>
              <button v-else class="ap-btn primary" @click.stop="accOpenQrLogin">扫码登录</button>
            </div>

            <div class="ap-row" :class="{ current: activeSource === 'netease' }" title="点击切换到该音源" @click="apSwitchSource('netease')">
              <div class="ap-ic ne">云</div>
              <div class="ap-main">
                <div class="ap-row-name">网易云音乐</div>
                <div class="ap-status" :class="{ on: accLogin.neteaseLoggedIn }">
                  {{ accLogin.neteaseLoggedIn ? `已登录：${accLogin.neteaseNickname || '网易云用户'}` : '未登录 · 免登录可用，登录后 VIP 可播' }}
                </div>
              </div>
              <span v-if="activeSource === 'netease'" class="ap-cur">使用中</span>
              <button v-if="accLogin.neteaseLoggedIn" class="ap-btn" @click.stop="accLogoutNetease">退出</button>
              <button v-else class="ap-btn primary" @click.stop="accOpenNeteaseLogin">扫码登录</button>
            </div>

            <div class="ap-row" :class="{ current: activeSource === 'higequ' }" title="点击切换到该音源" @click="apSwitchSource('higequ')">
              <div class="ap-ic hi">1</div>
              <div class="ap-main">
                <div class="ap-row-name"><span class="ap-dot" :class="SOURCE_QUALITY.higequ"></span>{{ SOURCE_NAMES.higequ }}</div>
                <div class="ap-status on">免登录 · 直接可用</div>
              </div>
              <span v-if="activeSource === 'higequ'" class="ap-cur">使用中</span>
            </div>

            <div class="ap-row" :class="{ current: activeSource === 'gequbao' }" title="点击切换到该音源" @click="apSwitchSource('gequbao')">
              <div class="ap-ic gb">2</div>
              <div class="ap-main">
                <div class="ap-row-name"><span class="ap-dot" :class="SOURCE_QUALITY.gequbao"></span>{{ SOURCE_NAMES.gequbao }}</div>
                <div class="ap-status on">免登录 · 直接可用</div>
              </div>
              <span v-if="activeSource === 'gequbao'" class="ap-cur">使用中</span>
            </div>

            <div class="ap-row" :class="{ current: activeSource === 'onemusic' }" title="点击切换到该音源" @click="apSwitchSource('onemusic')">
              <div class="ap-ic gb">3</div>
              <div class="ap-main">
                <div class="ap-row-name"><span class="ap-dot" :class="SOURCE_QUALITY.onemusic"></span>{{ SOURCE_NAMES.onemusic }}</div>
                <div class="ap-status on">免登录 · 直接可用</div>
              </div>
              <span v-if="activeSource === 'onemusic'" class="ap-cur">使用中</span>
            </div>

            <div class="ap-row" :class="{ current: activeSource === 'xmwav' }" title="点击切换到该音源" @click="apSwitchSource('xmwav')">
              <div class="ap-ic gb">4</div>
              <div class="ap-main">
                <div class="ap-row-name"><span class="ap-dot" :class="SOURCE_QUALITY.xmwav"></span>{{ SOURCE_NAMES.xmwav }}</div>
                <div class="ap-status on">免登录 · 直接可用</div>
              </div>
              <span v-if="activeSource === 'xmwav'" class="ap-cur">使用中</span>
            </div>

            <div class="ap-row" :class="{ current: activeSource === 'gmmp3' }" title="点击切换到该音源" @click="apSwitchSource('gmmp3')">
              <div class="ap-ic gb">5</div>
              <div class="ap-main">
                <div class="ap-row-name"><span class="ap-dot" :class="SOURCE_QUALITY.gmmp3"></span>{{ SOURCE_NAMES.gmmp3 }}</div>
                <div class="ap-status on">免登录 · 直接可用</div>
              </div>
              <span v-if="activeSource === 'gmmp3'" class="ap-cur">使用中</span>
            </div>
          </div>

          <div class="view-toggle">
            <button
              class="vt-btn"
              :class="{ active: viewMode === 'list' }"
              title="列表视图"
              @click="viewMode = 'list'"
            >
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3zm0 4h14v2H3zm17-9v10l-4-5z"/></svg>
            </button>
            <button
              class="vt-btn"
              :class="{ active: viewMode === 'grid' }"
              title="网格视图"
              @click="viewMode = 'grid'"
            >
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg>
            </button>
          </div>
          <div class="win-buttons">
            <button class="win-btn" @click="handleMinimize" title="最小化">
              <svg viewBox="0 0 12 12" width="12" height="12"><rect x="2" y="5.5" width="8" height="1" fill="currentColor"/></svg>
            </button>
            <button class="win-btn" @click="handleToggleMaximize" :title="isMax ? '还原' : '最大化'">
              <svg v-if="!isMax" viewBox="0 0 12 12" width="12" height="12"><rect x="2.5" y="2.5" width="7" height="7" stroke="currentColor" fill="none" stroke-width="1.2"/></svg>
              <svg v-else viewBox="0 0 12 12" width="12" height="12"><rect x="2.5" y="4.5" width="5" height="5" stroke="currentColor" fill="none" stroke-width="1"/><path d="M4.5 4.5V2.5h5v5h-2" stroke="currentColor" fill="none" stroke-width="1"/></svg>
            </button>
            <button class="win-btn close" @click="handleClose" title="关闭">
              <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.4"/></svg>
            </button>
          </div>
        </div>
      </header>

      <!-- 内容主体 -->
      <main class="main-content">
        <!-- 首页推荐 -->
        <DiscoverView
          v-if="activeNav === 'discover'"
          key="discover"
          @open-playlist="id => { currentPlaylistId.value = id; activeNav.value = 'playlist'; pushNav() }"
        />

        <!-- 音乐库（本地和下载 / 最近播放 / 喜欢 / 歌单详情） -->
        <LocalMusic
          v-else-if="['local', 'history', 'favorites', 'playlist'].includes(activeNav)"
          :key="activeNav + '-' + (currentPlaylistId || '')"
          :mode="activeNav"
          :playlist-id="currentPlaylistId"
          :search-keyword="searchKeyword"
          :view-mode="viewMode"
          @playlist-deleted="onPlaylistDeleted"
          @counts-changed="refreshCounts"
        />

        <!-- 搜索结果（本地 + 在线聚合） -->
        <SearchResult
          v-else-if="activeNav === 'search'"
          :keyword="searchKeyword"
          @go-online="activeNav = 'online'"
          @open-singer="openSinger"
        />

        <!-- 歌手页 -->
        <SingerView
          v-else-if="activeNav === 'singer' && currentSinger"
          :key="currentSinger.source + '-' + currentSinger.singerId"
          :source="currentSinger.source"
          :singer-id="currentSinger.singerId"
          :name="currentSinger.name"
        />

        <!-- 在线音乐 -->
        <OnlineMusic v-else-if="activeNav === 'online'" @open-singer="openSinger" />

        <!-- QQ音乐「我喜欢」已收藏 -->
        <CloudFavorites
          v-else-if="activeNav === 'cloudQq'"
          key="cloud-qq"
          type="qq"
          @go-online-login="gotoOnlineLogin"
        />

        <!-- 网易云「我喜欢的音乐」已收藏 -->
        <CloudFavorites
          v-else-if="activeNav === 'cloudNetease'"
          key="cloud-netease"
          type="netease"
          @go-online-login="gotoOnlineLogin"
        />

        <!-- 设置 -->
        <SettingsView v-else-if="activeNav === 'settings'" key="settings" />

        <!-- 其他页面占位 -->
        <template v-else>
          <div class="placeholder-page">
            <div class="ph-title">{{ currentNavLabel }}</div>
            <div class="ph-sub">该板块正在开发中...</div>
          </div>
        </template>
      </main>
    </div>

    <!-- 底部播放栏 -->
    <footer class="player-bar" :class="{ expanded: player.showNowPlaying }">
      <!-- 左组：封面 + 信息 + 迷你按钮 -->
      <div class="p-left">
        <!-- 详情页展开时隐藏封面缩略图（QQ 音乐全屏模式同款） -->
        <div v-show="!player.showNowPlaying" class="p-cover" title="展开歌曲详情页" @click="player.toggleNowPlaying()">
          <img v-if="barCover && !brokenCovers.has('barCover')" :src="barCover" class="p-cover-img" alt="" referrerpolicy="no-referrer" @error="e => onCoverError(e, 'barCover')" />
          <svg v-else viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3v9.55A4 4 0 1014 16V7h4V3z"/></svg>
          <span class="p-cover-expand">
            <svg viewBox="0 0 24 24" width="12" height="12"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>
          </span>
        </div>
        <div class="p-info">
          <div class="p-title-line" @click="player.toggleQueue()" title="查看播放队列">
            <span class="p-title">{{ player.currentTrack?.title || '未在播放' }}</span>
            <template v-if="player.currentTrack?.artist">
              <span class="p-dash">-</span>
              <span
                class="p-artist"
                :class="{ clickable: player.currentTrack?.singerId }"
                :title="player.currentTrack?.singerId ? '查看歌手' : ''"
                @click.stop="openSingerFromPlayer()"
              >{{ player.currentTrack.artist }}</span>
            </template>
            <em v-if="player.currentTrack?.vip" class="p-vip-chip">VIP</em>
          </div>
          <div class="p-mini" v-if="player.currentTrack">
            <button class="pmini-btn favorite" :class="{ active: isFav }" :title="isFav ? '取消收藏' : '收藏'" @click="toggleFavorite">
              <svg v-if="isFav" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
            </button>
            <button class="pmini-btn" title="歌词" :class="{ active: player.showLyricsPanel }" @click="player.toggleLyricsPanel()">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 4h16v2H4zm0 5h12v2H4zm0 5h16v2H4zm0 5h8v2H4z"/></svg>
            </button>
            <button class="pmini-btn" title="更多" @click="showToast('更多操作开发中')">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 2a2 2 0 100-4 2 2 0 000 4zm0 2a2 2 0 100-4 2 2 0 000 4z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 中左组：随机/上一首/播放/下一首/循环 -->
      <div class="p-controls">
        <button class="pctrl-btn" title="随机" :class="{ active: player.playMode === 'random' }" @click="player.setPlayMode('random')">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
        </button>
        <button class="pctrl-btn" title="上一首" @click="player.playPrev()">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 6v12h2V6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <button class="pplay-btn" :title="player.isPlaying ? '暂停' : '播放'" @click="player.togglePlay()">
          <svg v-if="!player.isPlaying" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
        </button>
        <button class="pctrl-btn" title="下一首" @click="player.playNext()">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16 6v12h2V6zM6 6v12l8.5-6z"/></svg>
        </button>
        <button class="pctrl-btn" :class="{ active: player.playMode === 'single' }" :title="'播放模式：' + playModeLabel" @click="cyclePlayMode">
          <svg v-if="player.playMode === 'list'" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4 6h12v2H4zm0 5h12v2H4zm0 5h8v2H4zm10-5l4-3v6z"/></svg>
          <svg v-else-if="player.playMode === 'random'" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
        </button>
      </div>

      <!-- 进度条 -->
      <div class="p-progress">
        <span class="p-time">{{ player.currentTimeText }}</span>
        <div
          ref="progressRef"
          class="p-track"
          :class="{ dragging: isDraggingProgress }"
          @mousedown="startProgressDrag"
          @mousemove="updateHoverTime"
          @mouseleave="hoverPercent = null"
        >
          <div class="p-fill" :style="{ width: (isDraggingProgress ? dragPercent : player.progress) + '%' }"></div>
          <div class="p-thumb" :style="{ left: (isDraggingProgress ? dragPercent : player.progress) + '%' }"></div>
          <div v-if="hoverPercent != null" class="p-hover-tip" :style="{ left: hoverPercent + '%' }">{{ formatTime(hoverTime) }}</div>
        </div>
        <span class="p-time">{{ player.durationText }}</span>
      </div>

      <!-- 右组：SQ/歌词/播放列表 -->
      <div class="p-right">
        <div class="p-volume" @click.stop @mouseenter="showVolumePopupNow" @mouseleave="hideVolumePopupLater">
          <button class="pvol-btn" :title="'音量 ' + Math.round(player.volume * 100) + '%'" @click="toggleMute" :class="{ muted: player.volume === 0 }">
            <svg v-if="player.volume === 0" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            <svg v-else-if="player.volume < 0.5" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9zm13.5 3a4 4 0 00-2-3.46v6.92a4 4 0 002-3.46z"/></svg>
          </button>
          <transition name="vol-fade">
            <div class="pvol-popup" v-show="showVolumePopup" @click.stop>
              <div class="pvol-vslider" ref="vsliderRef" @mousedown="startVolDrag">
                <div class="pvol-vtrack"></div>
                <div class="pvol-vfill" ref="vfillRef" :style="{ height: (player.volume * 100) + '%' }"></div>
                <div class="pvol-vthumb" ref="vthumbRef" :style="{ bottom: (player.volume * 100) + '%' }">
                  <div class="pvol-thumb-inner"></div>
                </div>
              </div>
              <div class="pvol-vlabel" ref="vlabelRef" :class="{ 'is-muted': player.volume === 0 }">{{ Math.round(player.volume * 100) }}%</div>
              <button class="pvol-mute" @click="toggleMute" :class="{ active: player.volume === 0 }">
                <svg v-if="player.volume === 0" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                <svg v-else viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9zm13.5 3a4 4 0 00-2-3.46v6.92a4 4 0 002-3.46z"/></svg>
              </button>
              <div class="pvol-arrow"></div>
            </div>
          </transition>
        </div>
        <button v-if="qualityBadge" class="pfeat-btn sq" :class="'q-' + qualityBadge.toLowerCase()" :title="qualityTitle">{{ qualityBadge }}</button>
        <button class="pfeat-btn dtly" title="桌面歌词" :class="{ active: player.desktopLyrics }" @click="player.setDesktopLyrics(!player.desktopLyrics)">词</button>
        <button class="pfeat-btn" title="歌词" :class="{ active: player.showLyricsPanel }" @click="player.toggleLyricsPanel()">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4 4h16v2H4zm0 5h12v2H4zm0 5h16v2H4zm0 5h8v2H4z"/></svg>
        </button>
        <button class="pfeat-btn has-badge" title="播放列表" @click="player.toggleQueue()">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3zm0 4h14v2H3zm17-9v10l-4-5z"/></svg>
          <span v-if="player.queue.length > 0" class="badge">{{ player.queue.length }}</span>
        </button>
      </div>
    </footer>

    <!-- 迷你模式悬浮条 -->
    <div v-if="isMiniMode" class="mini-bar">
      <div class="mb-cover" title="恢复完整窗口" @click="toggleMiniMode">
        <img v-if="barCover && !brokenCovers.has('barCover')" :src="barCover" class="mb-cover-img" alt="" referrerpolicy="no-referrer" />
        <svg v-else viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 3v9.55A4 4 0 1014 16V7h4V3z"/></svg>
      </div>
      <div class="mb-main">
        <div class="mb-info">
          <div class="mb-title">{{ player.currentTrack?.title || '未在播放' }}</div>
          <div class="mb-artist">{{ player.currentTrack?.artist || 'MSC-TT' }}</div>
        </div>
        <div class="mb-controls">
          <button class="mb-btn" title="上一首" @click="player.playPrev()">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 6v12h2V6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button class="mb-btn mb-play" :title="player.isPlaying ? '暂停' : '播放'" @click="player.togglePlay()">
            <svg v-if="!player.isPlaying" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            <svg v-else viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
          </button>
          <button class="mb-btn" title="下一首" @click="player.playNext()">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 6v12h2V6zM6 6v12l8.5-6z"/></svg>
          </button>
          <button class="mb-btn mb-exit" title="退出迷你模式" @click="toggleMiniMode">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"/></svg>
          </button>
        </div>
      </div>
      <div class="mb-progress" :style="{ width: player.progress + '%' }"></div>
    </div>

    <!-- 歌词面板 -->
    <transition name="fade">
      <div v-if="player.showLyricsPanel" class="lyrics-overlay" @click.self="player.toggleLyricsPanel()">
        <div class="lyrics-panel-wrapper">
          <LyricsPanel
            :lyrics="player.lyrics"
            :plain-text="player.plainLyrics"
            :synced="player.isLyricsSynced"
            :current-time="player.currentTime"
            :track-id="player.currentTrack?.id || null"
            @seek-to="handleLyricSeek"
          />
          <button class="lyrics-close" @click="player.toggleLyricsPanel()">
            <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
        </div>
      </div>
    </transition>

    <!-- 全屏歌曲详情页（黑胶唱片） -->
    <transition name="np-fade">
      <NowPlaying v-if="player.showNowPlaying" />
    </transition>

    <!-- 新建歌单弹窗 -->
    <transition name="fade">
      <div v-if="showPlaylistModal" class="pl-modal-mask" @click.self="closeCreatePlaylist">
        <div class="pl-modal">
          <div class="pl-modal-title">新建歌单</div>
          <input
            ref="plNameRef"
            v-model="newPlaylistName"
            class="pl-modal-input"
            placeholder="输入歌单名，回车创建"
            maxlength="30"
            @keyup.enter="confirmCreatePlaylist"
            @keyup.esc="closeCreatePlaylist"
          />
          <div class="pl-modal-actions">
            <button class="pm-btn" @click="closeCreatePlaylist">取消</button>
            <button class="pm-btn primary" :disabled="!newPlaylistName.trim()" @click="confirmCreatePlaylist">创建</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 播放列表侧边抽屉 -->
    <transition name="drawer">
      <div v-if="player.showQueue" class="queue-drawer" @click.self="player.toggleQueue()">
        <div class="queue-panel">
          <div class="queue-header">
            <span>播放队列</span>
            <span class="queue-count">({{ player.queue.length }})</span>
            <button class="close-btn" @click="player.toggleQueue()">
              <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
          </div>
          <div ref="queueListRef" class="queue-list" v-if="player.queue.length > 0">
            <div
              v-for="(track, idx) in player.queue"
              :key="track.id"
              class="queue-item"
              :class="{ active: player.currentTrack?.id === track.id }"
              @click="player.playIndex(idx)"
            >
              <span class="q-index">
                <span v-if="player.currentTrack?.id === track.id" class="eq-bars" :class="{ paused: !player.isPlaying }"><i></i><i></i><i></i></span>
                <template v-else>{{ idx + 1 }}</template>
              </span>
              <div class="q-info">
                <div class="q-title">{{ track.title }}</div>
                <div class="q-artist">{{ track.artist }}</div>
              </div>
              <span class="q-duration">{{ formatTime(track.duration) }}</span>
              <button class="q-remove" title="从队列移除" @click.stop="player.removeQueueItem(idx)">
                <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.4"/></svg>
              </button>
            </div>
          </div>
          <div v-else class="queue-empty">
            <svg viewBox="0 0 64 64" width="48" height="48"><path fill="currentColor" d="M32 8L16 20v32l16 12 16-12V20L32 8zm0 4l12 9v26l-12 9-12-9V21l12-9z" opacity="0.3"/></svg>
            <p>播放队列为空</p>
          </div>
          <div class="queue-footer" v-if="player.queue.length > 0">
            <button @click="player.clearQueue()">清空队列</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 全局轻提示 -->
    <transition name="toast-fade">
      <div v-if="toast.show" :class="['global-toast', toast.type]">
        <span class="toast-icon">{{ toast.type === 'error' ? '✕' : toast.type === 'success' ? '✓' : 'ℹ' }}</span>
        <span class="toast-text">{{ toast.text }}</span>
        <button v-if="toast.action" class="toast-action-btn" @click="fireToastAction">{{ toast.action.label }}</button>
      </div>
    </transition>

    <!-- 全局确认弹窗（替代原生 window.confirm） -->
    <teleport to="body">
      <transition name="toast-fade">
        <div v-if="confirmBox" class="confirm-mask" @click.self="settleConfirm(false)">
          <div class="confirm-card">
            <div class="confirm-title">{{ confirmBox.title }}</div>
            <div class="confirm-message">{{ confirmBox.message }}</div>
            <div class="confirm-actions">
              <button class="confirm-btn cancel" @click="settleConfirm(false)">{{ confirmBox.cancelText }}</button>
              <button :class="['confirm-btn', 'ok', { danger: confirmBox.danger }]" @click="settleConfirm(true)">
                {{ confirmBox.okText }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- QQ 扫码登录弹窗（账号面板） -->
    <teleport to="body">
      <div v-if="accQrShow" class="acc-qr-mask" @click.self="accCloseQrLogin">
        <div class="acc-qr-card">
          <div class="acc-qr-title">QQ 音乐扫码登录</div>
          <div class="acc-qr-imgwrap">
            <img v-if="accQrImg" :src="accQrImg" class="acc-qr-img" :class="{ dimmed: accQrExpired }" alt="" />
            <div v-if="accQrExpired" class="acc-qr-expired">
              <div>二维码已过期</div>
              <button class="ap-btn primary" @click="accOpenQrLogin">刷新二维码</button>
            </div>
          </div>
          <div class="acc-qr-status">{{ accQrStatus }}</div>
          <div class="acc-qr-tip">使用手机 QQ 扫一扫，登录你自己的 QQ 音乐账号</div>
          <button class="ap-btn acc-qr-close" @click="accCloseQrLogin">关闭</button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { usePlayerStore } from './stores/player'
import LocalMusic from './views/LocalMusic.vue'
import OnlineMusic from './views/OnlineMusic.vue'
import SearchResult from './views/SearchResult.vue'
import SingerView from './views/SingerView.vue'
import DiscoverView from './views/DiscoverView.vue'
import SettingsView from './views/SettingsView.vue'
import CloudFavorites from './views/CloudFavorites.vue'
import LyricsPanel from './components/LyricsPanel.vue'
import NowPlaying from './components/NowPlaying.vue'
import { appConfirm } from './utils/confirm'
import { SOURCE_NAMES, SOURCE_QUALITY } from './constants/sources'
import {
  THEME_PRESETS,
  themeMode,
  themeColor,
  applyAccent,
  applyCoverTheme,
  selectTheme,
  initTheme,
  DEFAULT_ACCENT
} from './composables/useTheme'

const player = usePlayerStore()

// 播放栏封面：跟随当前歌曲加载封面缓存图
const barCover = ref('')
const brokenCovers = new Set() // 封面加载失败 → 切到占位图标，避免裂图
function onCoverError(e, key) {
  if (!key) return
  brokenCovers.add(key)
  // 给对应 ref 一个空脉冲，触发 v-if 重新计算显示占位
  if (key === 'barCover') {
    const v = barCover.value
    barCover.value = ''
    // 注意：不再赋回，靠 brokenCovers.has('barCover') 阻止 img 渲染
  }
  if (e?.target) try { e.target.onerror = null; e.target.removeAttribute('src') } catch {}
}
watch(
  () => player.currentTrack?.id,
  async (id) => {
    brokenCovers.delete('barCover')
    barCover.value = ''
    if (!id) return
    try {
      const d = await window.mscAPI.getCoverDataUrl(id)
      barCover.value = d || ''
    } catch {}
  },
  { immediate: true }
)

// ============ 主题皮肤 ============
const showThemePanel = ref(false)
// auto 模式：封面变化时重新取色
watch(barCover, (v) => {
  if (themeMode.value === 'auto') applyCoverTheme(v)
})
function onSelectTheme(mode, color) {
  selectTheme(mode, color)
  if (mode === 'auto') applyCoverTheme(barCover.value)
  showToast(mode === 'auto' ? '皮肤已切换：跟随专辑封面' : '皮肤已切换')
}

// ============ 迷你模式 ============
const isMiniMode = ref(false)
async function toggleMiniMode() {
  const next = !isMiniMode.value
  isMiniMode.value = next
  try {
    const r = await window.mscAPI.setMiniMode(next)
    if (!r?.ok) throw new Error('failed')
    // 进入迷你模式时收起可能打开的浮层，避免遮挡迷你条
    if (next) {
      if (player.showNowPlaying) player.toggleNowPlaying()
      if (player.showLyricsPanel) player.toggleLyricsPanel()
      if (player.showQueue) player.toggleQueue()
    }
  } catch {
    isMiniMode.value = !next
    showToast({ text: '迷你模式切换失败', type: 'error' })
  }
}

// ============ 账号面板（QQ / 网易云登录状态 + 音源切换） ============
const showAccountPanel = ref(false)
const accLogin = ref({ loggedIn: false, uin: '', neteaseLoggedIn: false, neteaseNickname: '' })
const activeSource = ref(localStorage.getItem('msc-source-type') || 'netease')

async function refreshActiveSource() {
  try {
    const st = await window.mscAPI.getOnlineStatus()
    if (['qq', 'netease', 'higequ', 'gequbao', 'onemusic', 'xmwav', 'gmmp3'].includes(st.type)) {
      activeSource.value = st.type
      localStorage.setItem('msc-source-type', st.type)
    }
  } catch {}
}

async function apSwitchSource(source) {
  if (activeSource.value === source) return
  try {
    const r = await window.mscAPI.setActiveSource(source)
    if (!r?.ok) {
      showToast({ text: r?.message || '切换音源失败', type: 'error' })
      return
    }
    activeSource.value = source
    localStorage.setItem('msc-source-type', source)
    window.dispatchEvent(new CustomEvent('app:source-changed', { detail: { source } }))
    showToast({ text: `音源已切换：${SOURCE_NAMES[source] || source}`, type: 'success' })
    showAccountPanel.value = false
  } catch (e) {
    showToast({ text: '切换音源失败：' + e.message, type: 'error' })
  }
}
const accQrShow = ref(false)
const accQrImg = ref('')
const accQrStatus = ref('')
const accQrExpired = ref(false)
let accQrToken = null
let accQrTimer = null

async function refreshAccLogin() {
  try {
    const info = await window.mscAPI.getLoginInfo()
    accLogin.value = {
      loggedIn: !!info.loggedIn,
      uin: info.uin || '',
      neteaseLoggedIn: !!info.neteaseLoggedIn,
      neteaseNickname: info.neteaseNickname || ''
    }
  } catch {}
}

function toggleAccountPanel() {
  showAccountPanel.value = !showAccountPanel.value
  if (showAccountPanel.value) {
    refreshAccLogin()
    refreshActiveSource()
  }
}

async function accLogoutQQ() {
  try { await window.mscAPI.logoutQQ() } catch {}
  accLogin.value = { ...accLogin.value, loggedIn: false, uin: '' }
  showToast('已退出 QQ 音乐账号')
}

async function accLogoutNetease() {
  try { await window.mscAPI.logoutNetease() } catch {}
  accLogin.value = { ...accLogin.value, neteaseLoggedIn: false, neteaseNickname: '' }
  showToast('已退出网易云账号')
}

// QQ 扫码登录（面板内弹窗，与在线音乐页逻辑一致）
async function accOpenQrLogin() {
  accQrShow.value = true
  accQrExpired.value = false
  accQrImg.value = ''
  accQrStatus.value = '正在获取二维码...'
  const r = await window.mscAPI.getQQLoginQr()
  if (!r.ok) {
    accQrStatus.value = r.error || '获取二维码失败'
    return
  }
  accQrImg.value = r.img
  accQrToken = { ptqrtoken: r.ptqrtoken, qrsig: r.qrsig }
  accQrStatus.value = '请用手机 QQ 扫描二维码'
  if (accQrTimer) clearInterval(accQrTimer)
  accQrTimer = setInterval(async () => {
    if (!accQrToken) return
    const r2 = await window.mscAPI.checkQQLogin(accQrToken.ptqrtoken, accQrToken.qrsig)
    if (!r2.ok) {
      accQrStatus.value = r2.error || '检查登录状态失败'
      return
    }
    if (r2.expired) {
      if (accQrTimer) { clearInterval(accQrTimer); accQrTimer = null }
      accQrExpired.value = true
      accQrStatus.value = '二维码已过期'
      return
    }
    if (r2.scanned) {
      if (accQrTimer) { clearInterval(accQrTimer); accQrTimer = null }
      accQrStatus.value = '登录成功！'
      accLogin.value = { ...accLogin.value, loggedIn: true, uin: r2.uin || '' }
      showToast('QQ 音乐登录成功')
      window.dispatchEvent(new CustomEvent('app:qq-logged-in'))
      setTimeout(() => { accQrShow.value = false; accQrToken = null }, 900)
    } else {
      accQrStatus.value = '等待扫码中...'
    }
  }, 2500)
}

function accCloseQrLogin() {
  if (accQrTimer) { clearInterval(accQrTimer); accQrTimer = null }
  accQrShow.value = false
  accQrToken = null
}

// 网易云扫码（独立官方登录窗口，成功后 netease:loginSuccess 事件刷新状态）
async function accOpenNeteaseLogin() {
  try {
    await window.mscAPI.openNeteaseLogin()
    showToast('已打开网易云登录窗口，登录成功后自动返回')
  } catch (e) {
    showToast({ text: '打开登录窗口失败：' + e.message, type: 'error' })
  }
}

const isMax = ref(false)
const activeNav = ref('discover')
const searchKeyword = ref('')
const viewMode = ref('grid')
const showVolumePopup = ref(false)
let volumeHideTimer = null
let isDraggingVolume = false
let currentDragVol = 0
const vfillRef = ref(null)
const vthumbRef = ref(null)
const vlabelRef = ref(null)
const vsliderRef = ref(null)

const favoritesCount = ref(0)
const historyCount = ref(0)
const currentPlaylistId = ref(null)

// 自建歌单（真实数据，来自数据库）
const PLAYLIST_COLORS = [
  'linear-gradient(135deg, #3a1c71, #d76d77, #ffaf7b)',
  'linear-gradient(135deg, #2193b0, #6dd5ed)',
  'linear-gradient(135deg, #ee0979, #ff6a00)',
  'linear-gradient(135deg, #56ab2f, #a8e063)',
  'linear-gradient(135deg, #42275a, #734b6d)',
  'linear-gradient(135deg, #1d976c, #93f9b9)'
]
const myPlaylists = ref([])

async function loadPlaylists() {
  try {
    const list = await window.mscAPI.listPlaylists()
    myPlaylists.value = (list || []).map((p, i) => ({
      ...p,
      color: PLAYLIST_COLORS[i % PLAYLIST_COLORS.length]
    }))
  } catch {}
}

// 侧边栏角标：喜欢数 = 真实收藏数；本地数 = 歌曲总数
async function refreshCounts() {
  try {
    const [favIds, listResult] = await Promise.all([
      window.mscAPI.listFavoriteIds(),
      window.mscAPI.listMusic({ pageSize: 1 })
    ])
    favoritesCount.value = favIds.length
    historyCount.value = listResult.total || 0
  } catch {}
}

// ============ 新建 / 删除歌单 ============
const showPlaylistModal = ref(false)
const newPlaylistName = ref('')
const plNameRef = ref(null)

function openCreatePlaylist() {
  newPlaylistName.value = ''
  showPlaylistModal.value = true
  nextTick(() => plNameRef.value?.focus())
}

function closeCreatePlaylist() {
  showPlaylistModal.value = false
}

async function confirmCreatePlaylist() {
  const name = newPlaylistName.value.trim()
  if (!name) return
  try {
    const r = await window.mscAPI.createPlaylist(name)
    if (r?.ok) {
      showPlaylistModal.value = false
      loadPlaylists()
    }
  } catch {}
}

async function deletePlaylist(pl) {
  const ok = await appConfirm(`确定删除歌单「${pl.name}」？歌曲不会被删除。`, {
    title: '删除歌单',
    danger: true,
    okText: '删除'
  })
  if (!ok) return
  try {
    await window.mscAPI.removePlaylist(pl.id)
    if (currentPlaylistId.value === pl.id) {
      currentPlaylistId.value = null
      activeNav.value = 'local'
    }
    loadPlaylists()
  } catch {}
}

function selectPlaylist(pl) {
  currentPlaylistId.value = pl.id
  activeNav.value = 'playlist'
}

// 歌单页里把歌单删掉后回调
function onPlaylistDeleted() {
  currentPlaylistId.value = null
  activeNav.value = 'local'
  loadPlaylists()
}

// ============ 歌手页 ============
// currentSinger: 当前浏览的歌手 { source, singerId, name }，导航历史随 entry 快照还原
const currentSinger = ref(null)

function openSinger(payload) {
  if (!payload?.singerId) return
  currentSinger.value = { source: payload.source || '', singerId: String(payload.singerId), name: payload.name || '' }
  activeNav.value = 'singer'
}

// 播放栏歌手名点击：仅在线歌带 singerId 时可跳；source 缺失时用最近使用的音源（OnlineMusic 切换时写入 localStorage）
function openSingerFromPlayer() {
  const t = player.currentTrack
  if (!t?.singerId) return
  const source = t.singerSource || localStorage.getItem('msc-source-type') || ''
  openSinger({ source, singerId: t.singerId, name: t.artist })
}

const currentNavLabel = computed(() => {
  if (activeNav.value === 'singer') return currentSinger.value?.name || '歌手'
  const map = { discover: '首页', local: '本地和下载', online: '在线音乐', mine: '我的音乐', playlist: '歌单', history: '最近播放', favorites: '喜欢', settings: '设置', search: '搜索结果', cloudQq: 'QQ音乐收藏', cloudNetease: '网易音乐收藏' }
  return map[activeNav.value] || '首页'
})

// 顶部搜索框回车：有关键词 → 聚合搜索页；空 → 本地音乐页
function onSearchEnter() {
  activeNav.value = searchKeyword.value.trim() ? 'search' : 'local'
}

// 从收藏空态"去登录"跳转到在线音乐页
function gotoOnlineLogin() {
  activeNav.value = 'online'
  pushNav()
}

// ============ 顶栏导航历史（后退 / 前进） ============
const navStack = ref([{ nav: 'discover', plid: null }])
const navIndex = ref(0)
let suppressNavWatch = false

watch(activeNav, (nav) => {
  if (suppressNavWatch) {
    suppressNavWatch = false
    return
  }
  // 截断「前进」分支，压入新记录（歌单 id / 歌手信息一并快照，方便回退时还原）
  navStack.value = navStack.value.slice(0, navIndex.value + 1)
  navStack.value.push({ nav, plid: currentPlaylistId.value, singer: nav === 'singer' ? currentSinger.value : null })
  navIndex.value = navStack.value.length - 1
})

const canNavBack = computed(() => navIndex.value > 0)
const canNavForward = computed(() => navIndex.value < navStack.value.length - 1)

function applyNavEntry(entry) {
  suppressNavWatch = true
  currentPlaylistId.value = entry.plid
  currentSinger.value = entry.singer || null
  activeNav.value = entry.nav
}

function navBack() {
  if (!canNavBack.value) return
  navIndex.value--
  applyNavEntry(navStack.value[navIndex.value])
}

function navForward() {
  if (!canNavForward.value) return
  navIndex.value++
  applyNavEntry(navStack.value[navIndex.value])
}

// ============ 全局确认弹窗（替代原生 window.confirm） ============
const confirmBox = ref(null) // { title, message, danger, okText, cancelText, resolve }

function settleConfirm(result) {
  if (!confirmBox.value) return
  confirmBox.value.resolve(result)
  confirmBox.value = null
}

// ============ 全局轻提示（未开放功能的点击反馈 / 播放失败提醒等） ============
// payload 可为字符串，或 { text, type, duration?, action?:{label, onClick} }
//   type: 'success' | 'error' | 'info'
//   action: 可选，在 toast 右侧渲染一个按钮，点击后 action.onClick()
const toast = ref({ show: false, text: '', type: 'info', action: null })
let toastTimer = null
let toastActionCleanup = null
function showToast(payload) {
  const isObj = payload && typeof payload === 'object'
  const text = isObj ? payload.text : payload
  const type = isObj && payload.type ? payload.type : 'info'
  const customDuration = isObj && typeof payload.duration === 'number' ? payload.duration : null
  // 错误信息读得更慢，停留久一点；成功/信息短一些
  const duration = customDuration != null ? customDuration : (type === 'error' ? 2800 : 2000)
  // 清理之前 action 相关的闭包引用（避免内存泄漏）
  if (toastActionCleanup) { toastActionCleanup(); toastActionCleanup = null }
  let action = null
  if (isObj && payload.action && payload.action.label) {
    const handler = payload.action.onClick || (() => {})
    action = { label: payload.action.label, _fire: handler }
    toastActionCleanup = () => { action._fire = null }
  }
  toast.value = { show: true, text, type, action }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value.show = false
    if (toastActionCleanup) { toastActionCleanup(); toastActionCleanup = null }
  }, duration)
}
function fireToastAction() {
  const a = toast.value?.action
  if (a && typeof a._fire === 'function') a._fire()
}

const playModeLabel = computed(() => {
  const map = { list: '列表循环', random: '随机播放', single: '单曲循环' }
  return map[player.playMode] || player.playMode
})

onMounted(async () => {
  isMax.value = await window.mscAPI.isMaximized()

  // 恢复持久化的主题皮肤
  initTheme()

  // ★ 启动立即刷新侧边栏账号状态（确保「云端收藏」徽标与真实登录态一致）
  refreshAccLogin()

  // ★ QQ 扫码登录成功（任意页面发出）→ 刷新侧边栏徽标
  window.addEventListener('app:qq-logged-in', () => {
    refreshAccLogin()
  })

  // 点击面板外部关闭皮肤面板 / 账号面板
  document.addEventListener('click', () => {
    showThemePanel.value = false
    showAccountPanel.value = false
  })

  // 网易云官方登录窗口登录成功 → 刷新账号面板状态
  window.mscAPI.onNeteaseLoginSuccess?.(() => {
    refreshAccLogin()
    showToast('网易云登录成功')
    window.dispatchEvent(new CustomEvent('app:netease-logged-in'))
  })

  // 监听全局轻提示事件（播放器等模块发出）
  window.addEventListener('app:toast', (e) => {
    if (e?.detail) showToast(e.detail)
  })

  // 监听全局确认弹窗事件（utils/confirm.js 的 appConfirm 发出）
  window.addEventListener('app:confirm', (e) => {
    if (e?.detail) confirmBox.value = e.detail
  })

  // 其他模块请求跳转某个导航
  window.addEventListener('app:nav-to', (e) => {
    const t = e?.detail
    if (t && ['discover', 'local', 'online', 'history', 'favorites', 'search', 'settings'].includes(t)) {
      activeNav.value = t
      pushNav()
    }
  })

  // 首页推荐点击跳搜索（冷启动条目）
  window.addEventListener('app:search-go', (e) => {
    const kw = (e?.detail || '').toString().trim()
    if (!kw) return
    searchKeyword.value = kw
    activeNav.value = 'search'
    pushNav()
  })

  // 桌面歌词悬浮窗被用户直接关掉时，同步按钮状态
  window.mscAPI.onDesktopLyricsClosed?.(() => {
    player.desktopLyrics = false
  })

  // 📒 主进程启动 3.5s 后主动推日志文件路径 → 弹「打开日志」按钮 toast
  window.mscAPI.onShowLogPath?.(async (logPath) => {
    if (!logPath) return
    const short = String(logPath).replace(/\\/g, '/').replace(/^.*?MSC-TT\//, 'MSC-TT/')
    // 用确认弹窗让用户选「要不要现在打开日志文件夹」，避免干扰
    setTimeout(() => {
      showToast({
        text: `📒 日志已开启：${short}，点击打开可查看详细播放调试信息`,
        type: 'info',
        duration: 8000,
        action: {
          label: '打开日志文件夹',
          onClick: () => { window.mscAPI.openLogFolder?.() }
        }
      })
    }, 300)
  })

  // 加载配置
  const config = await window.mscAPI.getConfig()
  if (config.volume != null) {
    player.setVolume(config.volume)
  }

  // 获取歌曲数量 + 歌单列表
  refreshCounts()
  loadPlaylists()
})

function handleMinimize() {
  window.mscAPI.minimize()
}

async function handleToggleMaximize() {
  isMax.value = await window.mscAPI.toggleMaximize()
}

function handleClose() {
  window.mscAPI.close()
}

function handleLyricSeek(time) {
  if (!player.duration) return
  const percent = (time / player.duration) * 100
  player.seek(percent)
}

// ============ 进度条拖拽 + 悬停时间预览 ============
const progressRef = ref(null)
const isDraggingProgress = ref(false)
const dragPercent = ref(0)
const hoverPercent = ref(null)
const hoverTime = ref(0)

function percentFromEvent(e) {
  const rect = progressRef.value.getBoundingClientRect()
  return Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
}

function startProgressDrag(e) {
  if (!player.duration || !progressRef.value) return
  isDraggingProgress.value = true
  dragPercent.value = percentFromEvent(e)
  document.addEventListener('mousemove', onProgressMouseMove, true)
  document.addEventListener('mouseup', onProgressMouseUp, true)
  e.preventDefault()
}

function onProgressMouseMove(e) {
  dragPercent.value = percentFromEvent(e)
}

function onProgressMouseUp(e) {
  if (!isDraggingProgress.value) return
  isDraggingProgress.value = false
  document.removeEventListener('mousemove', onProgressMouseMove, true)
  document.removeEventListener('mouseup', onProgressMouseUp, true)
  player.seek(percentFromEvent(e))
}

function updateHoverTime(e) {
  if (!player.duration || !progressRef.value) return
  const pct = percentFromEvent(e)
  hoverPercent.value = pct
  hoverTime.value = (pct / 100) * player.duration
}

// ============ 收藏（红心） ============
const isFav = ref(false)
watch(
  () => player.currentTrack?.id,
  async (id) => {
    isFav.value = id ? await window.mscAPI.checkFavorite(id).catch(() => false) : false
  },
  { immediate: true }
)

async function toggleFavorite() {
  if (!player.currentTrack) return
  try {
    const r = await window.mscAPI.toggleFavorite(player.currentTrack.id)
    isFav.value = !!r?.favorited
  } catch {}
}

// ============ 音质徽章（按真实格式/码率显示） ============
const LOSSLESS_FORMATS = ['flac', 'wav', 'ape', 'alac', 'aiff']
const qualityBadge = computed(() => {
  const t = player.currentTrack
  if (!t) return ''
  const fmt = String(t.format || '').toLowerCase()
  if (LOSSLESS_FORMATS.includes(fmt)) return 'SQ'
  // 用文件大小估算码率：字节×8÷秒÷1000 = kbps
  if (t.filesize && t.duration) {
    const kbps = Math.round((t.filesize * 8) / t.duration / 1000)
    if (kbps >= 256) return 'HQ'
  }
  return 'STD'
})
const qualityTitle = computed(() => {
  const map = { SQ: '无损音质', HQ: '高品质 (≥256kbps)', STD: '标准音质' }
  return '音质: ' + (map[qualityBadge.value] || '')
})

// ============ 播放队列：自动定位当前歌 ============
const queueListRef = ref(null)
watch(
  () => [player.showQueue, player.currentTrack?.id],
  async () => {
    if (!player.showQueue) return
    await nextTick()
    queueListRef.value?.querySelector('.queue-item.active')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
)

function handleVolumeChange(e) {
  player.setVolume(parseFloat(e.target.value))
}

function showVolumePopupNow() {
  clearTimeout(volumeHideTimer)
  showVolumePopup.value = true
}

function hideVolumePopupLater() {
  volumeHideTimer = setTimeout(() => {
    showVolumePopup.value = false
  }, 200)
}

function toggleMute() {
  if (player.volume > 0) {
    player._prevVolume = player.volume
    player.setVolume(0)
  } else {
    player.setVolume(player._prevVolume || 0.7)
  }
}

function updateVolDOM(vol) {
  const pct = (vol * 100).toFixed(1) + '%'
  if (vfillRef.value) vfillRef.value.style.height = pct
  if (vthumbRef.value) vthumbRef.value.style.bottom = pct
  if (vlabelRef.value) {
    const pctInt = Math.round(vol * 100)
    vlabelRef.value.textContent = pctInt + '%'
    vlabelRef.value.classList.toggle('is-muted', vol === 0)
  }
}

function getVolFromEvent(e) {
  const el = vsliderRef.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  const y = e.clientY - rect.top
  return Math.max(0, Math.min(1, 1 - (y / rect.height)))
}

function startVolDrag(e) {
  isDraggingVolume = true
  const vol = getVolFromEvent(e)
  currentDragVol = vol
  updateVolDOM(vol)
  document.addEventListener('mousemove', handleVolMouseMove, true)
  document.addEventListener('mouseup', endVolDrag, true)
  e.preventDefault()
}

function handleVolMouseMove(e) {
  if (!isDraggingVolume) return
  const vol = getVolFromEvent(e)
  currentDragVol = vol
  updateVolDOM(vol)
}

function endVolDrag() {
  if (!isDraggingVolume) return
  isDraggingVolume = false
  document.removeEventListener('mousemove', handleVolMouseMove, true)
  document.removeEventListener('mouseup', endVolDrag, true)
  // 松手时提交到 Pinia
  player.setVolume(currentDragVol)
  // 让 Vue 同步覆盖 style（清除拖拽期间的 DOM 直接修改）
  nextTick(() => {
    updateVolDOM(player.volume)
  })
}

onBeforeUnmount(() => {
  clearTimeout(volumeHideTimer)
})

function cyclePlayMode() {
  const modes = ['list', 'random', 'single']
  const idx = modes.indexOf(player.playMode)
  player.setPlayMode(modes[(idx + 1) % modes.length])
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
/* ============ 整体布局 ============ */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-family);
  overflow: hidden;
}

/* ============ 侧边栏 ============ */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color-light);
  display: flex;
  flex-direction: column;
  padding: 12px 0 8px;
  z-index: 10;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px 12px;
  border-bottom: 1px solid var(--border-color-light);
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-tags {
  display: flex;
  gap: 4px;
  margin-top: 3px;
}

.tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
}

.tag.vip {
  background: linear-gradient(90deg, #f5a623, #f7c948);
  color: #3a2000;
}

.tag.hq {
  background: var(--color-primary);
  color: #fff;
}

.dropdown-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* 导航按钮 */
.nav-buttons {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 44px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: var(--transition);
  -webkit-app-region: no-drag;
}

.nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-btn.active {
  background: var(--color-primary);
  color: #fff;
}

.nav-btn.active:hover {
  background: var(--color-primary-hover);
}

.nav-btn.new-playlist {
  border: 1px dashed var(--border-color);
  color: var(--text-tertiary);
  justify-content: center;
  height: 36px;
  font-size: 13px;
}

.nav-btn.new-playlist:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: transparent;
}

/* 音乐库 */
.library-section {
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.library-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: var(--transition);
}

.library-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.library-item.active {
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

/* 暂未开放的占位项：置灰不可点 */
.library-item.disabled {
  cursor: default;
  opacity: 0.38;
}
.library-item.disabled:hover {
  background: transparent;
  color: var(--text-secondary);
}

.library-item .count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-elevated);
  padding: 1px 6px;
  border-radius: var(--radius-full);
}

/* 云端收藏分组 */
.library-section + .library-section:nth-of-type(2) {
  padding-top: 10px;
  border-top: 1px solid var(--border-color-light);
}
.section-header.cloud {
  padding: 0 12px 6px;
  font-size: 11px;
  letter-spacing: 0.3px;
  color: var(--text-tertiary);
  text-transform: none;
  opacity: 0.9;
}
.cloud-sub {
  margin-left: auto;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent);
  font-weight: 500;
}
.cloud-item {
  padding: 0 12px;
}
.cloud-item.need {
  opacity: 0.75;
}
.qq-logo, .netease-logo {
  border-radius: 3px;
}
.cloud-count {
  background: transparent !important;
  color: #3ddc84 !important;
  font-size: 10px !important;
  padding: 0 !important;
}
.need-tag {
  color: #faad14 !important;
  background: rgba(250, 173, 20, 0.1) !important;
  font-weight: 500;
}

/* 歌单分组 */
.playlist-section {
  padding: 10px 8px 4px;
  border-top: 1px solid var(--border-color-light);
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
  flex-shrink: 0;
}

.section-header .divider {
  color: var(--border-color);
}

.add-btn {
  margin-left: auto;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  transition: var(--transition);
  flex-shrink: 0;
}

.add-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.playlist-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 4px;
  min-height: 0;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: var(--transition);
}

.playlist-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.mini-cover {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.7);
  flex-shrink: 0;
}

.pl-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-item.active {
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

/* 歌单悬浮删除按钮 */
.pl-remove {
  margin-left: auto;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  opacity: 0;
  flex-shrink: 0;
  transition: var(--transition);
}
.playlist-item:hover .pl-remove {
  opacity: 1;
}
.pl-remove:hover {
  color: #ff6b6b;
  background: var(--bg-hover);
}

.pl-empty {
  padding: 10px 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.pl-empty:hover {
  color: var(--color-primary);
  background: var(--bg-hover);
}

/* ============ 新建歌单弹窗 ============ */
.pl-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 600;
}
.pl-modal {
  width: 320px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}
.pl-modal-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 14px;
}
.pl-modal-input {
  width: 100%;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary, #141414);
  color: var(--text-primary);
  padding: 0 12px;
  font-size: 13px;
  outline: none;
}
.pl-modal-input:focus {
  border-color: var(--color-primary);
}
.pl-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.pm-btn {
  height: 30px;
  padding: 0 16px;
  border-radius: 15px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.pm-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}
.pm-btn.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
.pm-btn.primary:disabled {
  opacity: 0.45;
  cursor: default;
}

/* 侧边栏底部 */
.sidebar-footer {
  display: flex;
  justify-content: space-around;
  padding: 8px 12px 4px;
  border-top: 1px solid var(--border-color-light);
}

/* 皮肤面板 */
.theme-panel {
  position: absolute;
  left: 8px;
  bottom: 56px;
  width: calc(100% - 16px);
  background: var(--bg-elevated, rgba(22, 24, 28, 0.96));
  border: 1px solid var(--border-color-light);
  border-radius: 10px;
  padding: 12px;
  z-index: 90;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
}
.tp-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 8px;
}
.tp-auto {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s;
}
.tp-auto:hover {
  background: rgba(255, 255, 255, 0.06);
}
.tp-auto.active {
  background: rgba(var(--accent-rgb), 0.12);
  border-color: rgba(var(--accent-rgb), 0.4);
}
.tp-auto-ic {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--accent-rgb), 0.18);
  color: var(--accent);
  flex: none;
}
.tp-name {
  font-size: 13px;
  color: #fff;
}
.tp-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}
.tp-swatches {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-top: 10px;
}
.tp-swatch {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.25);
  transition: transform 0.12s;
}
.tp-swatch:hover {
  transform: scale(1.12);
}
.tp-swatch.active {
  border-color: #fff;
}

/* ============ 迷你模式 ============ */
.app-container.mini-mode .sidebar,
.app-container.mini-mode .main-wrap,
.app-container.mini-mode .player-bar {
  display: none;
}
.mini-bar {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px 18px;
  background: var(--bg-sidebar, #16181c);
  -webkit-app-region: drag;
  overflow: hidden;
  user-select: none;
  z-index: 200;
}
.mini-bar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
}
.mb-cover {
  width: 70px;
  height: 70px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.35);
  overflow: hidden;
  flex: none;
  cursor: pointer;
  -webkit-app-region: no-drag;
}
.mb-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mb-main {
  flex: 1;
  min-width: 0;
}
.mb-info {
  margin-bottom: 8px;
}
.mb-title {
  font-size: 14px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mb-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.mb-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mb-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  cursor: pointer;
  -webkit-app-region: no-drag;
}
.mb-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.mb-play {
  color: var(--accent);
}
.mb-exit {
  margin-left: auto;
}
.mb-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
  transition: width 0.25s linear;
  pointer-events: none;
  z-index: 1;
}

.footer-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.footer-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.footer-btn.active {
  color: var(--primary-color, var(--accent));
}

/* ============ 主内容包裹 ============ */
.main-wrap {
  margin-left: var(--sidebar-width);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0; /* 关键：允许被压缩，否则内容撑开布局，播放栏被顶出屏幕、页面无法滚动 */
  overflow: hidden;
}

/* ============ 顶部栏 ============ */
.topbar {
  height: var(--titlebar-height);
  background: var(--bg-base);
  display: flex;
  align-items: center;
  padding: 0 0 0 16px;
  gap: 16px;
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.nav-arrows {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.arrow-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: var(--radius-full);
  transition: var(--transition);
}

.arrow-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 无历史可退/可进时置灰 */
.arrow-btn:disabled {
  opacity: 0.28;
  cursor: default;
}

.arrow-btn:disabled:hover {
  background: transparent;
  color: var(--text-secondary);
}

.search-box {
  flex: 1;
  max-width: 440px;
  height: 34px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 8px;
  color: var(--text-tertiary);
  -webkit-app-region: no-drag;
  transition: var(--transition);
}

.search-box:focus-within {
  background: var(--bg-surface);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.topbar-right {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  -webkit-app-region: no-drag;
}

/* ============ 账号面板 ============ */
.account-panel {
  position: absolute;
  top: 42px;
  right: 0;
  width: 300px;
  background: var(--bg-elevated, #1e2025);
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  padding: 14px;
  z-index: 120;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
}
.ap-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: 10px;
}
.ap-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(var(--accent-rgb), 0.18);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  flex: none;
}
.ap-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}
.ap-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}
.ap-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}
.ap-row:hover {
  background: rgba(255, 255, 255, 0.05);
}
.ap-row.current {
  background: rgba(var(--accent-rgb), 0.08);
}
.ap-cur {
  flex: none;
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.16);
  border-radius: 4px;
  padding: 2px 6px;
}
.ap-ic {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex: none;
}
.ap-ic.qq {
  background: rgba(18, 183, 245, 0.16);
  color: #12b7f5;
}
.ap-ic.ne {
  background: rgba(214, 64, 69, 0.16);
  color: #e64545;
}
.ap-ic.hi {
  background: rgba(var(--accent-rgb), 0.16);
  color: var(--accent);
  font-size: 11px;
}
.ap-ic.gb {
  background: rgba(var(--accent-rgb), 0.16);
  color: var(--accent);
  font-size: 11px;
}
.ap-main {
  flex: 1;
  min-width: 0;
}
.ap-row-name {
  font-size: 13px;
  color: #fff;
}
.ap-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: 2px;
}
.ap-dot.good {
  background: #3ddc84;
}
.ap-dot.mid {
  background: #faad14;
}
.ap-dot.bad {
  background: #ff4d4f;
}
.ap-status {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ap-status.on {
  color: var(--accent);
}
.ap-btn {
  flex: none;
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid var(--border-color-light);
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.ap-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.ap-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #06140c;
  font-weight: 600;
}
.ap-btn.primary:hover {
  filter: brightness(1.08);
  background: var(--accent);
}

/* ============ QQ 扫码登录弹窗（账号面板） ============ */
.acc-qr-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}
.acc-qr-card {
  width: 300px;
  background: var(--bg-elevated, #1e2025);
  border: 1px solid var(--border-color-light);
  border-radius: 14px;
  padding: 24px;
  text-align: center;
}
.acc-qr-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #e8e8e8;
}
.acc-qr-imgwrap {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.acc-qr-img {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  background: #fff;
}
.acc-qr-img.dimmed {
  opacity: 0.15;
}
.acc-qr-expired {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  color: #ddd;
  font-size: 13px;
}
.acc-qr-status {
  font-size: 13px;
  color: var(--accent);
  margin-bottom: 6px;
}
.acc-qr-tip {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 14px;
}
.acc-qr-close {
  width: 100%;
}

.user-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
}

.mini-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.win-buttons {
  display: flex;
  height: 32px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.win-btn {
  width: 46px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition: background 0.15s ease, color 0.15s ease;
}

.win-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.win-btn.close:hover {
  background: linear-gradient(to bottom, #ff4757 0%, #e81123 50%, #c20f1f 100%);
  color: #fff;
}

.win-btn.close:active {
  background: linear-gradient(to bottom, #d10f1f 0%, #b30d1b 100%);
}

/* ============ 内容区 ============ */
.main-content {
  flex: 1;
  background: var(--bg-surface);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.placeholder-page {
  padding: 40px;
}

.ph-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.ph-sub {
  color: var(--text-secondary);
  font-size: 14px;
}

/* 全局轻提示：高对比 + 彩色图标，避免融进深色背景 */
.global-toast {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 70vw;
  background: #17241d;
  color: #f2fff8;
  font-size: 14px;
  font-weight: 600;
  padding: 11px 20px 11px 12px;
  border-radius: 12px;
  border: 1px solid rgba(var(--accent-rgb), 0.65);
  box-shadow:
    0 10px 32px rgba(0, 0, 0, 0.6),
    0 0 20px rgba(var(--accent-rgb), 0.28);
  z-index: 900;
  pointer-events: none;
}

.global-toast .toast-icon {
  flex: none;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 800;
  color: #06130c;
  background: var(--color-primary);
}

.global-toast .toast-text {
  line-height: 1.5;
  white-space: pre-line;
  flex: 1;
  min-width: 0;
}
.global-toast .toast-action-btn {
  margin-left: 12px;
  padding: 4px 14px;
  border-radius: 999px;
  border: 1px solid rgba(var(--accent-rgb), 0.7);
  background: rgba(var(--accent-rgb), 0.15);
  color: var(--accent);
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
  transition: all .18s;
}
.global-toast .toast-action-btn:hover {
  background: var(--accent);
  color: #fff;
  transform: translateY(-1px);
}
.global-toast .toast-action-btn:active { transform: translateY(0); }

/* 错误态：红色描边 + 红色图标 */
.global-toast.error {
  background: #241719;
  border-color: rgba(255, 92, 92, 0.7);
  box-shadow:
    0 10px 32px rgba(0, 0, 0, 0.6),
    0 0 20px rgba(255, 92, 92, 0.3);
}

/* ============ 全局确认弹窗（替代原生 window.confirm） ============ */
.confirm-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-card {
  width: 360px;
  max-width: 86vw;
  background: #141a17;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7);
  padding: 22px 24px 18px;
}

.confirm-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #eaf5ee);
  margin-bottom: 10px;
}

.confirm-message {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary, #9fb3a8);
  margin-bottom: 22px;
  white-space: pre-line;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-btn {
  min-width: 76px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: filter 0.15s ease, background 0.15s ease;
}

.confirm-btn.cancel {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-primary, #eaf5ee);
}

.confirm-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.1);
}

.confirm-btn.ok {
  background: var(--color-primary, #1db954);
  color: #06130c;
}

.confirm-btn.ok:hover {
  filter: brightness(1.12);
}

/* 危险操作：红色按钮 */
.confirm-btn.ok.danger {
  background: #e5484d;
  color: #fff;
}

.global-toast.error .toast-icon {
  background: #ff5c5c;
  color: #1a0505;
}

/* toast 专用过渡：顶部下滑淡入 */
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-14px);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

/* ============ 底部播放栏 ============ */
.player-bar {
  position: relative;
  z-index: 300; /* 高于详情页(200)，保证音量弹窗不被遮挡 */
  margin-left: var(--sidebar-width); /* 避免被固定侧边栏遮挡 */
  height: 56px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  transition: height 0.25s ease, margin-left 0.25s ease;
}

/* 详情页展开时：播放栏加高并占满整行宽度 */
.player-bar.expanded {
  margin-left: 0;
  height: 84px;
}

/* ---- 左组：封面+信息+迷你按钮 ---- */
.p-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
  flex-shrink: 0;
}

.p-cover {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--bg-active);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  flex-shrink: 0;
  cursor: pointer;
  overflow: hidden;
}

.p-cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 封面右上角展开图标：悬停显示 */
.p-cover-expand {
  position: absolute;
  right: 1px;
  bottom: 1px;
  width: 15px;
  height: 15px;
  border-top-left-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.p-cover:hover .p-cover-expand {
  opacity: 1;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.p-info {
  min-width: 0;
  cursor: pointer;
}

.p-title-line {
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 190px;
  cursor: pointer;
}

.p-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  flex-shrink: 1;
}

.p-dash {
  color: var(--text-tertiary);
  margin: 0 4px;
  flex: none;
}

.p-vip-chip {
  flex: none;
  margin-left: 6px;
  font-size: 10px;
  font-style: normal;
  color: #ffb023;
  border: 1px solid #ffb023;
  border-radius: 4px;
  padding: 0 4px;
  line-height: 15px;
}

.p-artist {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 2;
}

/* 播放栏歌手名可点击（在线歌带 singerId 时） */
.p-artist.clickable {
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s;
}

.p-artist.clickable:hover {
  color: var(--accent);
}

.p-mini {
  display: flex;
  gap: 2px;
  margin-top: 3px;
}

.pmini-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.pmini-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.pmini-btn.favorite {
  color: var(--color-primary);
}

.pmini-btn.active {
  color: var(--color-primary);
  background: rgba(var(--accent-rgb), 0.12);
}

/* ---- 中左组：随机/上一首/播放/下一首/循环 ---- */
.p-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pctrl-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: var(--radius-full);
  transition: all 0.2s;
}

.pctrl-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.pctrl-btn.active {
  color: var(--color-primary);
}

.pctrl-btn.active:hover {
  background: rgba(var(--accent-rgb), 0.12);
}

.pplay-btn {
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  color: #fff !important;
  box-shadow:
    0 0 12px rgba(var(--accent-rgb), 0.4),
    0 2px 8px rgba(var(--accent-rgb), 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: all 0.2s;
  margin: 0 2px;
}

.pplay-btn:hover {
  background: var(--color-primary-hover);
  transform: scale(1.08);
  box-shadow:
    0 0 16px rgba(var(--accent-rgb), 0.55),
    0 4px 12px rgba(var(--accent-rgb), 0.35);
}

/* ---- 进度条 ---- */
.p-progress {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 8px;
}

.p-time {
  font-size: 11px;
  color: var(--text-tertiary);
  min-width: 30px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.p-time:last-child {
  text-align: left;
}

.p-track {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
  min-width: 60px;
  transition: height 0.15s;
}

.p-track:hover {
  height: 6px;
}

.p-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  position: relative;
  box-shadow: 0 0 6px rgba(var(--accent-rgb), 0.3);
}

.p-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow:
    0 2px 6px rgba(0,0,0,0.5),
    0 0 0 1px rgba(0,0,0,0.08);
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
}

.p-track:hover .p-thumb {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.1);
}

/* ---- 右组：音量/SQ/歌词/列表 ---- */
.p-right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.p-volume {
  display: flex;
  align-items: center;
  position: relative;
}

.pvol-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  position: relative;
}

.pvol-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.pvol-btn.muted {
  color: var(--color-primary);
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-right: 4px;
  -webkit-app-region: no-drag;
}

.vt-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.vt-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.vt-btn.active {
  color: var(--color-primary);
}

.vt-btn.active:hover {
  background: rgba(var(--accent-rgb), 0.1);
}

.win-buttons {
  display: flex;
  align-items: center;
  gap: 0;
  -webkit-app-region: no-drag;
  margin-left: auto;
}

/* fade transition */
.vol-fade-enter-active,
.vol-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.vol-fade-enter-from,
.vol-fade-leave-to {
  opacity: 0;
  transform: translateX(50%) translateY(4px);
}
.vol-fade-enter-to,
.vol-fade-leave-from {
  opacity: 1;
  transform: translateX(50%) translateY(0);
}

.pvol-popup {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: #2a2a2e;
  border-radius: 10px;
  padding: 14px 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.55),
    0 2px 8px rgba(0, 0, 0, 0.35);
  z-index: 200;
  min-width: 56px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* pointer arrow pointing down to the volume button */
.pvol-arrow {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background: #2a2a2e;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.pvol-vslider {
  position: relative;
  width: 24px;
  height: 110px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  display: flex;
  justify-content: center;
}

.pvol-vtrack {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.pvol-vfill {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  background: linear-gradient(180deg, var(--accent) 0%, var(--accent-deep) 100%);
  border-radius: 2px;
  pointer-events: none;
  box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.4);
  transition: height 0.02s linear;
}

.pvol-vthumb {
  position: absolute;
  left: 50%;
  width: 14px;
  height: 14px;
  background: transparent;
  transform: translate(-50%, 50%);
  pointer-events: none;
  transition: bottom 0.02s linear;
}

.pvol-thumb-inner {
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s;
}

.pvol-vslider:hover .pvol-thumb-inner {
  transform: scale(1.15);
}

.pvol-vlabel {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  margin-top: 2px;
}

.pvol-vlabel.is-muted {
  color: var(--color-primary);
}

.pvol-mute {
  width: 28px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.45);
  border-radius: 6px;
  transition: all 0.15s;
  margin-top: 2px;
}

.pvol-mute:hover {
  color: var(--color-primary);
  background: rgba(var(--accent-rgb), 0.1);
}

.pvol-mute.active {
  color: var(--color-primary);
}

.pfeat-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  transition: all 0.2s;
  position: relative;
}

.pfeat-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.pfeat-btn.active {
  color: var(--color-primary);
  background: rgba(var(--accent-rgb), 0.12);
}

.pfeat-btn.sq {
  width: auto;
  padding: 0 6px;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  cursor: default; /* 纯展示徽章，不可点击 */
}

.pfeat-btn.sq:hover {
  background: transparent;
  color: var(--color-primary);
}

/* 桌面歌词按钮（文字） */
.pfeat-btn.dtly {
  width: auto;
  padding: 0 7px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.pfeat-btn.dtly:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.pfeat-btn.dtly.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.pfeat-btn.has-badge .badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 14px;
  height: 14px;
  background: var(--color-primary);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

/* ============ 播放队列抽屉 ============ */
.queue-drawer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: var(--player-height);
  background: rgba(0, 0, 0, 0.5);
  /* 低于播放栏(300)：音量弹窗弹出时不会被抽屉遮挡；高于详情页(200) */
  z-index: 250;
  display: flex;
  justify-content: flex-end;
}

.queue-panel {
  width: 360px;
  height: 100%;
  background: var(--bg-elevated);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.queue-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  font-size: 15px;
  font-weight: 600;
  gap: 6px;
}

.queue-header .queue-count {
  color: var(--text-tertiary);
  font-weight: 400;
}

.close-btn {
  margin-left: auto;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.queue-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  cursor: pointer;
  transition: var(--transition);
}

.queue-item:hover {
  background: var(--bg-hover);
}

.queue-item.active {
  background: var(--color-primary-soft);
}

.queue-item.active .q-title {
  color: var(--color-primary);
}

.q-index {
  width: 24px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.q-info {
  flex: 1;
  min-width: 0;
}

.q-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.q-artist {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.q-duration {
  font-size: 12px;
  color: var(--text-tertiary);
}

.queue-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 13px;
  gap: 12px;
}

.queue-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
}

.queue-footer button {
  height: 30px;
  padding: 0 14px;
  background: var(--bg-hover);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 12px;
  transition: var(--transition);
}

.queue-footer button:hover {
  background: #5a2d2d;
  color: #ff8080;
}

/* 抽屉动画 */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-active .queue-panel,
.drawer-leave-active .queue-panel {
  transition: transform 0.2s ease;
}

.drawer-enter-from .queue-panel,
.drawer-leave-to .queue-panel {
  transform: translateX(100%);
}

/* 滚动条美化 */
.sidebar ::-webkit-scrollbar,
.playlist-list::-webkit-scrollbar,
.queue-list::-webkit-scrollbar {
  width: 6px;
}

.sidebar ::-webkit-scrollbar-track,
.playlist-list::-webkit-scrollbar-track,
.queue-list::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar ::-webkit-scrollbar-thumb,
.playlist-list::-webkit-scrollbar-thumb,
.queue-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.sidebar ::-webkit-scrollbar-thumb:hover,
.playlist-list::-webkit-scrollbar-thumb:hover,
.queue-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* ---- 歌词面板覆盖层 ---- */
.lyrics-overlay {
  position: fixed;
  top: 0;
  left: var(--sidebar-width, 200px);
  right: 0;
  bottom: var(--player-height, 64px);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyrics-panel-wrapper {
  width: 90%;
  max-width: 700px;
  height: 80%;
  max-height: 500px;
  background: var(--bg-surface);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-color);
}

.lyrics-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
}

.lyrics-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--text-primary);
}

/* fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

/* 歌曲详情页过渡：轻微上移淡入 */
.np-fade-enter-active,
.np-fade-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.np-fade-enter-from,
.np-fade-leave-to {
  opacity: 0;
  transform: translateY(24px);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

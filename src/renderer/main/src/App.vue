<template>
  <div class="app-container">
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
          :class="{ active: activeNav === 'local' }"
          @click="activeNav = 'local'"
        >
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h-5v-2h3V7h2v6z"/></svg>
          <span>最近播放</span>
        </div>
        <div class="nav-btn new-playlist">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
          <span>新建歌单</span>
        </div>
      </div>

      <!-- 音乐库分组 -->
      <div class="library-section">
        <div class="library-item">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
          <span>喜欢</span>
          <span class="count">{{ favoritesCount }}</span>
        </div>
        <div
          class="library-item"
          :class="{ active: activeNav === 'local' }"
          @click="activeNav = 'local'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h-5v-2h3V7h2v6z"/></svg>
          <span>最近播放</span>
          <span class="count">{{ historyCount }}</span>
        </div>
        <div class="library-item">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2zm-1-2V7l-5 3-5-3v12h10z"/></svg>
          <span>本地和下载</span>
        </div>
        <div class="library-item">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
          <span>已购音乐</span>
        </div>
        <div class="library-item">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 13h8v2H8zm0-4h8v2H8z"/></svg>
          <span>试听列表</span>
        </div>
      </div>

      <!-- 自建歌单分组 -->
      <div class="playlist-section">
        <div class="section-header">
          <span>自建歌单</span>
          <span class="divider">|</span>
          <span>收藏歌单</span>
          <button class="add-btn" title="新建歌单">
            <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M8 3a1 1 0 011 1v3h3a1 1 0 110 2H9v3a1 1 0 11-2 0V9H4a1 1 0 110-2h3V4a1 1 0 011-1z"/></svg>
          </button>
        </div>
        <div class="playlist-list">
          <div
            v-for="pl in myPlaylists"
            :key="pl.id"
            class="playlist-item"
            @click="activeNav = 'local'"
          >
            <div class="mini-cover" :style="{ background: pl.color }">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 3v9.55A4 4 0 1014 16V7h4V3z"/></svg>
            </div>
            <span class="pl-name">{{ pl.name }}</span>
          </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <button class="footer-btn" title="设置">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        </button>
        <button class="footer-btn" title="皮肤">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 16a7 7 0 110-14 7 7 0 010 14zm-3-9a2 2 0 114 0 2 2 0 01-4 0z"/></svg>
        </button>
        <button class="footer-btn" title="迷你模式">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"/></svg>
        </button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main-wrap">
      <!-- 顶部：导航 + 搜索 + 窗口按钮 -->
      <header class="topbar">
        <div class="nav-arrows">
          <button class="arrow-btn" title="后退">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button class="arrow-btn" title="前进">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
        </div>

        <div class="search-box">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input
            v-model="searchKeyword"
            class="search-input"
            placeholder="搜索音乐"
            @keyup.enter="activeNav = 'local'"
          />
        </div>

        <div class="topbar-right">
          <button class="user-btn">
            <div class="mini-avatar">U</div>
          </button>
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
        <!-- 本地音乐 -->
        <LocalMusic
          v-if="activeNav === 'local'"
          :search-keyword="searchKeyword"
          :view-mode="viewMode"
        />

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
    <footer class="player-bar">
      <!-- 左组：封面 + 信息 + 迷你按钮 -->
      <div class="p-left">
        <div class="p-cover" :class="{ spinning: player.isPlaying }" @click="player.toggleQueue()">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3v9.55A4 4 0 1014 16V7h4V3z"/></svg>
        </div>
        <div class="p-info" @click="player.toggleQueue()">
          <div class="p-title">{{ player.currentTrack?.title || '未在播放' }}</div>
          <div class="p-artist">{{ player.currentTrack ? (player.currentTrack.artist || '未知艺人') : '选择歌曲开始播放' }}</div>
        </div>
        <div class="p-mini" v-if="player.currentTrack">
          <button class="pmini-btn favorite" title="收藏">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
          </button>
          <button class="pmini-btn" title="歌词" :class="{ active: player.showLyricsPanel }" @click="player.toggleLyricsPanel()">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 4h16v2H4zm0 5h12v2H4zm0 5h16v2H4zm0 5h8v2H4z"/></svg>
          </button>
          <button class="pmini-btn" title="更多">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 2a2 2 0 100-4 2 2 0 000 4zm0 2a2 2 0 100-4 2 2 0 000 4z"/></svg>
          </button>
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
        <div class="p-track" @click="handleProgressClick">
          <div class="p-fill" :style="{ width: player.progress + '%' }"></div>
          <div class="p-thumb" :style="{ left: player.progress + '%' }"></div>
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
        <button class="pfeat-btn sq" title="音质">SQ</button>
        <button class="pfeat-btn" title="歌词" :class="{ active: player.showLyricsPanel }" @click="player.toggleLyricsPanel()">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4 4h16v2H4zm0 5h12v2H4zm0 5h16v2H4zm0 5h8v2H4z"/></svg>
        </button>
        <button class="pfeat-btn has-badge" title="播放列表" @click="player.toggleQueue()">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3zm0 4h14v2H3zm17-9v10l-4-5z"/></svg>
          <span v-if="player.queue.length > 0" class="badge">{{ player.queue.length }}</span>
        </button>
      </div>
    </footer>

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
          <div class="queue-list" v-if="player.queue.length > 0">
            <div
              v-for="(track, idx) in player.queue"
              :key="track.id"
              class="queue-item"
              :class="{ active: player.currentTrack?.id === track.id }"
              @click="player.playIndex(idx)"
            >
              <span class="q-index">{{ idx + 1 }}</span>
              <div class="q-info">
                <div class="q-title">{{ track.title }}</div>
                <div class="q-artist">{{ track.artist }}</div>
              </div>
              <span class="q-duration">{{ formatTime(track.duration) }}</span>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { usePlayerStore } from './stores/player'
import LocalMusic from './views/LocalMusic.vue'
import LyricsPanel from './components/LyricsPanel.vue'

const player = usePlayerStore()

const isMax = ref(false)
const activeNav = ref('local')
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

const myPlaylists = ref([
  { id: 1, name: 'pets', color: 'linear-gradient(135deg, #3a1c71, #d76d77, #ffaf7b)' },
  { id: 2, name: '新建歌单7', color: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { id: 3, name: 'ktv歌单', color: 'linear-gradient(135deg, #ee0979, #ff6a00)' },
  { id: 4, name: '新建歌单6', color: 'linear-gradient(135deg, #56ab2f, #a8e063)' }
])

const currentNavLabel = computed(() => {
  const map = { discover: '首页', local: '最近播放', mine: '我的音乐', playlist: '我的歌单', history: '播放历史', settings: '设置' }
  return map[activeNav.value] || '首页'
})

const playModeLabel = computed(() => {
  const map = { list: '列表循环', random: '随机播放', single: '单曲循环' }
  return map[player.playMode] || player.playMode
})

onMounted(async () => {
  isMax.value = await window.mscAPI.isMaximized()

  // 加载配置
  const config = await window.mscAPI.getConfig()
  if (config.volume != null) {
    player.setVolume(config.volume)
  }

  // 获取歌曲数量
  try {
    const listResult = await window.mscAPI.listMusic({ pageSize: 1 })
    favoritesCount.value = listResult.total || 0
    historyCount.value = listResult.total || 0
  } catch (e) {}
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

function handleProgressClick(e) {
  if (!player.duration) return
  const rect = e.currentTarget.getBoundingClientRect()
  const percent = ((e.clientX - rect.left) / rect.width) * 100
  player.seek(percent)
}

function handleLyricSeek(time) {
  if (!player.duration) return
  const percent = (time / player.duration) * 100
  player.seek(percent)
}

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

.library-item .count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-elevated);
  padding: 1px 6px;
  border-radius: var(--radius-full);
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

/* 侧边栏底部 */
.sidebar-footer {
  display: flex;
  justify-content: space-around;
  padding: 8px 12px 4px;
  border-top: 1px solid var(--border-color-light);
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

/* ============ 主内容包裹 ============ */
.main-wrap {
  margin-left: var(--sidebar-width);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
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
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  -webkit-app-region: no-drag;
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

/* ============ 底部播放栏 ============ */
.player-bar {
  height: 56px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
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
}

.p-cover.spinning {
  animation: spin 8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.p-info {
  min-width: 0;
  cursor: pointer;
}

.p-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
  font-weight: 500;
}

.p-artist {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
  margin-top: 2px;
}

.p-mini {
  display: flex;
  gap: 0;
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
  background: rgba(33, 195, 122, 0.12);
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
  background: rgba(33, 195, 122, 0.12);
}

.pplay-btn {
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  color: #fff !important;
  box-shadow:
    0 0 12px rgba(33, 195, 122, 0.4),
    0 2px 8px rgba(33, 195, 122, 0.25);
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
    0 0 16px rgba(33, 195, 122, 0.55),
    0 4px 12px rgba(33, 195, 122, 0.35);
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
  box-shadow: 0 0 6px rgba(33, 195, 122, 0.3);
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
  background: rgba(33, 195, 122, 0.1);
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
  background: linear-gradient(180deg, #21C37A 0%, #1aa867 100%);
  border-radius: 2px;
  pointer-events: none;
  box-shadow: 0 0 8px rgba(33, 195, 122, 0.4);
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
  background: rgba(33, 195, 122, 0.1);
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
  background: rgba(33, 195, 122, 0.12);
}

.pfeat-btn.sq {
  width: auto;
  padding: 0 6px;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
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
  z-index: 1000;
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

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

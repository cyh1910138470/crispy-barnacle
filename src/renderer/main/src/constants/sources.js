// 音源显示名称（全应用统一：账号面板 / 在线音乐页 / 搜索结果页 / 歌手页）
// 第三方源统一用「三方源N」编号命名，按界面排列顺序编号
export const SOURCE_NAMES = {
  qq: 'QQ音乐',
  netease: '网易云音乐',
  higequ: '三方源1',
  gequbao: '三方源2',
  onemusic: '三方源3',
  xmwav: '三方源4',
  gmmp3: '三方源5'
}

// 三方源质量标识（账号面板 / 切换栏的小圆点颜色）：
// 'good' 绿=稳定可用 / 'mid' 黄=能用但慢或有验证 / 'bad' 红=风控严易失败
export const SOURCE_QUALITY = {
  higequ: 'good',
  gequbao: 'bad',
  onemusic: 'mid',
  xmwav: 'good',
  gmmp3: 'good'
}


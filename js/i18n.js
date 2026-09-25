// 极简 i18n：仅覆盖设置页自身文案
const dict = {
  'zh-CN': {
    title: '偏好设置',
    theme: '主题',
    themeLight: '亮',
    themeDark: '暗',
    themeSystem: '跟随系统',
    fontSize: '字体大小',
    language: '语言',
    sidebar: '侧边栏',
    sidebarToggle: '折叠侧边栏',
    reset: '恢复默认',
    storageMode: '存储模式',
    modeIndexeddb: 'IndexedDB（持久化）',
    modeLocalstorage: 'localStorage（持久化，IDB 不可用）',
    modeMemory: '内存（隐私模式，不持久化）',
    demoTitle: '演示内容',
    demoText: '这是一段演示文本，用于预览主题与字体大小效果。',
    menu1: '菜单项一',
    menu2: '菜单项二',
    menu3: '菜单项三',
  },
  en: {
    title: 'Preferences',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    fontSize: 'Font size',
    language: 'Language',
    sidebar: 'Sidebar',
    sidebarToggle: 'Collapse sidebar',
    reset: 'Reset to defaults',
    storageMode: 'Storage mode',
    modeIndexeddb: 'IndexedDB (persistent)',
    modeLocalstorage: 'localStorage (persistent, IDB unavailable)',
    modeMemory: 'In-memory (private mode, not persistent)',
    demoTitle: 'Demo content',
    demoText: 'This is demo text to preview theme and font size.',
    menu1: 'Menu item one',
    menu2: 'Menu item two',
    menu3: 'Menu item three',
  },
};

export function t(lang, key) {
  const table = dict[lang] || dict['zh-CN'];
  return table[key] ?? key;
}

export function applyI18n(lang) {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(lang, el.dataset.i18n);
  });
}

/* 简单双语字典，仅覆盖设置面板自身文案 */
(function (global) {
  'use strict';

  var dict = {
    zh: {
      title: '偏好设置',
      theme: '主题',
      themeLight: '亮色',
      themeDark: '暗色',
      themeSystem: '跟随系统',
      fontSize: '字体大小',
      fontSmall: '小',
      fontMedium: '中',
      fontLarge: '大',
      language: '语言',
      sidebar: '侧边栏',
      collapse: '折叠',
      expand: '展开',
      sidebarContent: '侧边栏内容',
      mainContent: '主内容区',
      reset: '恢复默认',
      memoryWarning: '当前为隐私/受限模式，设置仅保存在内存中，关闭页面后将丢失。',
      storageMode: '存储模式'
    },
    en: {
      title: 'Preferences',
      theme: 'Theme',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeSystem: 'System',
      fontSize: 'Font Size',
      fontSmall: 'Small',
      fontMedium: 'Medium',
      fontLarge: 'Large',
      language: 'Language',
      sidebar: 'Sidebar',
      collapse: 'Collapse',
      expand: 'Expand',
      sidebarContent: 'Sidebar content',
      mainContent: 'Main content',
      reset: 'Reset to defaults',
      memoryWarning: 'Private/restricted mode: settings are kept in memory only and will be lost after closing this page.',
      storageMode: 'Storage mode'
    }
  };

  global.I18N = {
    t: function (lang, key) {
      var table = dict[lang] || dict.zh;
      return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key;
    }
  };
})(window);

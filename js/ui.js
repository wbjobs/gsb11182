/* UI 绑定：把设置状态渲染到控件，把控件事件写回 SettingsManager */
(function (global) {
  'use strict';

  var manager = global.SettingsManager.create();

  function t(key) {
    return global.I18N.t(manager.getState().language, key);
  }

  function renderTexts() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    var toggleBtn = document.getElementById('sidebar-toggle');
    toggleBtn.textContent = manager.getState().sidebarCollapsed ? t('expand') : t('collapse');
    var warning = document.getElementById('memory-warning');
    warning.hidden = manager.getState().persistent;
    warning.textContent = t('memoryWarning');
    document.getElementById('storage-mode').textContent =
      t('storageMode') + ': ' + manager.getState().storageMode;
  }

  function renderControls(state) {
    document.querySelectorAll('input[name="theme"]').forEach(function (radio) {
      radio.checked = radio.value === state.theme;
    });
    document.querySelectorAll('input[name="fontSize"]').forEach(function (radio) {
      radio.checked = radio.value === state.fontSize;
    });
    document.getElementById('language-select').value = state.language;
  }

  function render(state) {
    renderTexts();
    renderControls(state);
  }

  function bindEvents() {
    document.querySelectorAll('input[name="theme"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) manager.set('theme', radio.value);
      });
    });
    document.querySelectorAll('input[name="fontSize"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) manager.set('fontSize', radio.value);
      });
    });
    document.getElementById('language-select').addEventListener('change', function (event) {
      manager.set('language', event.target.value);
    });
    document.getElementById('sidebar-toggle').addEventListener('click', function () {
      manager.set('sidebarCollapsed', !manager.getState().sidebarCollapsed);
    });
    document.getElementById('reset-btn').addEventListener('click', function () {
      manager.reset();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    manager.subscribe(render);
    manager.init();
  });
})(window);

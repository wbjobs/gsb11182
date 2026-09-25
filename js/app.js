import { settingsStore } from './settings.js';
import { storage } from './storage.js';
import { applyI18n, t } from './i18n.js';

const controls = {};

function render(state) {
  applyI18n(state.language);

  controls.theme.forEach((radio) => {
    radio.checked = radio.value === state.theme;
  });
  controls.fontSize.value = String(state.fontSize);
  controls.fontSizeValue.textContent = state.fontSize + 'px';
  controls.language.value = state.language;
  controls.sidebarCollapsed.checked = state.sidebarCollapsed;

  const modeKey = {
    indexeddb: 'modeIndexeddb',
    localstorage: 'modeLocalstorage',
    memory: 'modeMemory',
  }[storage.mode];
  controls.storageMode.textContent = t(state.language, modeKey);
  controls.storageMode.dataset.mode = storage.mode;
}

function bind() {
  controls.theme.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) settingsStore.set({ theme: radio.value });
    });
  });
  controls.fontSize.addEventListener('input', () => {
    settingsStore.set({ fontSize: Number(controls.fontSize.value) });
  });
  controls.language.addEventListener('change', () => {
    settingsStore.set({ language: controls.language.value });
  });
  controls.sidebarCollapsed.addEventListener('change', () => {
    settingsStore.set({ sidebarCollapsed: controls.sidebarCollapsed.checked });
  });
  controls.reset.addEventListener('click', () => settingsStore.reset());
}

async function main() {
  controls.theme = Array.from(document.querySelectorAll('input[name="theme"]'));
  controls.fontSize = document.getElementById('font-size');
  controls.fontSizeValue = document.getElementById('font-size-value');
  controls.language = document.getElementById('language');
  controls.sidebarCollapsed = document.getElementById('sidebar-collapsed');
  controls.reset = document.getElementById('reset');
  controls.storageMode = document.getElementById('storage-mode');

  const state = await settingsStore.init();
  bind();
  render(state);
  settingsStore.subscribe((next) => render(next));
}

main();

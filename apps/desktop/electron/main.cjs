// Electron main process: starts the local API when it is not running yet and opens the UI.
const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const API_PORT = Number(process.env.PORT ?? 3000);
const API_URL = process.env.EVERGREEN_API_URL ?? `http://localhost:${API_PORT}`;
const UI_URL = process.env.EVERGREEN_UI_URL; // e.g. http://localhost:4200 with `pnpm ui:dev`
const API_DIR = path.resolve(__dirname, '..', '..', 'api');
const API_ENTRY = path.join(API_DIR, 'dist', 'main.js');
const HEALTH_TIMEOUT_MS = 30_000;

/** Manual opt-in only: `electron . --new-window` or EVERGREEN_NEW_WINDOW=1 */
const ALLOW_SECOND_INSTANCE =
  process.argv.includes('--new-window') || process.env.EVERGREEN_NEW_WINDOW === '1';

let apiProcess = null;
let mainWindow = null;

async function apiIsUp() {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function startApi(binary, extraEnv) {
  apiProcess = spawn(binary, [API_ENTRY], {
    cwd: API_DIR,
    env: { ...process.env, ...extraEnv, PORT: String(API_PORT) },
    stdio: 'inherit',
  });
  apiProcess.on('error', (err) => {
    apiProcess = null;
    // No system Node on PATH (e.g. started from Finder): the Electron binary can act as Node.
    if (err.code === 'ENOENT' && binary !== process.execPath) startApi(process.execPath, { ELECTRON_RUN_AS_NODE: '1' });
    else console.error(`API failed to start: ${err.message}`);
  });
  apiProcess.on('exit', (code) => {
    if (code) console.error(`API exited with code ${code}`);
    apiProcess = null;
  });
}

async function ensureApi() {
  if (await apiIsUp()) return;
  if (!fs.existsSync(API_ENTRY)) {
    console.warn(`API is not running and ${API_ENTRY} is missing; run "pnpm --filter @youtube-ai-tool/api build".`);
    return;
  }
  startApi(process.env.EVERGREEN_NODE ?? 'node', {});
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await apiIsUp()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error('API did not become healthy in time; the UI shows it as unreachable.');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 640,
    title: 'Evergreen Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--evergreen-api=${API_URL}`],
    },
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (UI_URL) void mainWindow.loadURL(UI_URL);
  else void mainWindow.loadFile(path.resolve(__dirname, '..', 'dist', 'browser', 'index.html'));
  return mainWindow;
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function startApp() {
  app.whenReady().then(async () => {
    await ensureApi();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else focusMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    apiProcess?.kill();
  });
}

if (!ALLOW_SECOND_INSTANCE) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.info('Evergreen Studio is already running. Close it first, or pass --new-window to open another.');
    app.quit();
  } else {
    app.on('second-instance', () => {
      focusMainWindow();
    });
    startApp();
  }
} else {
  startApp();
}

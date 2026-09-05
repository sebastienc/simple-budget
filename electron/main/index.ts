import { app, BrowserWindow } from 'electron';
import { LOCAL_SERVER_PORT, startServer } from './server';
import { initDb } from './db';
import { snapshotOnQuit, startBackupSchedule } from './backup/schedule';

async function createWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${LOCAL_SERVER_PORT}`);
  }
}

app.whenReady().then(async () => {
  await initDb();
  await startServer();
  await createWindow();
  startBackupSchedule();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/** Longest quitting will wait on a backup before giving up on it. */
const QUIT_BACKUP_TIMEOUT = 5000;

let quitting = false;

/*
 * The last thing you do before quitting is often the edit worth keeping, so a
 * snapshot is taken on the way out. Quit is deferred to allow it, but never
 * held hostage by it: an unreachable network drive must not turn Cmd-Q into a
 * hang, so the wait is capped and quitting proceeds either way.
 */
app.on('before-quit', (event) => {
  if (quitting) {
    return;
  }
  quitting = true;
  event.preventDefault();

  const deadline = new Promise((resolve) => setTimeout(resolve, QUIT_BACKUP_TIMEOUT));
  Promise.race([snapshotOnQuit(), deadline]).finally(() => app.quit());
});

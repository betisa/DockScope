import { app, BrowserWindow, shell, Tray, Menu, nativeImage } from 'electron'
import path from 'node:path'
import { cleanupOwnerSessions, registerIpc } from './ipc'
import { operationalIntelligence } from './monitoring/operationalIntelligence'
import { auditService } from './services/auditService'
import { applicationSettingsService } from './services/applicationSettingsService'
import { storageTrendService } from './services/storageTrendService'
import { databaseService } from './database/database'
import { updateService } from './services/updateService'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false


function appIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(app.getAppPath(), 'build', 'icon.png')
}

function trayIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon-tray.png')
    : path.join(app.getAppPath(), 'build', 'icon-tray.png')
}

function showMainWindow() {
  if (!mainWindow) createWindow()
  mainWindow?.show()
  mainWindow?.focus()
}

function createTray() {
  if (tray) return
  const trayImage = nativeImage.createFromPath(trayIconPath())
  tray = new Tray(trayImage.isEmpty() ? nativeImage.createFromPath(appIconPath()) : trayImage)
  tray.setToolTip('DockScope')

  const refreshMenu = async () => {
    const health = await operationalIntelligence.refresh().catch(() => operationalIntelligence.getHealth())
    tray?.setContextMenu(Menu.buildFromTemplate([
      { label: health.dockerReachable ? '● Docker Running' : '● Docker Unavailable', enabled:false },
      { label: `${health.runningContainers} running · ${health.unhealthyContainers} unhealthy · ${health.stoppedContainers} stopped`, enabled:false },
      { type:'separator' },
      { label:'Open Dashboard', click:showMainWindow },
      { label:'Open Notifications', click:()=>{ showMainWindow(); mainWindow?.webContents.send('app:navigate','notifications') } },
      { label:'Refresh Status', click:()=>void refreshMenu() },
      { type:'separator' },
      { label:'Exit', click:()=>app.quit() }
    ]))
  }

  tray.on('click', showMainWindow)
  void refreshMenu()
  setInterval(() => void refreshMenu(), 60_000)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    icon: appIconPath(),
    show: false,
    backgroundColor: '#090b10',
    title: 'DockScope',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d1017',
      symbolColor: '#a9b1c3',
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  const ownerWebContentsId = mainWindow.webContents.id
  mainWindow.webContents.on('destroyed', () => cleanupOwnerSessions(ownerWebContentsId))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? ''
    if (url !== current) event.preventDefault()
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (event) => {
    const settings = applicationSettingsService.get()
    if (!isQuitting && settings.general.closeToTray && process.env.NODE_ENV !== 'test') {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.once('ready-to-show', () => {
    const settings = applicationSettingsService.get()
    if (!settings.general.startMinimized || process.env.NODE_ENV === 'test') mainWindow?.show()
  })
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.dockscope.desktop')
  }
  await databaseService.initialize()
  await applicationSettingsService.initialize()
  await updateService.initialize()
  registerIpc()
  void operationalIntelligence.initialize()
  void auditService.initialize()
  void storageTrendService.initialize()
  createWindow()
  if (process.env.NODE_ENV !== 'test') createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  const settings = applicationSettingsService.get()
  if (!settings.general.closeToTray && process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { isQuitting = true; operationalIntelligence.dispose(); storageTrendService.dispose(); void databaseService.close() })

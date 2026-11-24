import { registerSW } from 'virtual:pwa-register'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export interface InstallState {
  canPrompt: boolean
  installed: boolean
}

type UpdateListener = (available: boolean) => void
type InstallListener = (state: InstallState) => void

let updateAvailable = false
let updateActivated = false
let updateServiceWorker: (reloadPage?: boolean) => Promise<void> = async () => undefined
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null
let initialized = false
const updateListeners = new Set<UpdateListener>()
const installListeners = new Set<InstallListener>()

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

function installState(): InstallState {
  return { canPrompt: deferredInstallPrompt !== null, installed: isStandalone() }
}

function notifyUpdate() {
  for (const listener of updateListeners) listener(updateAvailable)
}

function notifyInstall() {
  const state = installState()
  for (const listener of installListeners) listener(state)
}

export function initializePwa() {
  if (initialized) return
  initialized = true

  if ('serviceWorker' in navigator) {
    let hadController = navigator.serviceWorker.controller !== null
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) {
        updateActivated = true
        updateAvailable = true
        notifyUpdate()
      }
      hadController = true
    })
  }

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateActivated = false
      updateAvailable = true
      notifyUpdate()
    },
  })

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event as BeforeInstallPromptEvent
    notifyInstall()
  })
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    notifyInstall()
  })
}

export function subscribePwaUpdate(listener: UpdateListener) {
  updateListeners.add(listener)
  listener(updateAvailable)
  return () => { updateListeners.delete(listener) }
}

export function applyPwaUpdate() {
  if (updateActivated) {
    window.location.reload()
    return Promise.resolve()
  }
  return updateServiceWorker(true)
}

export function dismissPwaUpdate() {
  updateAvailable = false
  notifyUpdate()
}

export function subscribeInstallState(listener: InstallListener) {
  installListeners.add(listener)
  listener(installState())
  return () => { installListeners.delete(listener) }
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return 'unavailable' as const
  const prompt = deferredInstallPrompt
  await prompt.prompt()
  const choice = await prompt.userChoice
  if (choice.outcome === 'accepted') deferredInstallPrompt = null
  notifyInstall()
  return choice.outcome
}

const tutorialStateKey = 'kadrowka_tutorial_state_v1'

export type TutorialState = 'new' | 'dismissed' | 'completed'

export function tutorialState(): TutorialState {
  const stored = localStorage.getItem(tutorialStateKey)
  return stored === 'dismissed' || stored === 'completed' ? stored : 'new'
}

export function setTutorialState(state: Exclude<TutorialState, 'new'>) {
  localStorage.setItem(tutorialStateKey, state)
  window.dispatchEvent(new CustomEvent('kadrowka:tutorial-state', { detail: state }))
}

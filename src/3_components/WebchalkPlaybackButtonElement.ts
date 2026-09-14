import { KeyboardKey } from "../4_utils/interfaces";

const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(
  /*css*/`:host {
    display: inline-block;
  }

  .playback-button {
    width: 25.6px;
    height: 25.6px;
    background-color: var(--webchalk-playback-button-background-color);
    border: 1.4px solid var(--webchalk-playback-button-background-color);
    border-radius: 2px;
    padding: 1.8px !important;
  
    box-shadow: 3.2px 3.2px 3.2px rgba(0, 0, 0, 0.4);
    transform: scale(1);
    transition: all 0.02s;
  
    cursor: pointer;
    
    display: inline-block;
  }
  
  .playback-button--disabledPointerFromPause,
  .playback-button--disabledPointerFromStepping {
    cursor: not-allowed;
  }
  
  .playback-button--disabledFromTimelineEdge,
  .playback-button--disabledFromPause,
  .playback-button--disabledFromStepping {
    background-color: var(--webchalk-playback-button-disabled-color);
    cursor: not-allowed;
  }
  
  .playback-button--pressed {
    transform: scale(0.90);
    box-shadow: 0.64px 0.64px 0.64px rgba(0, 0, 0, 0.8);
  }
  
  :host([trigger="press"]) .playback-button--pressed {
    background-color: var(--webchalk-playback-button-press-color);
  }
  
  :host([trigger="hold"]) .playback-button--pressed {
    background-color: var(--webchalk-playback-button-hold-color);
  }
  
  .playback-button__symbol {
    width: 100%;
    height: auto;
    fill: var(--webchalk-playback-button-symbol-color);
  }`
);

export class WebchalkPlaybackButtonElement extends HTMLElement {
  /**@internal*/ static addToCustomElementRegistry() { customElements.define('webchalk-playback-button', WebchalkPlaybackButtonElement); }

  buttonElement: HTMLButtonElement;
  action: `step-${'forward' | 'backward'}` | 'pause' | 'fast-forward' | 'toggle-skipping';
  shortcutKey: KeyboardKey | null;
  setShortcutKey(key: KeyboardKey | null) {
    this.shortcutKey = key;
    if (!key) {
      this.removeAttribute('shortcut');
      this.removeAttribute('title');
    }
    else {
      this.setUpListeners();
    }
  }
  triggerMode: 'press' | 'hold' = 'press';
  allowHolding: boolean = false; // repeat key
  private _mouseHeld: boolean = false;
  private _shortcutHeld: boolean = false;
  private _enterHeld: boolean = false;
  private _active: boolean = false;
  private _disabled: boolean = false;
  get mouseHeld(): boolean { return this._mouseHeld; }
  /**@internal*/set mouseHeld(value: boolean) { this._mouseHeld = value; }
  get shortcutHeld(): boolean { return this._shortcutHeld; }
  /**@internal*/set shortcutHeld(value: boolean) { this._shortcutHeld = value; }
  get enterHeld(): boolean { return this._enterHeld; }
  /**@internal*/set enterHeld(value: boolean) { this._enterHeld = value; }
  get active(): boolean { return this._active; }
  /**@internal*/set active(value: boolean) { this._active = value; }
  get disabled(): boolean { return this._disabled; }
  /**@internal*/ set disabled(value: boolean) { this._disabled = value; }

  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    shadow.adoptedStyleSheets = [stylesheet];
    
    this.shortcutKey = this.getAttribute('shortcut') ?? null;
    this.allowHolding = this.hasAttribute('allow-holding');
    const triggerMode = this.getAttribute('trigger') as typeof this.triggerMode ?? 'press';
    switch(triggerMode) {
      case "press": break;
      case "hold": break;
      default: throw new RangeError(`Invalid 'trigger' attribute value "${triggerMode}" for Webchalk playback button. Must be "press" or "hold".`)
    }
    this.setAttribute('trigger', triggerMode);
    this.triggerMode = triggerMode;
    
    const action = this.getAttribute('action') as typeof this.action;
    let buttonShapeHtmlStr: string;
    switch(action) {
      case "step-forward":
        buttonShapeHtmlStr = /*html*/`<polygon points="22.468 81.83 67.404 40.915 22.468 0 22.468 81.83"/>`;
        break;
      case "step-backward":
        buttonShapeHtmlStr = /*html*/`<polygon points="59.362 81.83 14.426 40.915 59.362 0 59.362 81.83"/>`;
        break;
      case "pause":
        buttonShapeHtmlStr = /*html*/`<path d="M13.753,0h17.43V81.83H13.753ZM49.974,81.83H67.4V0H49.974Z"/>`;
        break;
      case "fast-forward":
        buttonShapeHtmlStr = /*html*/`<path d="M0,0,36.936,40.915,0,81.83ZM44.936,81.83,81.872,40.915,44.936,0Z"/>`;
        break;
      case "toggle-skipping":
        buttonShapeHtmlStr = /*html*/`<path d="M0,0,23.866,17.34,0,34.681ZM28.982,34.681,52.848,17.34,28.982,0Zm28.982,0L81.83,17.34,57.964,0ZM81.83,47.149,57.964,64.489,81.83,81.83Zm-28.982,0L28.982,64.489,52.848,81.83Zm-28.982,0L0,64.489,23.866,81.83Z"/>`;
        break;
      default: throw new RangeError(`Invalid 'action' attribute value "${action}" for Webchalk playback button. Must be "step-forward", "step-backward", "pause", "fast-forward", or "toggle-skipping".`);
    }
    this.action = action;

    const htmlString = /*html*/`
    <button class="playback-button">
      <svg class="playback-button__symbol" xmlns="http://www.w3.org/2000/svg" width="81.83" height="81.83" viewBox="0 0 81.83 81.83">
        <rect width="81.83" height="81.83" transform="translate(81.83 81.83) rotate(-180)" fill="none"/>
        ${buttonShapeHtmlStr}
      </svg>
    </button>
    `;

    const template = document.createElement('template');
    template.innerHTML = htmlString;
    const element = template.content.cloneNode(true);
    shadow.append(element);
    this.buttonElement = this.shadowRoot!.querySelector('.playback-button') as HTMLButtonElement;

    this.setUpListeners();
  }

  remove() {
    super.remove();

    this.removeListeners();
  }

  get classList() { return this.shadowRoot!.querySelector('.playback-button')!.classList; }

  setUpListeners(): void {
    // remove current ones if already present
    this.removeListeners();

    // handle button activation with keyboard shortcut
    if (this.shortcutKey) {
      window.addEventListener('keydown', this.handleShortcutPress);
      window.addEventListener('keyup', this.handleShortcutRelease);
      const actionTitleCase = this.action.split('-').map(stringFrag => stringFrag[0].toUpperCase()+stringFrag.slice(1)).join(' ');
      this.title = `${actionTitleCase} (${this.triggerMode === 'hold' ? 'Hold ' : ''}${this.shortcutKey})`;
    }
    
    // handle button activation with mouse click
    this.buttonElement.addEventListener('mousedown', this.handleMousePress);
    window.addEventListener('mouseup', this.handleMouseRelease);
    // handle button activation with 'Enter'
    this.buttonElement.addEventListener('keydown', this.handlePressEnter);
    this.buttonElement.addEventListener('keyup', this.handleReleaseEnter);
  }
  
  removeListeners() {
    window.removeEventListener('keydown', this.handleShortcutPress);
    window.removeEventListener('keyup', this.handleShortcutRelease);
    this.buttonElement.removeEventListener('keydown', this.handlePressEnter);
    this.buttonElement.removeEventListener('keyup', this.handleReleaseEnter);
    this.buttonElement.removeEventListener('mousedown', this.handleMousePress);
    window.removeEventListener('mouseup', this.handleMouseRelease);
  }

  activate: () => void = (): void => {};
  deactivate?: () => void = (): void => {};
  styleActivation: () => void = (): void => {};
  styleDeactivation: () => void = (): void => {};

  disable = () => { this.disabled = true; this.buttonElement.disabled = true; }
  enable = () => { this.disabled = false; this.buttonElement.disabled = false; }

  private handleMousePress = (e: MouseEvent): void => {
    if (this.disabled) { return; }
    if (e.button !== 0) { return; } // only allow left mouse click
    this.mouseHeld = true;
    if (this.shortcutHeld || this.enterHeld) { return; }
    // If trigger mode is press, then the second press should deactivate the button.
    if (this.triggerMode === 'press' && this.active === true && this.deactivate) {
      return this.deactivate();
    }
    this.activate();
  }

  private handleMouseRelease = (e: MouseEvent): void => {
    if (this.disabled) { return; }
    if (e.button !== 0) { return; } // only allow left mouse click
    if (!this.mouseHeld) { return; }
    this.mouseHeld = false;
    if (this.shortcutHeld || this.enterHeld) { return; }
    if (this.triggerMode !== 'hold') { return; }
    this.deactivate?.();
  }

  private handleShortcutPress = (e: KeyboardEvent): void => {
    // only register keypress as playback button shortcut if reasonable to assume the user intended to use the shortcuts
    const target = e.composedPath()[0];
    if (!(target instanceof HTMLBodyElement || target instanceof HTMLButtonElement)) { return; }
    if (this.disabled) { return; }
    if (e.key.toLowerCase() !== this.shortcutKey?.toLowerCase() && e.code !== this.shortcutKey) { return; }
    // if the key is held down and holding is not allowed, return
    if (e.repeat && !this.allowHolding) { return; }

    e.preventDefault();
    this.shortcutHeld = true;
    if (this.mouseHeld || this.enterHeld) { return; }
    if (this.triggerMode === 'press' && this.active === true && this.deactivate) {
      return this.deactivate();
    }
    this.activate();
  }

  private handleShortcutRelease = (e: KeyboardEvent): void => {
    if (this.disabled) { return; }
    if (e.key.toLowerCase() !== this.shortcutKey?.toLowerCase() && e.code !== this.shortcutKey) { return; }
    if (!this.shortcutHeld) { return; }
    this.shortcutHeld = false;
    if (this.mouseHeld || this.enterHeld) { return; }
    if (this.triggerMode !== 'hold') { return; }
    this.deactivate?.();
  }

  private handlePressEnter = (e: KeyboardEvent): void => {
    if (this.disabled) { return; }
    if (e.key.toLowerCase() !== 'enter') { return; }
    // if the key is held down and holding is not allowed, return
    if (e.repeat && !this.allowHolding) { return; }

    e.preventDefault();
    this.enterHeld = true;
    if (this.mouseHeld || this.shortcutHeld) { return; }
    if (this.triggerMode === 'press' && this.active === true && this.deactivate) {
      return this.deactivate();
    }
    this.activate();
  }

  private handleReleaseEnter = (e: KeyboardEvent): void => {
    if (this.disabled) { return; }
    if (e.key.toLowerCase() !== 'enter') { return; }
    if (!this.enterHeld) { return; }
    this.enterHeld = false;
    if (this.mouseHeld || this.shortcutHeld) { return; }
    if (this.triggerMode !== 'hold') { return; }
    this.deactivate?.();
  }
}


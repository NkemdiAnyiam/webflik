import * as fs from 'fs';
import { stylesheet } from './componentStyleSheet';
import { AnimTimeline } from '../../1_playbackStructures/AnimationTimeline';
import { AnimSequence } from '../../1_playbackStructures/AnimationSequence';
import { htmlComponentStr } from './templates/ts/timelinePane';

import { createElFromString, escapeHtml, highlightCodeEls, repositionPopover } from '../../4_utils/helpers';
// import { defaultClipFactories } from './src/Webchalk';
import { AnimClip } from '../../1_playbackStructures/AnimationClip';
import { WebchalkClipElement } from './WebchalkClipElement';

let devHtmlComponentStr: string;
if (process.env.NODE_ENV === 'development') {
  devHtmlComponentStr = fs.readFileSync(__dirname+'/templates/html/timeline-pane.html', 'utf-8');
}

/**
 * Creates a CSS string value for using `var(--hem)`.
 * @param numHem - The number of hem.
 * @returns A CSS string value in the form `'calc(numHem * var(--hem))'`.
 */
export function hem(numHem: number): string {
  return `calc(${numHem} * var(--hem))`;
}

/**
 * Creates a CSS string value representing the hem length of the specified number of seconds.
 * @param numHem - The number of hem.
 * @returns A CSS string value in the form `'calc(var(--hems-per-second) * numHem * var(--hem))'`.
 */
export function hemSecs(numHem: number): string {
  return `calc(var(--hems-per-second) * ${numHem} * var(--hem))`;
}

export class WebchalkTimelinePaneElement extends HTMLElement {
  /**@internal*/ static addToCustomElementRegistry() { customElements.define('webchalk-timeline-pane', WebchalkTimelinePaneElement); }
  static observedAttributes = ['dock'];

  animTimeline?: AnimTimeline;
  
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    shadow.adoptedStyleSheets = [stylesheet];
    const htmlString = /*html*/`
      ${devHtmlComponentStr ?? htmlComponentStr}
    `;

    const template = document.createElement('template');
    template.innerHTML = htmlString;
    const element = template.content.cloneNode(true);
    shadow.append(element);
    this.setAttribute('dock', 'bottom');

    this.attachTimelineUIResizer();
    this.attachErrorPanelResizer();
    this.attachJumpButtonListeners();
    this.attachOpacitySliderListener();
    this.attachScheduleDraggers();
    this.attachControlsButtonListener();
    this.attachDockListener();
  }

  attributeChangedCallback(attrName: string, oldValue: string, newValue: string) {
    if (attrName === 'dock') {
      const timelineEl = this.shadowRoot!.querySelector('.timeline') as HTMLElement;
      const errorPanelEl = timelineEl.querySelector('.timeline__error-panel') as HTMLElement;
      timelineEl.setAttribute('dock', newValue);
      errorPanelEl.setAttribute('dock', newValue);

      // if swapping dock from bottom to the side, remove sizing styling that would mess up UI
      if (oldValue?.match(/bottom/) && newValue.match(/right|left/)) {
        timelineEl.style.removeProperty('height');
        errorPanelEl.style.removeProperty('width');
      }
      if (oldValue?.match(/right|left/) && newValue.match(/bottom/)) {
        timelineEl.style.removeProperty('width');
        errorPanelEl.style.removeProperty('height');
      }

      repositionPopover(this.shadowRoot!.querySelector('.timeline__controls-wrapper--popover'));
    }
  }

  insertSequences(insertionIndex: number, newSequences: AnimSequence[]) {
    if (newSequences.length === 0) { return; }

    const timelineSequences = this.shadowRoot!.querySelector('.timeline__sequences-container') as HTMLElement;

    // sequence elements will be made for any sequences that don't have ui attached

    // insert the first sequences and then use it as the insertion point
    const firstNewSequence = newSequences[0];
    firstNewSequence.attachUI();

    if (insertionIndex === 0) {
      timelineSequences.insertAdjacentElement('afterbegin', firstNewSequence.webchalkSequenceEl!);
    }
    else if (timelineSequences.children[insertionIndex - 1]) {
      timelineSequences.children[insertionIndex - 1].insertAdjacentElement('afterend', firstNewSequence.webchalkSequenceEl!);
    }
    else {
      timelineSequences.insertAdjacentElement('beforeend', firstNewSequence.webchalkSequenceEl!);
    }
    firstNewSequence.writeUI();

    // insert the rest of the new sequences
    let insertionPoint: AnimSequence;
    // insert new sequence elements
    for (let i = insertionIndex + 1; i < newSequences.length; ++i) {
      insertionPoint = newSequences[i - 1];
      const newSequence = newSequences[i];
      newSequence.attachUI();
      insertionPoint.webchalkSequenceEl?.insertAdjacentElement('afterend', newSequence.webchalkSequenceEl!);
      newSequence.writeUI();
    }
  }
  
  updateJumpDatalist(jumpType: 'step' | 'tag' | 'heading') {
    switch(jumpType) {
      // update step number datalist
      case 'step': {
        const datalistEl = this.shadowRoot!.querySelector('.timeline__control--jump--step .timeline__jump-datalist') as HTMLDataListElement;
        const frag = new DocumentFragment();
        for (let i = datalistEl.childElementCount; i < this.animTimeline!.numSequences; ++i) {
          frag.appendChild(createElFromString(/*html*/`<option value="${i + 1}">${i + 1}</option>`));
        }
        datalistEl.appendChild(frag);
      }
      break;

      // update jump tag datalist
      case 'tag': {
        const datalistEl = this.shadowRoot!.querySelector('.timeline__control--jump--tag .timeline__jump-datalist') as HTMLDataListElement;
        const frag = new DocumentFragment();
        // TODO: Decide whether to sort alphabetically (or add option to change the sort).
        const uniqueJumpTags = [...new Set(this.animTimeline!.animSequences.map(sequence => sequence.getJumpTag()))].filter(str => str);
        for (let i = 0; i < uniqueJumpTags.length; ++i) {
          const str = escapeHtml(uniqueJumpTags[i]);
          frag.appendChild(createElFromString(/*html*/`<option value="${str}">${str}</option>`));
        }
        datalistEl.innerHTML = '';
        datalistEl.appendChild(frag);
      }
      break;

      // update heading datalist
      case 'heading': {
        const datalistEl = this.shadowRoot!.querySelector('.timeline__control--jump--heading .timeline__jump-datalist') as HTMLDataListElement;
        const frag = new DocumentFragment();
        const headingsObjs = [...this.animTimeline!.animSequences.map(sequence => sequence.getHeadings())].filter(headings => Boolean(headings));
        const headingSpecifics: {h2?: string, h3?: string, h4?: string, h5?: string, h6?: string} = {};

        for (let i = 0; i < headingsObjs.length; ++i) {
          const headings = headingsObjs[i]!;
          for (const [level, text] of Object.entries(headings)) {
            const levelNumber = Number(level[1]);
            const safeText = escapeHtml(text);

            // Set the entry corresponding to the current to the new heading text and then clear the deeper levels.
            headingSpecifics[level as keyof typeof headingSpecifics] = safeText;
            for (let j = levelNumber + 1; j <= 6; ++j) { delete headingSpecifics[`h${j}` as keyof typeof headingSpecifics]; }

            // create option whose value is the full heading path to the current heading level
            const optionEl = createElFromString(/*html*/`<option>${'#'.repeat(levelNumber)} ${safeText}</option>`);
            optionEl.setAttribute('value', JSON.stringify(headingSpecifics));

            frag.appendChild(optionEl);
          }
        }
        datalistEl.innerHTML = '';
        datalistEl.appendChild(frag);
      }
      break;
      
      default: throw new RangeError(`Invalid jumpType ${jumpType}.`);
    }
  }

  removeSequences(sequencesToRemove: AnimSequence[]) {
    for (const sequence of sequencesToRemove) {
      sequence.detachUI();
    }

    {
      // update step number datalist
      const datalistEl = this.shadowRoot!.querySelector('.timeline__jump-container--step .timeline__jump-datalist') as HTMLDataListElement;
      for (let i = datalistEl.childElementCount; i > this.animTimeline!.numSequences; --i) {
        datalistEl.lastChild?.remove();
      }
    }

    {
      // update jump tag datalist
      const datalistEl = this.shadowRoot!.querySelector('.timeline__jump-container--tag .timeline__jump-datalist') as HTMLDataListElement;
      const frag = new DocumentFragment();
      const uniqueJumpTags = [...new Set(this.animTimeline!.animSequences.map(sequence => sequence.getJumpTag()))].filter(str => str);
      for (let i = 0; i < uniqueJumpTags.length; ++i) {
        const str = escapeHtml(uniqueJumpTags[i]);
        frag.appendChild(createElFromString(/*html*/`<option value="${str}">${str}</option>`));
      }
      datalistEl.innerHTML = '';
      datalistEl.appendChild(frag);
    }
  }

  readTimeline() {
    const timeline = this.animTimeline!;
    
    const timelineEl = this.shadowRoot!.querySelector('.timeline') as HTMLElement;
    timelineEl.querySelector('.timeline__name')!.textContent = timeline.getConfig().timelineName;

    this.insertSequences(0, timeline.getHierarchy().sequences);

    this.catchUpUI();
  }

  catchUpUI() {
    const timeline = this.animTimeline!;

    // If timeline has an error
    if (timeline.getStatus('error')) { this.handleErrorState(); }
  }

  remove() {
    super.remove();
    this.animTimeline = undefined;
  }

  attachTimelineUIResizer() {
    const timelineUI = this.shadowRoot?.querySelector('.timeline') as HTMLElement;
    timelineUI.setAttribute('dock', this.getAttribute('dock')!);

    const handleClick = (e: MouseEvent) => {
      const timelineResizer = (e.target as HTMLElement);
      // only do process if resizer was clicked
      if (!timelineResizer.classList.contains('timeline__resizer')) { return; }
      
      const timelineUI = e.currentTarget as HTMLElement;
      const sequencesContainerEl = timelineUI.querySelector('.timeline__sequences-container') as HTMLElement;
      // unhighlight all text to prevent annoying dragging issues
      document.getSelection()?.removeAllRanges();
      // prevent selection in order to prevent other annoying dragging issues
      timelineUI.classList.add('user-select-none');

      // Drastically decreases cost of reflows for high numbers of sequences (~150+) and clips (~300+).
      // Also provides a nice visual purpose for removing the sequences (letting user see behind the timeline pane).
      sequencesContainerEl.style.display = 'none';
      timelineUI.style.opacity = '0.5';

      const dock = this.getAttribute('dock');
      const handleDrag = dock === 'bottom'
        ? (e: MouseEvent) => {
          // timelineUI.style.height = `${Number.parseFloat(getComputedStyle(timelineUI).height) - e.movementY}px`;
          timelineUI.style.height = `${window.innerHeight - e.y}px`;
          // timelineUI.style.contentVisibility = 'hidden';
        }
        : dock === 'right'
          ? (e: MouseEvent) => { timelineUI.style.width = `${Number.parseFloat(getComputedStyle(timelineUI).width) - e.movementX}px`; }
          : (e: MouseEvent) => { timelineUI.style.width = `${Number.parseFloat(getComputedStyle(timelineUI).width) + e.movementX}px`; }
          // timelineUI.style.contentVisibility = 'hidden';

      const handleRelease = (e: MouseEvent) => {
        // remove all event listeners
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleRelease);
        window.removeEventListener('mouseleave', handleRelease);
        timelineUI.classList.remove('user-select-none');
        // timelineUI.style.contentVisibility = 'visible';
        sequencesContainerEl.style.removeProperty('display');
        timelineUI.style.removeProperty('opacity');
      }

      // add listeners for handling drag and release to window
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleRelease);
      window.addEventListener('mouseleave', handleRelease);
    };

    timelineUI.addEventListener('mousedown', handleClick);
  }

  attachErrorPanelResizer() {
    const errorPanel = this.shadowRoot?.querySelector('.timeline__error-panel') as HTMLDivElement;
    errorPanel.setAttribute('dock', this.getAttribute('dock')!);

    const handleClick = (e: MouseEvent) => {
      const errorPanelResizer = (e.target as HTMLElement);
      // only do process if resizer was clicked
      if (!errorPanelResizer.classList.contains('timeline__error-panel-resizer')) { return; }

      const errorPanel = e.currentTarget as HTMLDivElement;
      // unhighlight all text to prevent annoying dragging issues
      document.getSelection()?.removeAllRanges();
      // prevent selection in order to prevent other annoying dragging issues
      errorPanel.classList.add('user-select-none');

      const dock = this.getAttribute('dock');
      const handleDrag = dock === 'bottom'
        ? (e: MouseEvent) => { errorPanel.style.width = `${Number.parseFloat(getComputedStyle(errorPanel).width) - e.movementX}px`; }
        : (e: MouseEvent) => { errorPanel.style.height = `${Number.parseFloat(getComputedStyle(errorPanel).height) - e.movementY}px`; } 

      const handleRelease = (e: MouseEvent) => {
        // remove all event listeners
        errorPanel.classList.remove('user-select-none');
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleRelease);
        window.removeEventListener('mouseleave', handleRelease);
      }

      // add listeners for handling drag and release to window
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleRelease);
      window.addEventListener('mouseleave', handleRelease);
    };

    errorPanel.addEventListener('mousedown', handleClick);
  }
  
  handleErrorState() {
    const errorPanelEl = this.shadowRoot!.querySelector('.timeline__error-panel') as HTMLElement;
    const headingEl = errorPanelEl.querySelector('.timeline__error-panel-heading-text') as HTMLHeadingElement;
    const bodyEl = errorPanelEl.querySelector('.timeline__error-panel-body') as HTMLHeadingElement;
    const {errorName, uiMessageFrags} = this.animTimeline!.getStatus('error')!;

    headingEl.textContent = `ERROR: ${escapeHtml(errorName)}`;
    bodyEl.innerHTML = '';

    const appendSection = (sectionName: string, sectionContents: Node) => {
      const sectionEl = createElFromString(`<div class="timeline__error-panel-section"></div>`);
      const sectionBodyEl = createElFromString(`<div class="timeline__error-panel-section-body"></div>`);
      const headingEl = createElFromString(`<h3 class="timeline__error-panel-subheading">${sectionName}</h3>`);
      sectionEl.appendChild(headingEl);
      sectionBodyEl.appendChild(sectionContents);
      sectionEl.append(sectionBodyEl);
      bodyEl.appendChild(sectionEl);
    };

    if (uiMessageFrags) {
      const {description, tips, location} = uiMessageFrags;
      appendSection('Description', description);
      if (tips) { appendSection('Tips', tips); }
      if (location) { appendSection('Location', location); }
    }
    else {
      appendSection(
        'Description',
        new Text(`This error does not have a UI render yet. View the browser console to see this error's explanation. To view the console, right-click and select "Inspect", and then navigate to the "Console" tab.`)
      );
    }

    highlightCodeEls(bodyEl);
    this.classList.add('error');
  }

  attachJumpButtonListeners() {
    for (const jumpType of ['step', 'tag', 'heading']) {
      // read jump position from input and then jump to that position when button is pressed
      const jumpButtonEl = this.shadowRoot!.querySelector(`.timeline__control--jump--${jumpType} .timeline__jump-button`) as HTMLButtonElement;
      jumpButtonEl.addEventListener('click', (e) => {
        const inputEl = (e.currentTarget as HTMLButtonElement)
          .closest('.timeline__jump-selection-container')
          ?.querySelector('.timeline__jump-input') as HTMLInputElement;
        
          switch(jumpType) {
            case 'step': {
              const stepNumber = Number(inputEl.value);
              if (!stepNumber) { return; }
              this.animTimeline?.jumpToPosition(stepNumber - 1);
            }
            break;
            case 'tag': {
              const tag = inputEl.value;
              if (!tag) { return; }
              this.animTimeline?.jumpToSequenceTag(tag);
            }
            break;
            case 'heading': {
              const headingText = inputEl.value;
              if (!headingText) { return; }
              const headingSpecifics = JSON.parse(inputEl.value);
              this.animTimeline?.jumpToSequenceHeading(headingSpecifics);
            }
            break;
          }
      });
      
      // treat pressing Enter inside the input as pressing the jump button
      const inputEl = jumpButtonEl.closest('.timeline__jump-selection-container')?.querySelector('.timeline__jump-input') as HTMLInputElement;
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const jumpButtonEl = (e.currentTarget as HTMLInputElement)
            .closest('.timeline__jump-selection-container')
            ?.querySelector('.timeline__jump-button') as HTMLButtonElement;
          jumpButtonEl.click();
        }
      });
      
      inputEl.addEventListener('mousedown', (e) => {
        (e.currentTarget as HTMLInputElement).value = '';
        this.updateJumpDatalist(jumpType as 'step' | 'tag' | 'heading');
      });
      inputEl.addEventListener('click', (e) => {
        try { (e.currentTarget as HTMLInputElement).showPicker?.(); }
        catch(e) {}
      });
    }
  }

  attachOpacitySliderListener() {
    const opacitySliderEl = this.shadowRoot?.querySelector('.timeline__opacity-slider') as HTMLInputElement;
    opacitySliderEl.value = '100';
    opacitySliderEl.addEventListener('input', (e) => {
      const val = (e.currentTarget as HTMLInputElement).value;
      const timelineEl = this.shadowRoot!.querySelector('.timeline') as HTMLElement;
      timelineEl.style.setProperty('--timeline-opacity', `${val}%`);
    });
  }

  attachScheduleDraggers() {
    const sequencesContainer = this.shadowRoot?.querySelector('.timeline__sequences-container') as HTMLElement;
    
    const handleClick = (e: MouseEvent) => {
      // need to select from composedPath() because e.target would just see webchalk-clip
      const clickTarget = e.composedPath()[0] as HTMLElement;
      // only do process if a track was clicked
      if (!clickTarget.classList.contains('clip__body')) { return; }
      const schedule = (
        (clickTarget.getRootNode() as ShadowRoot)
        .host as WebchalkClipElement)
        .parentWebchalkSequenceEl!
        .shadowRoot!.querySelector('.sequence__schedule') as HTMLElement;
      const sequencesContainer = e.currentTarget as HTMLElement;

      // unhighlight all text to prevent annoying dragging issues
      document.getSelection()?.removeAllRanges();
      // prevent user selection to handle other annoying dragging issues
      schedule.classList.add('user-select-none');

      const handleDrag = (e: MouseEvent) => {
        const [dx, dy] = [e.movementX, e.movementY];
        if (dy !== 0) {
          const newY = dy < 0 ? Math.floor(schedule.scrollTop - dy) : Math.ceil(schedule.scrollTop - dy);
          
          // if schedule header is out of view, scroll sequences container upward instead of schedule
          if (dy > 0 && schedule.getBoundingClientRect().top < sequencesContainer.getBoundingClientRect().top) {
            sequencesContainer.scrollBy({top: -dy, behavior: 'instant'});
          }
          // if dragging past the top of schedule, scroll sequences container up
          else if (dy > 0 && schedule.scrollTop === 0) {
            sequencesContainer.scrollBy({top: -dy, behavior: 'instant'});
          }
          // if dragging past the bottom of schedule, scroll sequences container down
          else if (dy < 0 && newY > schedule.scrollHeight - schedule.getBoundingClientRect().height) {
            sequencesContainer.scrollBy({top: -dy, behavior: 'instant'});
          }
          else {
            schedule.scrollTo({top: newY, behavior: 'instant'});
          }
        }
        if (dx !== 0) {
          const newX = dx < 0 ? Math.floor(schedule.scrollLeft - dx) : Math.ceil(schedule.scrollLeft - dx);
          schedule.scrollTo({left: newX, behavior: 'instant'});
        }
      }

      const handleRelease = (e: MouseEvent) => {
        // remove all event listeners related to dragging this schedule
        schedule.classList.remove('user-select-none');
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleRelease);
        window.removeEventListener('mouseleave', handleRelease);
      }

      // add listeners for handling drag and release to window
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleRelease);
      window.addEventListener('mouseleave', handleRelease);
    };

    sequencesContainer.addEventListener('mousedown', handleClick);
  }

  attachControlsButtonListener() {
    const controlsWrapperEl = this.shadowRoot!.querySelector(".timeline__controls-wrapper") as HTMLElement;
    controlsWrapperEl.addEventListener('toggle', (e) => {
      const controlsWrapperEl = e.currentTarget as HTMLElement;

      if (e.newState === 'closed') {
        // To prevent flash of positioning styling when popover is eventually reopened.
        controlsWrapperEl.toggleAttribute('popover-visible', false);
        return;
      }

      repositionPopover(controlsWrapperEl);

      controlsWrapperEl.toggleAttribute('popover-visible', true);
    });
  }

  attachDockListener() {
    const dockSelectEl = this.shadowRoot!.querySelector('.timeline__dock-select') as HTMLSelectElement;
    dockSelectEl.value = this.getAttribute('dock')!;
    dockSelectEl.addEventListener('change', (e) => {
      const dockSelectEl = e.currentTarget as HTMLSelectElement;
      this.setAttribute('dock', dockSelectEl.value);
    });
  }

  // TODO: Implement intuitive automatic scrolling
  scrollToSequence(sequence: AnimSequence, direction: 'forward' | 'backward', block: 'nearest' | 'start' = 'nearest') {
    // defaultClipFactories.Scroller(
    //   this.shadowRoot!.querySelector('.timeline__sequences-container'),
    //   '~scroll-self',
    //   [sequence.webchalkSequenceEl, {preserveX: true, scrollableOffset: [0, 'center'], targetOffset: [0, direction === 'forward' ? 'top' : 'bottom']}],
    //   {duration: 125}
    // ).play();
    sequence.webchalkSequenceEl?.scrollIntoView({block: block, 'behavior': 'smooth'})
  }

  scrollToClip(clip: AnimClip, direction: 'forward' | 'backward') {
    // defaultClipFactories.Scroller(
    //   this.shadowRoot!.querySelector('.timeline__sequences-container'),
    //   '~scroll-self',
    //   [clip.webchalkClipEl, {preserveX: true, scrollableOffset: [0, 'center + 20%'], targetOffset: [0, direction === 'forward' ? 'top' : 'bottom']}],
    //   {duration: 1000, easing: 'ease-in-out'}
    // ).play();
    // clip.webchalkClipEl?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }
}

import * as fs from 'fs';
import { stylesheet } from './componentStyleSheet';
import { htmlComponentStr } from './templates/ts/phaseSegment';

import { createElFromString, escapeHtml, repositionPopover, secondsToHMMSS, TBA_DURATION } from '../../4_utils/helpers';
import { PhaseSegment } from '../../1_playbackStructures/WebchalkAnimation';
import { hemSecs } from './WebchalkTimelinePaneElement';
import { WebchalkClipElement } from './WebchalkClipElement';

let devHtmlComponentStr: string;
if (process.env.NODE_ENV === 'development') {
  devHtmlComponentStr = fs.readFileSync(__dirname+'/templates/html/phase-segment.html', 'utf-8');
}

export class WebchalkPhaseSegmentElement extends HTMLElement {
  /**@internal*/ static addToCustomElementRegistry() { customElements.define('webchalk-phase-segment', WebchalkPhaseSegmentElement); }
  static id = 0;

  private popoverId: number;

  private forwardPhaseSegment?: PhaseSegment;
  private backwardPhaseSegment?: PhaseSegment;

  /** @internal */ parentWebchalkClipEl: WebchalkClipElement | undefined;
  private infoBoxEl: HTMLElement;
  
  msToHemStr(ms: number): string { return hemSecs(ms / 1000); }
  
  constructor() {
    super();
    this.popoverId = WebchalkPhaseSegmentElement.id++;

    const shadow = this.attachShadow({mode: 'open'});
    shadow.adoptedStyleSheets = [stylesheet];
    const htmlString = /*html*/`
      <style>
        .phase-segment__button {
          anchor-name: --phase-segment-info-box-anchor-${this.popoverId};
        }

        .phase-segment__info-box {
          position-anchor: --phase-segment-info-box-anchor-${this.popoverId};
        }
      </style>
      ${devHtmlComponentStr ?? htmlComponentStr}
    `;

    const template = document.createElement('template');
    template.innerHTML = htmlString;
    const element = template.content.cloneNode(true);
    shadow.append(element);

    this.infoBoxEl = shadow.querySelector('.phase-segment__info-box') as HTMLElement;

    this.attachPopoverButtonListener();
  }

  readSegment(segment: PhaseSegment, direction: 'forward' | 'backward') {
    switch(direction) {
      case 'forward':
        this.forwardPhaseSegment = segment;
        break;
      case 'backward':
        this.backwardPhaseSegment = segment;
        break;
      default: throw Error(`Invalid direction "${direction}". Must be "forward" or "backward".`);
    }
  }

  addUI() {
    let { duration, delay, endDelay } = this.parentWebchalkClipEl!.animClip!.getTiming();
    let marginStr: string;
    if (duration === TBA_DURATION) {
      marginStr = this.msToHemStr(endDelay + delay + 50);
    }
    else {
      if (this.forwardPhaseSegment) {
        marginStr = this.msToHemStr(this.forwardPhaseSegment.endDelay + delay + duration);
      }
      else {
        marginStr = this.msToHemStr(-(this.backwardPhaseSegment!.endDelay + duration) + delay + duration);
      }
    }

    (this.shadowRoot!.querySelector('.phase-segment') as HTMLElement).style.marginLeft = marginStr;
    this.shadowRoot!.querySelector('.phase-segment__button')?.setAttribute('popovertarget', `phase-segment__info-box-${this.popoverId}`);
    this.shadowRoot!.querySelector('.phase-segment__info-box')?.setAttribute('id', `phase-segment__info-box-${this.popoverId}`);
  }

  update(direction: 'forward' | 'backward' | 'both') {
    if ((direction === 'forward' || direction === 'both') && this.forwardPhaseSegment) {
      const { resolverContainers, taskParts } = this.forwardPhaseSegment;
      if (resolverContainers.every(callbackObj => callbackObj.called || callbackObj.hideFromUI) && taskParts.every(taskPart => taskPart.frequencyLimit === 0)) {
        this.remove('forward');
      }
    }
    if ((direction === 'backward' || direction === 'both') && this.backwardPhaseSegment) {
      const { resolverContainers, taskParts } = this.backwardPhaseSegment;
      if (resolverContainers.every(callbackObj => callbackObj.called || callbackObj.hideFromUI) && taskParts.every(taskPart => taskPart.frequencyLimit === 0)) {
        this.remove('backward');
      }
    }

    if (this.parentWebchalkClipEl && this.infoBoxEl.checkVisibility()) {
      this.fillInfoBoxContents();
    }
  }

  attachPopoverButtonListener() {
    this.infoBoxEl.addEventListener('toggle', (e) => {
      const phaseSegmentInfoBoxEl = e.currentTarget as HTMLElement;

      if (e.newState === 'closed') {
        // To prevent flash of positioning styling when popover is eventually reopened.
        phaseSegmentInfoBoxEl.toggleAttribute('popover-visible', false);
        const listEls = [...this.shadowRoot!.querySelectorAll('.phase-segment__info-box-section .phase-segment__info-box-list')] as HTMLUListElement[];
        listEls.forEach(listEl => listEl.innerHTML = '');
        return;
      }

      this.fillInfoBoxContents();
      repositionPopover(phaseSegmentInfoBoxEl);
      phaseSegmentInfoBoxEl.toggleAttribute('popover-visible', true);
    });
  }

  fillInfoBoxContents() {
    const listEls = [...this.shadowRoot!.querySelectorAll('.phase-segment__info-box-list')] as HTMLUListElement[];
    listEls.forEach(listEl => listEl.innerHTML = '');

    let absoluteTimeStr: string;
    let relativeTimeStr: string;
    const {duration, delay} = this.parentWebchalkClipEl!.animClip!.getTiming();
    if (duration === TBA_DURATION) {
      absoluteTimeStr = `(timestamp TBD)`;
      relativeTimeStr = `(timestamp TBD)`;
    }
    else {
      if (this.forwardPhaseSegment) {
        absoluteTimeStr = secondsToHMMSS((this.forwardPhaseSegment.endDelay + delay + duration + this.parentWebchalkClipEl!.animClip!.fullStartTime) / 1000, 3);
        relativeTimeStr = secondsToHMMSS((this.forwardPhaseSegment.endDelay + delay + duration) / 1000, 3);
      }
      else {
        absoluteTimeStr = secondsToHMMSS((-(this.backwardPhaseSegment!.endDelay + duration) + delay + duration + this.parentWebchalkClipEl!.animClip!.fullStartTime) / 1000, 3);
        relativeTimeStr = secondsToHMMSS((-(this.backwardPhaseSegment!.endDelay + duration) + delay + duration) / 1000, 3);
      }
    }

    const el = /*html*/`
      <li class="phase-segment__info-box-list-item">
        <div class="phase-segment__info-box-field">
          <div class="phase-segment__info-box-field-label">
            Within Sequence
          </div>
          <div class="phase-segment__info-box-field-value">
            ${absoluteTimeStr}
          </div>
        </div>
        <div class="phase-segment__info-box-field">
          <div class="phase-segment__info-box-field-label">
            Within Clip
          </div>
          <div class="phase-segment__info-box-field-value">
            ${relativeTimeStr}
          </div>
        </div>
      </li>`;

    (this.shadowRoot!.querySelector(`.phase-segment__info-box-list--timestamps`) as HTMLUListElement).appendChild(createElFromString(el));

    const parseSegment = (phaseSegment: PhaseSegment | undefined, direction: 'forward' | 'backward') => {
      const taskListEl = this.shadowRoot!.querySelector(`.phase-segment__info-box-list--tasks`) as HTMLUListElement;
      const promiseListEl = this.shadowRoot!.querySelector(`.phase-segment__info-box-subsection--${direction} .phase-segment__info-box-list--promises`) as HTMLUListElement;

      const shownTaskParts = [...(phaseSegment?.taskParts ?? [])].filter(({hideFromUI}) => !hideFromUI);

      // If there are no backward tasks or forward tasks, insert note.
      if (direction === 'backward' && shownTaskParts.length === 0 && taskListEl.childElementCount === 0) {
        const taskEl = createElFromString(/*html*/`<p class="phase-segment__empty-list-note">No scheduled tasks.</p>`);
        taskListEl.appendChild(taskEl);
      }
      for (let i = 0; i < shownTaskParts.length; ++i) {
        const taskPart = shownTaskParts[i];
        
        // If there exists a task element, then we can assume that direction === 'backward' and the current NA note must be for backwards.
        const existingTaskEl = taskListEl.querySelector(`#scheduled-task-${taskPart.id}`);
        if (existingTaskEl) {
          const frag = new DocumentFragment();
          frag.appendChild(createElFromString(/*html*/`<span class="phase-segment__max-times-ran">${taskPart.frequencyLimit}</span>`));
          existingTaskEl.querySelector('.phase-segment__NA')!.replaceWith(frag);
        }
        // Otherwise, create new task element and fill the times ran depending on direction.
        else {
          const itemHtmlStr = /*html*/`
            <li class="phase-segment__info-box-list-item" id="scheduled-task-${taskPart.id}">
              <div class="phase-segment__info-box-field">
                <div class="phase-segment__info-box-field-label">
                  Description
                </div>
                <div class="phase-segment__info-box-field-value">
                  ${escapeHtml(taskPart.description ?? '')}
                </div>
              </div>
              <div class="phase-segment__info-box-field">
                <div class="phase-segment__info-box-field-label">
                  Runs Remaining
                </div>
                <div class="phase-segment__info-box-field-value">
                  <p>Forward: ${
                    direction === 'forward' 
                      ? /*html*/`<span class="phase-segment__max-times-ran">${taskPart.frequencyLimit}</span>`
                      : /*html*/`<span class="phase-segment__NA">0</span>`}
                  </p>
                  <p>Backward: ${
                    direction === 'backward' 
                      ? /*html*/`<span class="phase-segment__max-times-ran">${taskPart.frequencyLimit}</span>`
                      : /*html*/`<span class="phase-segment__NA">0</span>`}
                  </p>
                </div>
              </div>
              <div class="phase-segment__info-box-field">
                <div class="phase-segment__info-box-field-label">
                  Task ID
                </div>
                <div class="phase-segment__info-box-field-value">
                  ${taskPart.id}
                </div>
              </div>
            </li>`;

          const taskEl = createElFromString(itemHtmlStr);
          taskListEl.appendChild(taskEl);
        }
      }

      const shownPromises = phaseSegment?.resolverContainers.filter(({hideFromUI, called}) => !(hideFromUI || called)) ?? [];
      if (shownPromises.length === 0) {
        const promiseEl = createElFromString(/*html*/`<p class="phase-segment__empty-list-note">No scheduled promises.</p>`);
        promiseListEl.appendChild(promiseEl);
      }
      else {
        const itemEl = createElFromString(/*html*/`
          <li class="phase-segment__info-box-list-item">
            <div class="phase-segment__info-box-field">
              <!--div class="phase-segment__info-box-field-label">
                Labels:
              </div-->
              <div class="phase-segment__info-box-field-value">
                <ul class="phase-segment__callbacks-list"></ul>
              </div>
            </div>
          </li>`
        );

        const callbacksListEl = itemEl.querySelector('.phase-segment__callbacks-list') as HTMLUListElement;

        for (let i = 0; i < shownPromises.length; ++i) {
          if (shownPromises[i].hideFromUI) { continue; }
          callbacksListEl.appendChild(createElFromString(/*html*/`
            <li class="phase-segment__callbacks-list-item">${escapeHtml(shownPromises[i].label ?? '')}</li>`
          ));
        }
        promiseListEl.appendChild(itemEl);
      }
    };
    parseSegment(this.forwardPhaseSegment, 'forward');
    parseSegment(this.backwardPhaseSegment, 'backward');
  }

  remove(direction?: 'forward' | 'backward') {
    if (!direction) {
      super.remove();
      this.parentWebchalkClipEl = undefined;
      return;
    }
    
    switch(direction) {
      case 'forward':
        this.forwardPhaseSegment && (this.forwardPhaseSegment.phaseSegmentEl = undefined);
        this.forwardPhaseSegment = undefined;
        break;
      case 'backward':
        this.backwardPhaseSegment && (this.backwardPhaseSegment.phaseSegmentEl = undefined);
        this.backwardPhaseSegment = undefined;
        break;
      default: throw Error(`Invalid direction "${direction}". Must be "forward" or "backward".`);
    }
    
    if (!(this.forwardPhaseSegment || this.backwardPhaseSegment)) {
      super.remove();
      this.parentWebchalkClipEl = undefined;
    }
  }
}

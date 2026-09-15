import * as fs from 'fs';
import { stylesheet } from './componentStyleSheet';
import { htmlComponentStr } from './templates/ts/sequence';

import { createElFromString, escapeHtml, secondsToHMMSS } from '../../4_utils/helpers';
import { AnimSequence, AnimSequenceConfig } from '../../1_playbackStructures/AnimationSequence';
import { AnimClip } from '../../1_playbackStructures/AnimationClip';
import { hem, hemSecs, WebchalkTimelinePaneElement } from './WebchalkTimelinePaneElement';
// import { defaultClipFactories } from './src/Webchalk';

let devHtmlComponentStr: string;
if (process.env.NODE_ENV === 'development') {
  devHtmlComponentStr = fs.readFileSync(__dirname+'/templates/html/sequence.html', 'utf-8');
}

export class WebchalkSequenceElement extends HTMLElement {
  /**@internal*/ static addToCustomElementRegistry() { customElements.define('webchalk-sequence', WebchalkSequenceElement); }

  private parentWebchalkTimelineEl: WebchalkTimelinePaneElement | undefined;

  animSequence?: AnimSequence;

  // getHemsPerSecond() {
  //   return Number(getComputedStyle(this)
  //     .getPropertyValue('--hems-per-second')
  //     .match(/\d+/)![0]
  //   );
  // }
  // msToNumHem(ms: number) { return ms / 1000 * this.getHemsPerSecond(); }
  // msToHemStr(ms: number): string { return hem(this.msToNumHem(ms)); }
  msToHemStr(ms: number): string { return hemSecs(ms / 1000); }

  private maxSecondsDisplayed: number = 0;
  private playheadEl: HTMLElement;
  private playheadTrailEl: HTMLElement;
  
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

    this.playheadEl = shadow.querySelector('.sequence__playhead') as HTMLElement;
    this.playheadTrailEl = shadow.querySelector('.sequence__playhead-trail') as HTMLElement;

    this.updateMaxSecondsDisplayed(11);
  }

  updateMaxSecondsDisplayed(seconds: number) {
    const newMaxTime = Math.max(Math.ceil(seconds), 11);
    const oldMaxTime = this.maxSecondsDisplayed;

    if (newMaxTime === oldMaxTime) { return; }

    const sequenceScheduleTimes = this.shadowRoot!.querySelector('.sequence__schedule-times') as HTMLElement;
    const sequenceTicks = this.shadowRoot!.querySelector('.sequence__ticks') as HTMLElement;

    const ticksString = /*html*/`
      <div class="sequence__tick sequence__tick--whole"></div>
      <div class="sequence__tick sequence__tick--tenth"></div>
      <div class="sequence__tick sequence__tick--tenth"></div>
      <div class="sequence__tick sequence__tick--tenth"></div>
      <div class="sequence__tick sequence__tick--tenth"></div>
      <div class="sequence__tick sequence__tick--half"></div>
      <div class="sequence__tick sequence__tick--tenth"></div>
      <div class="sequence__tick sequence__tick--tenth"></div>
      <div class="sequence__tick sequence__tick--tenth"></div>
      <div class="sequence__tick sequence__tick--tenth"></div>`
    ;

    // insert schedule times and ticks
    if (newMaxTime > oldMaxTime) {
      for (let currSeconds = oldMaxTime + 1; currSeconds <= newMaxTime; ++currSeconds) {
        const scheduleTimeWrapper = createElFromString<HTMLElement>(/*html*/`
          <div class="sequence__schedule-time-wrapper">
            <span class="sequence__schedule-time">${secondsToHMMSS(currSeconds)}</span>
          </div>`
        );

        sequenceScheduleTimes?.appendChild(scheduleTimeWrapper);
      }

      sequenceTicks?.insertAdjacentHTML('beforeend', ticksString.repeat(newMaxTime - oldMaxTime));
    }
    // remove schedule times and ticks
    else {
      for (let currSeconds = 0; currSeconds < oldMaxTime - newMaxTime; ++currSeconds) {
        sequenceScheduleTimes.removeChild(sequenceScheduleTimes.lastElementChild!);
        for (let i = 0; i < 10; ++i) {
          sequenceTicks.removeChild(sequenceTicks.lastElementChild!);
        }
      }
    }

    this.maxSecondsDisplayed = newMaxTime;
  }

  insertClips(insertionIndex: number, newClips: AnimClip[]) {
    if (newClips.length === 0) { return; }

    const sequenceClips = this.shadowRoot!.querySelector('.sequence__clips') as HTMLElement;

    // clip elements will be made for any clips that don't have ui attached

    // insert the first clip and then use it as the insertion point
    const firstNewClip = newClips[0];
    firstNewClip.attachUI();

    if (insertionIndex === 0) {
      sequenceClips.insertAdjacentElement('afterbegin', firstNewClip.webchalkClipEl!);
    }
    else if (sequenceClips.children[insertionIndex - 1]) {
      sequenceClips.children[insertionIndex - 1].insertAdjacentElement('afterend', firstNewClip.webchalkClipEl!);
    }
    else {
      sequenceClips.insertAdjacentElement('beforeend', firstNewClip.webchalkClipEl!);
    }
    firstNewClip.writeUI();

    // insert new clip elements
    let insertionPoint: AnimClip;
    for (let i = insertionIndex + 1; i < newClips.length; ++i) {
      insertionPoint = newClips[i - 1];
      const newClip = newClips[i];
      newClip.attachUI();
      insertionPoint.webchalkClipEl?.insertAdjacentElement('afterend', newClip.webchalkClipEl!);
      newClip.writeUI();
    }

    this.updateEmptyTimeFillWidth();
  }

  removeClips(clipsToRemove: AnimClip[]) {
    for (const clip of clipsToRemove) {
      clip.detachUI();
    }

    this.updateEmptyTimeFillWidth();
  }

  readSequence() {
    const sequence = this.animSequence!;
    this.parentWebchalkTimelineEl = (this.getRootNode() as ShadowRoot).host as WebchalkTimelinePaneElement;

    // const sequenceEl = this.shadowRoot!.querySelector('.sequence') as HTMLElement;

    this.updateHeadings(sequence.getConfig().headings);
    this.updateDescription(sequence.getDescription());
    this.updateSequenceNumber(sequence.getHierarchy().sequenceNumber);

    if (sequence.getTiming('autoplays')) { this.classList.add('autoplays'); }
    if (sequence.getTiming('autoplaysNextSequence')) { this.classList.add('auto-next'); }

    this.insertClips(0, sequence.getHierarchy('clips'));
    
    this.updateMaxSecondsDisplayed(sequence.maxTime / 1000);

    this.attachJumpButtonListener();

    this.catchUpUI();
  }

  catchUpUI() {
    const sequence = this.animSequence!;

    // If sequence is playing or finished
    if (sequence.getStatus('isFinished') && sequence.getStatus('direction') === 'forward') {
      this.updatePlayheadPosition();
      this.handlePlayheadEdge('forward');
      this.toggleDarkenSchedule(true);
    }
    else if (sequence.getStatus('inProgress')) {
      this.togglePlayLight(true);
      if (sequence.getStatus('isPaused')) {
        this.updatePlayheadPosition();
        this.handlePlayheadEdge(sequence.getStatus('direction'));
      }
      else {
        this.startPlayhead(sequence.getStatus('direction'));
      }
    }

    // If sequence has an error
    if (sequence.getStatus('errored')) { this.handleErrorState(); }
  }

  remove() {
    super.remove();
    this.parentWebchalkTimelineEl = undefined;
    this.animSequence = undefined;
  }

  updateSequenceNumber(sequenceNumber: number) {
    const sequenceNumberEl = this.shadowRoot!.querySelector('.sequence__number') as HTMLElement;
    sequenceNumberEl.textContent = `${sequenceNumber}.`;
  }

  updateDescription(description: string) {
    const sequenceDescriptionEl = this.shadowRoot!.querySelector('.sequence__description') as HTMLElement;
    sequenceDescriptionEl.textContent = `${description}`;
  }

  updateHeadings(headings: AnimSequenceConfig['headings']) {
    let sequenceHeadingsEl = this.shadowRoot?.querySelector('.sequence__headings') as HTMLElement | null;
    // If completely empty, remove the headings element.
    if (!headings || Object.entries(headings).length === 0) {
      sequenceHeadingsEl?.remove();
    }
    else {
      // If didn't already have headings, create it.
      if (!sequenceHeadingsEl) {
        const newHeadingsEl = createElFromString(/*html*/`
          <div class="sequence__headings">
          </div>`
        ) as HTMLElement;
        this.shadowRoot!.querySelector('.sequence')!.insertAdjacentElement('afterbegin', newHeadingsEl);
        sequenceHeadingsEl = newHeadingsEl;
      }
      else {
        sequenceHeadingsEl.innerHTML = '';
      }

      // TODO: incorporate aria
      for (const [level, text] of Object.entries(headings)) {
        const newHeadingEl = createElFromString(/*html*/`
          <div class="sequence__heading-container">
            <p class="sequence__heading sequence__heading--${escapeHtml(level)}">${escapeHtml(text)}</p>
          </div>`
        );
        sequenceHeadingsEl.append(newHeadingEl);
      }
    }
  }

  updateEmptyTimeFillWidth() {
    const fillerEl = this.shadowRoot!.querySelector('.sequence__empty-time-fill') as HTMLElement;
    fillerEl.style.left = `calc(${this.msToHemStr(this.animSequence!.maxTime)} + ${hem(3.2)})`;
  }

  private handlePlayheadEdge(direction: 'forward' | 'backward') {
    const playheadEl = this.playheadEl;
    const scheduleEl = playheadEl.closest('.sequence__schedule') as HTMLElement;
    const { right: scheduleEdgeRight, left: scheduleEdgeLeft, width: scheduleWidth } = scheduleEl.getBoundingClientRect();
    const intersectionTolerance = Math.max(1, Math.ceil(scheduleWidth * 0.006));
    const clipHeaderWidth = scheduleEl.querySelector('webchalk-clip')!.shadowRoot!.querySelector('.clip__header')!.getBoundingClientRect().width;
    // prevents the playhead from ending up right on the edge of the schedule
    const scheduleScrollInset = Math.ceil(scheduleWidth * 0.04);

    switch(direction) {
      case 'forward': {
        const { right: playheadEdgeRight } = playheadEl.getBoundingClientRect();
        // if right edge of playhead is close to right edge of schedule, scroll schedule
        if (playheadEdgeRight >= scheduleEdgeRight - intersectionTolerance) {
          scheduleEl.scrollTo(
            {left: scheduleEl.scrollLeft + (playheadEdgeRight - scheduleEdgeLeft) - clipHeaderWidth - scheduleScrollInset, behavior: 'instant'}
          );
        }
        break;
      }
      case 'backward': {
        const { left: playheadEdgeLeft } = playheadEl.getBoundingClientRect();
        if (playheadEdgeLeft <= scheduleEdgeLeft + intersectionTolerance + clipHeaderWidth) {
          scheduleEl.scrollTo(
            {left: scheduleEl.scrollLeft - scheduleWidth + clipHeaderWidth + scheduleScrollInset, behavior: 'instant'}
          );
        }
        break;
      }
      default: throw new RangeError(`Invalid direction "${direction}". Must be "forward" or "backward".`)
    }
  }

  private updatePlayheadPosition() {
    const currScheduleMs = this.animSequence!.getTiming('currentTime');
    this.playheadTrailEl.style.width = `${this.msToHemStr(currScheduleMs)}`;
    this.playheadEl.style.translate = `${this.msToHemStr(currScheduleMs)}`;
  }

  private playheadLoop(direction: 'forward' | 'backward') {
    this.handlePlayheadEdge(direction);

    if (this.playheadStopped) {
      this.playheadStopped = false;
      return;
    }

    this.updatePlayheadPosition();

    requestAnimationFrame(() => {
      this.playheadLoop(direction);
    });
  }

  startPlayhead(direction: 'forward' | 'backward') {
    // this.shadowRoot?.host.scrollIntoView({behavior: 'smooth'});
    
    requestAnimationFrame(() => {
      this.playheadLoop(direction);
    });
  }

  private playheadStopped = false;

  stopPlayhead(maxTimeMs?: number) {
    this.playheadStopped = true;
    const time = maxTimeMs !== undefined ? maxTimeMs : this.animSequence!.getTiming('currentTime');
    this.playheadEl.style.translate = `${this.msToHemStr(time)}`;
    this.playheadTrailEl.style.width = `${this.msToHemStr(time)}`;
  }

  attachJumpButtonListener() {
    const jumpButtonEl = this.shadowRoot!.querySelector('.sequence__control--jump-button') as HTMLButtonElement;
    const handleClick = () => {
      const {sequenceNumber, parentTimeline} = this.animSequence!.getHierarchy();
      parentTimeline!.jumpToPosition(sequenceNumber - 1);
    };

    jumpButtonEl.addEventListener('click', handleClick);
  }

  toggleDarkenSchedule(state: boolean) {
    const overlayEl = this.shadowRoot!.querySelector('.sequence__dark-overlay') as HTMLElement;
    if (state === true) {
      overlayEl.classList.add('sequence__dark-overlay--shown');
    }
    else {
      overlayEl.classList.remove('sequence__dark-overlay--shown');
    }
  }

  togglePlayLight(state: boolean) {
    const lightEl = this.shadowRoot!.querySelector('.sequence__control--play-light') as HTMLElement;
    if (state === true) {
      lightEl.classList.add('sequence__control--active');
    }
    else {
      lightEl.classList.remove('sequence__control--active');
    }
  }

  handleErrorState() {
    this.classList.add('error');
    this.stopPlayhead();
  }
}

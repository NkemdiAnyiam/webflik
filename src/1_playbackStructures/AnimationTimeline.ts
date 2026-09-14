import { AnimSequence } from "./AnimationSequence";
import { CustomErrorClasses, errorTip, generateError, TimelineErrorGenerator, ErrorUIMessageFragments } from "../4_utils/errors";
import { createElFromString, getPartial, xor } from "../4_utils/helpers";
import { PickFromArray } from "../4_utils/utilityTypes";
import { WebchalkPlaybackButtonElement } from "../3_components/WebchalkPlaybackButtonElement";
import { /*defaultClipFactories,*/ webchalk } from "../Webchalk";
import { WebchalkTimelinePaneElement } from "../3_components/pane-ui/WebchalkTimelinePaneElement";
import { KeyboardKey } from "../4_utils/interfaces";

// TYPE
/**
 * An object configuration options used to define the details and behavior of the animation timeline.
 * @category Interfaces
 * @interface
 */
export type AnimTimelineConfig = {
  /**
   * A string representing the name of the timeline. This will be shown in any UI where appropriate.
   * @defaultValue
   * ```ts
   * '<unnamed timeline>'
   * ```
   */
  timelineName: string;

  /**
   * Controls whether information about the timeline is logged to the console
   * during playback.
   * @defaultValue
   * ```ts
   * false
   * ```
   */
  debugMode: boolean;

  /**
   * An object specifying keyboard shortcuts for the specified buttons
   * (if the playback buttons have not yet been attached, the shortcuts
   * will just be applied when they _are_ attached. Until then, the shortcuts
   * will not trigger).
   */
  keyboardShortcuts: {
    stepForward?: KeyboardKey | null;
    stepBackward?: KeyboardKey | null;
    pause?: KeyboardKey | null;
    fastForward?: KeyboardKey | null;
    toggleSkipping?: KeyboardKey | null;
  };
};

// TYPE
/**
 * An object containing details about an timeline's current status. Returned by {@link AnimTimeline.getStatus}.
 * @see {@link AnimTimeline.getStatus}
 * @category Interfaces
 * @interface
 */
export type AnimTimelineStatus = {
  /**
   * `true` only if the timeline is in the process of playback (whether paused or unpaused).
   */
  isAnimating: boolean;

  /**
   * `true` only if skipping is currently on (for example, after using {@link AnimTimeline.turnSkippingOn|turnSkippingOn()}).
   */
  skippingOn: boolean;

  /**
   * `true` only if the timeline is paused.
   */
  isPaused: boolean;

  /**
   * The direction the timeline stepped in last (or `'forward'` if the timeline has not stepped yet).
   *  * If the timeline last stepped forward, `'forward'`
   *  * If the timeline last stepped backward, `'backward'`
   */
  currentDirection: AnimTimeline['currentDirection'];

  /**
   * `true` only if the timeline is currently jumping to a point (e.g., using {@link AnimTimeline.jumpToSequenceTag|jumpToSequenceTag()}).
   */
  isJumping: boolean;

  /**
   * The current sequential step number, starting from `1` at the start of an unplayed timeline.
   *  * Stepping forward increments the step number by 1 for each sequence played.
   *  * Stepping backward decrements the step number by 1 for each sequence rewound.
   */
  stepNumber: number;

  /**
   * `true` only if the timeline is at the very beginning (i.e., {@link AnimTimelineStatus.stepNumber | stepNumber} is `1`).
   */
  atBeginning: boolean;

  /**
   * `true` only if the timeline is at the very end (i.e., the last sequence has been played).
   */
  atEnd: boolean;

  /**
   * If defined, this is an object containing the name and UI message fragments of the error that broke the timeline.
   * For your practical purposes, the presence of `error` can just be treated as a Boolean.
   */
  error?: {
    errorName: string;
    uiMessageFrags?: ErrorUIMessageFragments;
  };
};

// TYPE
/**
 * An object containing basic information about the timeline and its children.
 * @category Interfaces
 * @interface
 */
export type AnimTimelineHierarchy = {
  /**
   * The highest level of this timeline's lineage.
   *  * The timeline itself is always the root (there is currently no higher possible level).
   * @group Structure
   */
  root: AnimTimeline;
  /**
   * A copy of this timeline's array of {@link AnimSequence} objects.
   * @group Structure
   */
  sequences: AnimSequence[];
  /**
   * The number of sequences in this timeline.
   * @group Structure
   */
  numSequences: number;
}

// TYPE
/**
 * An object containing timing-related details about the timeline. Returned by {@link AnimTimeline.getTiming}.
 * @see {@link AnimTimeline.getTiming}
 * @category Interfaces
 * @interface
 */
export type AnimTimelineTiming = {
  /**
   * The playback rate of the timeline.
   *  * Example: A value of `1` means 100% (the typical playback rate), and `0.5` means 50% speed.
   */
  playbackRate: number;
}

type SequenceOperation = (sequence: AnimSequence) => void;
type AsyncSequenceOperation = (sequence: AnimSequence) => Promise<unknown>;


// playback button class constants
const PRESSED = 'playback-button--pressed';
const DISABLED_FROM_STEPPING = 'playback-button--disabledFromStepping';
const DISABLED_POINTER_FROM_STEPPING = 'playback-button--disabledPointerFromStepping'; // disables pointer
const DISABLED_FROM_EDGE = 'playback-button--disabledFromTimelineEdge'; // disables pointer and grays out button
const DISABLED_FROM_PAUSE = 'playback-button--disabledFromPause';

// TYPE
type PlaybackButtons = {
  [key in `${'stepForward' | 'stepBackward' | 'pause' | 'toggleSkipping' | 'fastForward'}Button`]: WebchalkPlaybackButtonElement | null | undefined;
};
// TYPE
type PlaybackButtonPurpose = `Step ${'Forward' | 'Backward'}` | 'Pause' | 'Fast Forward' | 'Toggle Skipping';

// TYPE
/**
 * An options object specifying the location at which the sequences should be inserted {@link AnimTimeline.addSequences}.
 * Used in {@link AnimTimeline.addSequences | addSequences}.
 * @category hidden
 */
export type AddSequencesOptions = {
  /**
   * The index at which the sequences should be added.
   */
  atIndex: number;
};

/**
 * @hideconstructor
 * 
 * @groupDescription Property Getter Methods
 * Methods that return objects that contain various internal fields of the timeline (such as `isPaused` from `getStatus()`).
 * 
 * @groupDescription Playback Methods
 * Methods that control the playback of the animation timeline.
 * 
 * @groupDescription Timing Event Methods
 * Methods that involve listening to the progress of the animation timeline to perform tasks at specific times.
 * 
 * @groupDescription Structure
 * Methods that relate to building the timeline or locating sequences within it.
 * 
 * @groupDescription UI Methods
 * Methods that control the connection between the timeline and visible HTML UI.
 */
export class AnimTimeline {
  private static id = 0;
  private static currentUiAttachedTimeline: AnimTimeline | null = null;

  private config: AnimTimelineConfig = {
    debugMode: false,
    timelineName: '<unnamed timeline>',
    keyboardShortcuts: {},
  };

  /**
   * Returns an object containing the configuration options used to
   * define the name, debugging behavior, and button-linking behavior of the timeline.
   * @returns An object containing
   *  * {@link AnimTimelineConfig.debugMode|debugMode},
   *  * {@link AnimTimelineConfig.timelineName|timelineName},
   *  * {@link AnimTimelineConfig.keyboardShortcuts|keyboardShortcuts},
   * @group Property Getter Methods
   * @group Configuration
   */
  getConfig(): AnimTimelineConfig {
    return {...this.config};
  }

  /*-:**************************************************************************************************************************/
  /*-:*************************************        FIELDS & ACCESSORS        ***************************************************/
  /*-:**************************************************************************************************************************/
  /**
   * A number that uniquely identifies the timeline from other timelines.
   * Automatically generated.
   */
  readonly id;

  /**
   * The highest level of this timeline's lineage.
   *  * The timeline itself is always the root (there is currently no higher possible level).
   * @group Structure
   */
  get root(): AnimTimeline { return this; }
  /** @internal */ animSequences: AnimSequence[] = []; // array of every AnimSequence in this timeline
  /**
   * The number of sequences in this timeline.
   * @group Structure
   */
  get numSequences(): number { return this.animSequences.length; }

  /**
   * Returns an object containing basic information about the timeline and its children.
   * @returns An object containing basic information about the timeline and its children.
   * @group Structure
   */
  getHierarchy(): AnimTimelineHierarchy {
    return {
      root: this,
      sequences: this.animSequences,
      numSequences: this.animSequences.length,
    };
  }

  private loadedSeqIndex = 0; // index into animSequences
  // CHANGE NOTE: AnimTimeline now stores references to in-progress sequences and also does not act directly on individual animations
  private inProgressSequences: Map<number, AnimSequence> = new Map();

  // GROUP: Status
  private isAnimating = false; // true if currently in the middle of executing animations; false otherwise
  private skippingOn = false; // used to determine whether or not all animations should be instantaneous
  private isPaused = false;
  private currentDirection: 'forward' | 'backward' = 'forward'; // set to 'forward' after stepForward() or 'backward' after stepBackward()
  private isJumping = false; // true if currently using jumpTo()
  private get stepNumber(): number { return this.loadedSeqIndex + 1; }
  private get atBeginning(): boolean { return this.loadedSeqIndex === 0; }
  private get atEnd(): boolean { return this.loadedSeqIndex === this.numSequences; }
  private get lockedStructure(): boolean {
    if (this.isAnimating || this.isJumping || this.error) { return true; }
    return false;
  }
  private error?: {
    errorName: string;
    uiMessageFrags?: ErrorUIMessageFragments;
  };
  /** @internal */
  setError(error: AnimTimelineStatus['error']) {
    this.error = error;
    this.webchalkTimelineEl?.handleErrorState();
  }
  /**
   * Returns details about an timeline's current status.
   * @returns An object containing
   *  * {@link AnimTimelineStatus.isAnimating|isAnimating},
   *  * {@link AnimTimelineStatus.isPaused|isPaused},
   *  * {@link AnimTimelineStatus.skippingOn|skippingOn},
   *  * {@link AnimTimelineStatus.currentDirection|currentDirection},
   *  * {@link AnimTimelineStatus.isJumping|isJumping},
   *  * {@link AnimTimelineStatus.stepNumber|stepNumber},
   *  * {@link AnimTimelineStatus.atBeginning|atBeginning},
   *  * {@link AnimTimelineStatus.atEnd|atEnd},
   *  * {@link AnimTimelineStatus.error|error},
   * @group Property Getter Methods
   */
  getStatus(): AnimTimelineStatus;
  /**
   * Returns the value of a single specific property.
   * @param propName - The name of the desired property.
   * @ignore
   */
  getStatus<T extends keyof AnimTimelineStatus>(propName: T): AnimTimelineStatus[T];
  /**
   * Returns an object containing a subset of the object that would normally be returned.
   * @param propNames - An array of strings specifying which properties should be included.
   * @ignore
   */
  getStatus<T extends (keyof AnimTimelineStatus)[]>(propNames: (keyof AnimTimelineStatus)[] | T): PickFromArray<AnimTimelineStatus, T>;
  /**
   * @group Property Getter Methods
   */
  getStatus(specifics?: keyof AnimTimelineStatus | (keyof AnimTimelineStatus)[]):
    | AnimTimelineStatus
    | AnimTimelineStatus[keyof AnimTimelineStatus]
    | Partial<Pick<AnimTimelineStatus, keyof AnimTimelineStatus>>
  {
    const result: AnimTimelineStatus = {
      isAnimating: this.isAnimating,
      skippingOn: this.skippingOn,
      isPaused: this.isPaused,
      currentDirection: this.currentDirection,
      isJumping: this.isJumping,
      stepNumber: this.stepNumber,
      atBeginning: this.atBeginning,
      atEnd: this.atEnd,
      error: this.error,
    };

    return specifics ? getPartial(result, specifics) : result;
  }

  // GROUP: Timing
  private playbackRate = 1;

  /**
   * Returns timing-related details about the timeline.
   * @returns An object containing
   *  * {@link AnimTimelineStatus.playbackRate|playbackRate},
   * @group Property Getter Methods
   */
  getTiming(): AnimTimelineTiming;
  /**
   * Returns the value of a single specific property.
   * @param propName - The name of the desired property.
   * @ignore
   */
  getTiming<T extends keyof AnimTimelineTiming>(propName: T): AnimTimelineTiming[T];
  /**
   * Returns an object containing a subset of the object that would normally be returned.
   * @param propNames - An array of strings specifying which properties should be included.
   * @ignore
   */
  getTiming<T extends (keyof AnimTimelineTiming)[]>(propNames: (keyof AnimTimelineTiming)[] | T): PickFromArray<AnimTimelineTiming, T>;
  /**
   * @group Property Getter Methods
   */
  getTiming(specifics?: keyof AnimTimelineTiming | (keyof AnimTimelineTiming)[]):
    | AnimTimelineTiming
    | AnimTimelineTiming[keyof AnimTimelineTiming]
    | Partial<Pick<AnimTimelineTiming, keyof AnimTimelineTiming>>
  {
    const result: AnimTimelineTiming = {
      playbackRate: this.playbackRate,
    };

    return specifics ? getPartial(result, specifics) : result;
  }
  
  /*-:**************************************************************************************************************************/
  /*-:*********************************        CONSTRUCTOR & INITIALIZERS        ***********************************************/
  /*-:**************************************************************************************************************************/
  /**@internal*/
  static createInstance(config: Partial<AnimTimelineConfig> | AnimSequence[] = {}, animSequences?: AnimSequence[]): AnimTimeline {
    return new AnimTimeline(config, animSequences);
  }

  /**@internal*/
  constructor(configOrSequences: Partial<AnimTimelineConfig> | AnimSequence[] = {}, animSequences?: AnimSequence[]) {
    if (webchalk.timelineCreatorLock) {
      throw this.generateError(TypeError, [`Illegal constructor. Timelines can only be instantiated using webchalk.newTimeline().`]);
    }
    webchalk.timelineCreatorLock = true;
    
    this.id = AnimTimeline.id++;

    // If first argument is an AnimSequence[], add sequences to timeline.
    // Else, it must be a configuration object. Assign its values to this timeline's configuration object
    if (configOrSequences instanceof Array) {
      this.addSequences(configOrSequences);
    }
    else {
      Object.assign<AnimTimelineConfig, Partial<AnimTimelineConfig>>(this.config, configOrSequences);
      this.addSequences(animSequences ?? [])
    }
  }

  /*-:**************************************************************************************************************************/
  /*-:*************************************        STRUCTURE        ****************************************************/
  /*-:**************************************************************************************************************************/
  /**
   * Adds {@link AnimSequence} objects to the end of the timeline.
   * @param animSequences - An array of animation sequences to add.
   * @returns 
   * @group Structure
   */
  addSequences(animSequences: AnimSequence[]): this;
  /**
   * Adds {@link AnimSequence} objects to the specified location within the timeline.
   * @param location - An object containing options specifying the location at which the sequences should be inserted.
   * @param animSequences - An array of animation sequences to add.
   * @returns 
   * @group Structure
   */
  addSequences(location: AddSequencesOptions, animSequences: AnimSequence[]): this;
  addSequences(locationOrSequences: AddSequencesOptions | AnimSequence[], animSequences: AnimSequence[] = []): this {
    if (this.lockedStructure) { throw this.generateLockedStructureError(this.addSequences.name); }

    const [sequences, loc] = (locationOrSequences instanceof Array)
    ? [locationOrSequences, undefined]
    : [animSequences, locationOrSequences];
    
    if (sequences.length === 0) { return this; }

    // TODO: handle possibility of adding at invalid atIndex

    for(const animSequence of sequences) {
      if (!(animSequence instanceof AnimSequence)) {
        throw this.generateError(CustomErrorClasses.InvalidChildError, [`At least one of the objects being added is not an AnimSequence.`]);
      }
      if (animSequence.parentTimeline) {
        // TODO: Improve error message
        throw this.generateError(CustomErrorClasses.InvalidChildError, [`At least one of the sequences being added is already part of some timeline.`]);
      }
      if (animSequence.getStatus('lockedStructure')) {
        throw this.generateError(CustomErrorClasses.InvalidChildError, [`At least one of the sequences being added is in progress or in a forward finished state.`]);
      }
      if (!animSequence.setLineage(this)) {
        throw this.generateError(
          CustomErrorClasses.InvalidChildError,
          [`At least one of the sequences being added appears in the given array multiple times.`]
        );
      }
    };
    
    // insert clips
    const atIndex = loc ? loc.atIndex : this.animSequences.length;
    this.animSequences.splice(atIndex, 0, ...sequences);
    // update the sequence numbers of the new sequences and any sequences that are now after them in the array
    for (let i = atIndex; i < this.animSequences.length; ++i) {
      this.animSequences[i].updateSequenceNumber(i + 1);
    }
    this.webchalkTimelineEl?.insertSequences(atIndex, sequences);

    // no need to worry about backward button because it's impossible to reach or leave index 0 by adding sequences
    this.playbackButtons.stepForwardButton?.classList.remove(DISABLED_FROM_EDGE);

    return this;
  }

  /**
   * Removes specified {@link AnimSequence} objects from the timeline.
   * @param animSequences - An array of animation sequences to remove.
   * @returns 
   * @group Structure
   */
  removeSequences(animSequences: AnimSequence[]): this {
    if (this.lockedStructure) { throw this.generateLockedStructureError(this.removeSequences.name); }

    // sort the array of sequences to remove so that we can traverse them in reverse order
    const sortedTargetSequences = animSequences.toSorted((a, b) => a.getHierarchy().sequenceNumber - b.getHierarchy().sequenceNumber);
    // final version of anim sequences that will replace array stored in this timeline
    const finalAnimSequences = [...this.animSequences];
    // array of removed sequences to return
    const removedSequences: AnimSequence[] = [];

    let lowestIndex = Infinity;

    for (let i = sortedTargetSequences.length - 1; i >= 0; --i) {
      const index = this.findSequenceIndex(sortedTargetSequences[i]);
      if (index === -1) {
        // TODO: improve error
        throw this.generateError(
          CustomErrorClasses.InvalidChildError,
          [`At least one of the sequences being removed from this timeline was already not in the timeline.`]
        );
      }
      if (index <= this.loadedSeqIndex - 1) {
        throw this.generateError(
          CustomErrorClasses.TimeParadoxError,
          [`Removing sequences that have already been played is prohibited.` +
          errorTip(
            `Tip: Just as changing the past is not possible, changing parts of the timeline that have already passed is not allowed.` +
            ` In order to remove sequences from a part of the timeline that has already been played, the timeline must be rewound to before that point` +
            ` (conceptually, it is always possible to change the future but never the past).`
          )],
        );
      }
      removedSequences.push(...finalAnimSequences.splice(index, 1));
      lowestIndex = Math.min(lowestIndex, index)
    }

    if (removedSequences.length === 0) { return this; }

    // confirm deletion
    for (const sequence of removedSequences) {
      sequence.removeLineage();
    }

    // update
    this.animSequences = finalAnimSequences;
    for (let i = lowestIndex; i < finalAnimSequences.length; ++i) {
      finalAnimSequences[i].updateSequenceNumber(i + 1);
    }
    this.webchalkTimelineEl?.removeSequences(removedSequences);

    // If the last sequences were removed, must account for forward button style.
    // No need to worry about atBeginning because it's impossible to reach index = 0 by removing sequences.
    if (this.atEnd) {
      this.playbackButtons.stepForwardButton?.classList.add(DISABLED_FROM_EDGE);
    }

    return this;
  }

  /**
   * Removes a number of {@link AnimSequence} objects from the timeline based on the provided indices range (0-based).
   * @param startIndex - The starting index, inclusive.
   * @param endIndex - The ending index, exclusive (if not specified, {@link startIndex} `+ 1` is used, removing one sequence).
   * @returns An array containing the sequences that were removed from the timeline.
   * @group Structure
   */
  removeSequencesAt(startIndex: number, endIndex: number = startIndex + 1): AnimSequence[] {
    if (this.lockedStructure) { throw this.generateLockedStructureError(this.removeSequencesAt.name); }
    if (startIndex <= this.loadedSeqIndex - 1) {
      throw this.generateError(
        CustomErrorClasses.TimeParadoxError,
        [`startIndex '${startIndex}' falls within the range of sequences that have already been played,` +
        ` but removing sequences that have already been played is prohibited.` +
        errorTip(
          `Tip: Just as changing the past is not possible, changing parts of the timeline that have already passed is not allowed.` +
          ` In order to remove sequences from a part of the timeline that has already been played, the timeline must be rewound to before that point` +
          ` (conceptually, it is always possible to change the future but never the past).`
        )],
      );
    }

    const removedSequences = this.animSequences.splice(startIndex, endIndex - startIndex);

    if (removedSequences.length === 0) { return []; }

    for (const sequence of removedSequences) {
      sequence.removeLineage();
    }

    // update
    const animSequences = this.animSequences;
    for (let i = Math.max(0, startIndex); i < animSequences.length; ++i) {
      animSequences[i].updateSequenceNumber(i + 1);
    }
    this.webchalkTimelineEl?.removeSequences(removedSequences);

    if (this.atEnd) {
      this.playbackButtons.stepForwardButton?.classList.add(DISABLED_FROM_EDGE);
    }

    return removedSequences;
  }

  /**
   * Finds the index of a given {@link AnimSequence} object within the timeline
   * @param animSequence - The animation sequence to search for within the timeline.
   * @returns The index of {@link animSequence} within the timeline or `-1` if the sequence is not part of the timeline.
   * @group Structure
   */
  findSequenceIndex(animSequence: AnimSequence): number {
    return this.animSequences.findIndex((_animSequence) => _animSequence === animSequence);
  }
    
  /*-:**************************************************************************************************************************/
  /*-:****************************************        UI METHODS        ********************************************************/
  /*-:**************************************************************************************************************************/
  /** @internal */ webchalkTimelineEl?: WebchalkTimelinePaneElement;
  /** @internal */ playbackButtonsContainer?: HTMLElement;
  // TODO: put in some kind of config that user can see
  /** @internal */ get playbackButtonsAttached(): boolean { return this.playbackButtonsContainer ? true : false; }
  /** @internal */ get uiPaneAttached(): boolean { return this.webchalkTimelineEl ? true : false; }

  /**
   * Reveals a graphical user interface representing the timeline.
   * @returns
   * @group UI Methods
   */
  attachPaneUI() {
    // TODO: include some way to close the pane ui or something
    // TODO: maybe allow only one pane UI to exist at a time (in the case of multiple timelines)
    // TODO: improve error message
    if (this.uiPaneAttached) { throw new Error('AnimTimeline Pane UI already attached'); }
    if (AnimTimeline.currentUiAttachedTimeline) { throw new Error(`An AnimTimeline UI is already attach {name: "${AnimTimeline.currentUiAttachedTimeline.getConfig().timelineName}". It must be detached first.`); }
    this.webchalkTimelineEl = new WebchalkTimelinePaneElement();
    this.webchalkTimelineEl.animTimeline = this;
    this.webchalkTimelineEl.style.display = 'none';

    // If there is a set of playback buttons in the assets container, make sure the timeline does not cover it up.
    const assetsContainerEl = document.querySelector('.webchalk-assets-container')!;
    const fixedPlaybackButtons = assetsContainerEl.querySelector('.playback-buttons');
    if (fixedPlaybackButtons) { fixedPlaybackButtons.insertAdjacentElement('beforebegin', this.webchalkTimelineEl); }
    else { assetsContainerEl.insertAdjacentElement('beforeend', this.webchalkTimelineEl); }

    this.webchalkTimelineEl.readTimeline();
    this.webchalkTimelineEl.style.removeProperty('display');
    AnimTimeline.currentUiAttachedTimeline = this;
  }

  /**
   * Detaches the graphical user interface representing the timeline.
   * @returns
   * @group UI Methods
   */
  detachPaneUI() {
    // if (!this.uiAttached) { throw this.generateError(Error('AnimTimeline UI is already not attached.')); }
    if (!this.uiPaneAttached) { return; }
    this.webchalkTimelineEl!.remove();
    this.webchalkTimelineEl = undefined;

    for (const sequence of this.animSequences) {
      sequence.detachUI();
    }

    AnimTimeline.currentUiAttachedTimeline = null;
  }

  private _playbackButtons: PlaybackButtons = {
    stepBackwardButton: null,
    fastForwardButton: null,
    stepForwardButton: null,
    pauseButton: null,
    toggleSkippingButton: null,
  };

  /**
   * Object containing properties that are either references to `<webchalk-playback-button>` elements that are connected to this timeline or `null`.
   *  * A property being `null` indicates that there is currently no corresponding button on the page that is linked to this timeline.
   * @group UI Methods
   * @internal
   */
  get playbackButtons(): Readonly<PlaybackButtons> { return {...this._playbackButtons}; }

  /**
   * Inserts a container into the page containing `<webchalk-playback-button>` elements whose
   * `timeline-name` attributes are equivalent to this timeline's `timelineName` configuration option,
   * then links those buttons to this timeline.
   *  * By default, all button types are injected.
   * @param options - An object containing settings to define the behavior of the buttons setup.
   * @param options.buttonsContainerLocation - The HTML element where the buttons container should be placed.
   * @param options.buttonsSubset - An array of strings indicating which specific buttons we want to link.
   * @returns 
   * @group UI Methods
   */
  attachPlaybackButtonsUI(options: {
    // TODO: Include jumping menu inside playback buttons container
    /** The HTML element where the buttons container should be placed. */
    buttonsContainerLocation?: HTMLElement;
    /** An array of strings indicating which specific buttons we want to link. By default, all buttons are searched for. */
    buttonsSubset?: PlaybackButtonPurpose[];
  } = {}): this {
    // TODO: improve error
    if (this.playbackButtonsContainer) { throw new Error('The playback buttons for this timeline have already been attached. To remove the current ones, call the detachPlaybackButtons() method.'); }
    if (this.lockedStructure) { throw this.generateLockedStructureError(this.attachPlaybackButtonsUI.name); }
    // if (!this.config.timelineName) { throw new Error(`A timeline cannot link playback buttons if the timeline's timelineName config option is not set.`); }

    // Get button container location, subset of buttons to attach, and any keyboard shortcuts.
    const {
      buttonsContainerLocation = document.querySelector('.webchalk-assets-container')!,
      buttonsSubset = [`Step Forward`, `Step Backward`, `Fast Forward`, `Pause`, `Toggle Skipping`],
    } = options;
    const { keyboardShortcuts } = this.config;
    this.playbackButtonsContainer = createElFromString(/*html*/`
      <div class="playback-buttons" ${this.config.timelineName ? `timeline-name="${this.config.timelineName}"` : ''}>
        <div class="playback-buttons-inner-wrapper"></div>
      </div>
    `);
    buttonsContainerLocation.appendChild(this.playbackButtonsContainer);

    // create playback button element and attach to DOM
    const createButton = (action: WebchalkPlaybackButtonElement['action'], options: {allowHolding?: boolean} = {}) => {
      const {
        allowHolding = false,
      } = options;
      const shortcut = keyboardShortcuts[
        action.replaceAll(/(\-)(.)/g, (match, dash, letter) => letter.toUpperCase()) as keyof typeof keyboardShortcuts
      ] ?? null;
      const button = createElFromString(/*html*/`
        <webchalk-playback-button
          action="${action}"
          ${shortcut ? `shortcut="${shortcut}"` : ''}
          ${allowHolding ? `allow-holding` : ''}
        >
        </webchalk-playback-button>
      `);
      this.playbackButtonsContainer!.querySelector('.playback-buttons-inner-wrapper')!.append(button);
      return button as WebchalkPlaybackButtonElement;
    };

    // create buttons
    const stepBackwardButton = buttonsSubset.includes('Step Backward') ? createButton("step-backward", {allowHolding: true}) : undefined;
    const pauseButton = buttonsSubset.includes('Pause') ? createButton("pause") : undefined;
    const stepForwardButton = buttonsSubset.includes('Step Forward') ? createButton("step-forward", {allowHolding: true}) : undefined;
    const fastForwardButton = buttonsSubset.includes('Fast Forward') ? createButton("fast-forward") : undefined;
    const toggleSkippingButton = buttonsSubset.includes('Toggle Skipping') ? createButton("toggle-skipping") : undefined;

    if (stepForwardButton) {
      stepForwardButton.activate = () => {
        if (this.isAnimating || this.isPaused || this.atEnd) { return; }
        
        stepForwardButton.styleActivation();
        this.step('forward', {viaButton: true}).then(() => { stepForwardButton.styleDeactivation(); });
      }
      stepForwardButton.styleActivation = () => {
        const backwardButton = this.playbackButtons.stepBackwardButton;
        stepForwardButton.classList.add(PRESSED);
        backwardButton?.classList.remove(DISABLED_FROM_EDGE); // if stepping forward, we of course won't be at the left edge of timeline
        backwardButton?.classList.add(DISABLED_FROM_STEPPING);
        stepForwardButton.classList.add(DISABLED_POINTER_FROM_STEPPING);
      };
      stepForwardButton.styleDeactivation = () => {
        const backwardButton = this.playbackButtons.stepBackwardButton;
        stepForwardButton.classList.remove(PRESSED);
        stepForwardButton.classList.remove(DISABLED_POINTER_FROM_STEPPING);
        backwardButton?.classList.remove(DISABLED_FROM_STEPPING);
        if (this.atEnd) { stepForwardButton.classList.add(DISABLED_FROM_EDGE); }
      };

      if (this.atEnd) {
        stepForwardButton.classList.add(DISABLED_FROM_EDGE);
      }
    }

    if (stepBackwardButton) {
      stepBackwardButton.activate = () => {
        if (this.isAnimating || this.isPaused || this.atBeginning) { return; }

        stepBackwardButton.styleActivation();
        this.step('backward', {viaButton: true}).then(() => { stepBackwardButton.styleDeactivation(); });
      };

      stepBackwardButton.styleActivation = () => {
        const forwardButton = this.playbackButtons.stepForwardButton;
        stepBackwardButton.classList.add(PRESSED);
        forwardButton?.classList.remove(DISABLED_FROM_EDGE);
        forwardButton?.classList.add(DISABLED_FROM_STEPPING);
        stepBackwardButton.classList.add(DISABLED_POINTER_FROM_STEPPING);
      };
      stepBackwardButton.styleDeactivation = () => {
        const forwardButton = this.playbackButtons.stepForwardButton;
        stepBackwardButton.classList.remove(PRESSED);
        forwardButton?.classList.remove(DISABLED_FROM_STEPPING);
        stepBackwardButton.classList.remove(DISABLED_POINTER_FROM_STEPPING);
        if (this.atBeginning) { stepBackwardButton.classList.add(DISABLED_FROM_EDGE); }
      };

      if (this.atBeginning) {
        stepBackwardButton.classList.add(DISABLED_FROM_EDGE);
      }
    }

    if (pauseButton) {
      pauseButton.activate = () => {
        pauseButton.styleActivation();
        this.pause({viaButton: true});
      };
      pauseButton.deactivate = () => {
        pauseButton.styleDeactivation();
        this.unpause({viaButton: true});
      };

      pauseButton.styleActivation = () => {
        const forwardButton = this.playbackButtons.stepForwardButton;
        const backwardButton = this.playbackButtons.stepBackwardButton;
        pauseButton.active = true;
        pauseButton.classList.add(PRESSED);
        forwardButton?.classList.add(DISABLED_FROM_PAUSE);
        backwardButton?.classList.add(DISABLED_FROM_PAUSE);
      };
      pauseButton.styleDeactivation = () => {
        const forwardButton = this.playbackButtons.stepForwardButton;
        const backwardButton = this.playbackButtons.stepBackwardButton;
        pauseButton.active = false;
        pauseButton.classList.remove(PRESSED);
        forwardButton?.classList.remove(DISABLED_FROM_PAUSE);
        backwardButton?.classList.remove(DISABLED_FROM_PAUSE);
      };
    }

    if (fastForwardButton) {
      fastForwardButton.activate = () => {
        fastForwardButton.styleActivation();
        this.setPlaybackRate(7);
      };
      fastForwardButton.deactivate = () => {
        fastForwardButton.styleDeactivation();
        this.setPlaybackRate(1);
      };

      fastForwardButton.styleActivation = () => {
        fastForwardButton.active = true;
        fastForwardButton.classList.add(PRESSED);
      };
      fastForwardButton.styleDeactivation = () => {
        fastForwardButton.active = false;
        fastForwardButton.classList.remove(PRESSED);
      };
    }

    if (toggleSkippingButton) {
      toggleSkippingButton.activate = () => {
        toggleSkippingButton.styleActivation();
        this.toggleSkipping({forceState: 'on', viaButton: true});
      }
      toggleSkippingButton.deactivate = () => {
        toggleSkippingButton.styleDeactivation();
        this.toggleSkipping({forceState: 'off', viaButton: true});
      };
      toggleSkippingButton.styleActivation = () => {
        toggleSkippingButton.classList.add(PRESSED);
        toggleSkippingButton.active = true;
      };
      toggleSkippingButton.styleDeactivation = () => {
        toggleSkippingButton.classList.remove(PRESSED);
        toggleSkippingButton.active = false;
      };
    }

    // TODO: update the warning code below
    let wasWarned = false;
    const warnedList: string[] = [];

    const warnButton = (button: WebchalkPlaybackButtonElement | null | undefined, purpose: PlaybackButtonPurpose) => {
      if (!button && buttonsSubset.includes(purpose)) {
        warnedList.push(purpose);
        wasWarned = true;
      }
    }

    warnButton(stepForwardButton, 'Step Forward');
    warnButton(pauseButton, 'Pause');
    warnButton(stepBackwardButton, 'Step Backward');
    warnButton(fastForwardButton, 'Fast Forward');
    warnButton(toggleSkippingButton, 'Toggle Skipping');
    if (wasWarned) {
      console.warn(
        `Some buttons for timeline named "${this.config.timelineName}" not found.`
        + ` Missing buttons: ${warnedList.join(', ')}.`
        + errorTip(
          `For <webchalk-playback-button> tags to be detected, their 'timeline-name' attribute (or the 'timeline-name' attribute of`
          + ` their parent container) must match this timeline's 'timelineName' configuration option.`
          + ` If this timeline does not need to detect any buttons, you may set its 'autoLinkButtons' config option to false`
        + ` to prevent this warning.`)
      );
    }

    Object.assign(this._playbackButtons, {
      stepForwardButton, stepBackwardButton, pauseButton, fastForwardButton, toggleSkippingButton,
    });

    return this;
  }

  /**
   * Removes the playback buttons attached to the timeline.
   * @returns
   * @group UI Methods
   */
  detachPlaybackButtons() {
    if (this.lockedStructure) { throw this.generateLockedStructureError(this.detachPlaybackButtons.name); }

    for (const [prop, button] of Object.entries(this.playbackButtons) as [keyof typeof this.playbackButtons, WebchalkPlaybackButtonElement][]) {
      button.remove();
      this._playbackButtons[prop] = null;
    }
    this.playbackButtonsContainer?.remove();
    this.playbackButtonsContainer = undefined;
  }

  /**
   * @param keyboardShortcuts - An object specifying keyboard shortcuts for the specified buttons.
   * @remarks
   * Unspecified buttons will not be affected. To delete keyboard shortcuts, explicitly set `null` as the key value.
   * @returns
   * @group UI Methods
   */
  setKeyboardShortcuts(keyboardShortcuts: AnimTimelineConfig['keyboardShortcuts']): this {
    for (const [prop, keyVal] of Object.entries(keyboardShortcuts)) {
      if (keyVal) { this.config.keyboardShortcuts[prop as keyof typeof this.config.keyboardShortcuts] = keyVal; }
      else { delete this.config.keyboardShortcuts[prop as keyof typeof this.config.keyboardShortcuts]; }

      const button = this.playbackButtons[`${prop}Button` as keyof typeof this.playbackButtons];
      if (button) { button.setShortcutKey(keyVal); }
    }

    return this;
  }

  /**
   * Disables this timeline's connection to its playback buttons until re-enabled
   * using {@link AnimTimeline.enablePlaybackButtons|enablePlaybackButtons()}.
   * @group UI Methods
   */
  disablePlaybackButtons() {
    for (const button of Object.values(this.playbackButtons)) { button?.disable(); }
  }

  /**
   * Allows this timeline's linked playback buttons to trigger (and be triggered by) this timeline's playback methods.
   *  * This method is only useful if the buttons were previously
   * disabled using {@link AnimTimeline.disablePlaybackButtons|disablePlaybackButtons()}.
   * @group UI Methods
   */
  enablePlaybackButtons() {
    for (const button of Object.values(this.playbackButtons)) { button?.enable(); }
  }


  /*-:**************************************************************************************************************************/
  /*-:*************************************        PLAYBACK METHODS        *****************************************************/
  /*-:**************************************************************************************************************************/
  // CHANGE NOTE: sequences, and clips now have base playback rates that are then compounded by parents
  /**
   * Sets the base playback rate of the timeline.
   * @param rate - The new playback rate.
   * @returns 
   * @group Playback Methods
   */
  setPlaybackRate(rate: number): this {
    this.playbackRate = rate;
    // set playback rates of currently running animations so that they don't continue to run at regular speed
    this.doForInProgressSequences(sequence => sequence.useCompoundedPlaybackRate());

    return this;
  }

  // steps forward or backward and does error-checking
  // TODO: potentially move setting of this.isAnimating to stepForward() and stepBackward()
  /**
   * Takes 1 step in the specified direction.
   *  * If any sequences are set to autoplay, the timeline automatically continues stepping through them.
   * @param direction - The direction in which the timeline should step.
   * @returns A {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} that resolves when the timeline has finished stepping.
   * @group Playback Methods
   */
  async step(direction: 'forward' | 'backward'): Promise<this>;
  /**@internal*/
  async step(direction: 'forward' | 'backward', options: {viaButton: boolean}): Promise<this>;
  async step(direction: 'forward' | 'backward', options?: {viaButton: boolean}): Promise<this> {
    if (this.isPaused) { throw new Error('Cannot step while playback is paused.'); }
    if (this.isAnimating) { throw new Error('Cannot step while already animating.'); }
    this.isAnimating = true;

    let continueOn;
    switch(direction) {
      case 'forward':
        if (!options?.viaButton) { this.playbackButtons.stepForwardButton?.styleActivation(); }
        // reject promise if trying to step forward at the end of the timeline
        if (this.atEnd) { return new Promise((_, reject) => {this.isAnimating = false; reject('Cannot stepForward() at end of timeline.')}); }
        do {continueOn = await this.stepForward();} while(continueOn);
        if (!options?.viaButton) { this.playbackButtons.stepForwardButton?.styleDeactivation(); }
        break;

      case 'backward':
        if (!options?.viaButton) { this.playbackButtons.stepBackwardButton?.styleActivation(); }
        // reject promise if trying to step backward at the beginning of the timeline
        if (this.atBeginning) { return new Promise((_, reject) => {this.isAnimating = false; reject('Cannot stepBackward() at beginning of timeline.')}); }
        do {continueOn = await this.stepBackward();} while(continueOn);
        if (!options?.viaButton) { this.playbackButtons.stepBackwardButton?.styleDeactivation(); }
        break;

      default:
        throw new Error(`Invalid step direction "${direction}". Must be "forward" or "backward".`);
    }

    this.isAnimating = false;
    return this;
  }

  // plays current AnimSequence and increments loadedSeqIndex
  /**
   * 
   * @returns 
   * @group Playback Methods
   */
  private async stepForward(): Promise<boolean> {
    this.currentDirection = 'forward';
    const sequences = this.animSequences;

    const loadedSeq = sequences[this.loadedSeqIndex];
    if (this.config.debugMode) { console.log(`${this.stepNumber} -->>: ${loadedSeq.getDescription()} [Jump tag: ${loadedSeq.getJumpTag() || '<blank sequence tag>'}]`); }

    const toPlay = sequences[this.loadedSeqIndex];
    this.webchalkTimelineEl?.scrollToSequence(toPlay, this.currentDirection);
    this.inProgressSequences.set(toPlay.id, toPlay);
    await sequences[this.loadedSeqIndex].play(); // wait for the current AnimSequence to finish all of its animations
    this.inProgressSequences.delete(toPlay.id);

    ++this.loadedSeqIndex;
    const autoplayNext = !this.atEnd && (
      sequences[this.loadedSeqIndex - 1].getTiming('autoplaysNextSequence') // sequence that was just played
      || sequences[this.loadedSeqIndex].getTiming('autoplays') // new next sequence
    );

    if ((!autoplayNext || this.isJumping) && !this.atEnd) {
      this.webchalkTimelineEl?.scrollToSequence(sequences[this.loadedSeqIndex], this.currentDirection);
    }

    return autoplayNext;
  }

  // decrements loadedSeqIndex and rewinds the AnimSequence
  /**
   * 
   * @returns 
   * @group Playback Methods
   */
  private async stepBackward(): Promise<boolean> {
    this.currentDirection = 'backward';
    const prevSeqIndex = --this.loadedSeqIndex;
    const sequences = this.animSequences;

    const prevSeq = sequences[prevSeqIndex];
    if (this.config.debugMode) { console.log(`<<-- ${this.stepNumber}: ${prevSeq.getDescription()} [Jump tag: ${prevSeq.getJumpTag() || '<blank sequence tag>'}]`); }

    const toRewind = sequences[prevSeqIndex];
    this.webchalkTimelineEl?.scrollToSequence(toRewind, this.currentDirection);
    this.inProgressSequences.set(toRewind.id, toRewind);
    await sequences[prevSeqIndex].rewind();
    this.inProgressSequences.delete(toRewind.id);
    
    const autorewindPrevious = !this.atBeginning && (
      sequences[prevSeqIndex - 1].getTiming('autoplaysNextSequence') // new prev sequence
      || sequences[prevSeqIndex].getTiming('autoplays') // sequence that was just rewound
    );

    if ((!autorewindPrevious || this.isJumping) && !this.atBeginning) {
      this.webchalkTimelineEl?.scrollToSequence(sequences[prevSeqIndex - 1], this.currentDirection);
    }

    return autorewindPrevious;
  }

  // TODO: prevent all button interactions and playback operations when error is present
  // pauses or unpauses playback
  /**
   * Pauses the animation timeline if it is unpaused or unpauses it if it is currently paused.
   * @param options - An options object specifying the behavior of the toggle.
   * @returns 
   * @group Playback Methods
   */
  togglePause(options: {
    /**@internal */
    viaButton?: boolean,
    /**
     * Explicitly instructs the method to either pause (equivalent to {@link AnimTimeline.pause | pause()})
     * or unpause (equivalent to {@link AnimTimeline.unpause | unpause()}).
     */
    forceState?: 'pause' | 'unpause'
  } = {}): this {
    if (options.forceState) {
      const prevPauseState = this.isPaused;
      switch(options.forceState) {
        case 'pause': this.isPaused = true; break;
        case 'unpause': this.isPaused = false; break;
        default: {
          throw this.generateError(RangeError, [`Invalid force value "${options.forceState}". Use "pause" to pause or "unpause" to unpause.`]);
        }
      }
      // if toggling did nothing, just return
      if (prevPauseState === this.isPaused) { return this; }
    }
    else {
      this.isPaused = !this.isPaused;
    }

    const viaButton = options.viaButton ?? false;
    this.isPaused ? this.pause({viaButton}) : this.unpause({viaButton});
    
    return this;
  }

  /**
   * Pauses the animation timeline.
   *  * If the timeline is not already in progress, it will still be paused, preventing
   * playback until unpaused.
   * @group Playback Methods
   */
  pause(): this;
  /**@internal*/
  pause(options?: { viaButton: boolean }): this;
  pause(options?: { viaButton: boolean }): this {
    this.isPaused = true;
    if (!options?.viaButton) { this.playbackButtons.pauseButton?.styleActivation(); }
    this.doForInProgressSequences(sequence => sequence.pause());
    return this;
  }
  
  /**
   * Unpauses the animation timeline.
   *  * If the timeline is not currently paused, this method does nothing.
   * @group Playback Methods
   */
  unpause(): this;
  /**@internal*/
  unpause(options?: { viaButton: boolean }): this;
  unpause(options?: { viaButton: boolean }): this {
    this.isPaused = false;
    if (!options?.viaButton) { this.playbackButtons.pauseButton?.styleDeactivation(); }
    this.doForInProgressSequences(sequence => sequence.unpause());
    if (this.skippingOn) { this.finishInProgressSequences(); }
    return this;
  }

  /**
   * Jumps instantly to the sequence whose {@link AnimSequence.getJumpTag|AnimSequence.getJumpTag()} value matches the {@link jumpTag} argument.
   * @param jumpTag - The string that is used to search for the target sequence with the matching {@link AnimSequence.getJumpTag|AnimSequence.getJumpTag()} value.
   * @param options - An options object defining the behavior of the search, the offset of the jump, and whether to consider autoplay.
   * @returns A {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} that resolves when the timeline has finished jumping.
   * 
   * 
   * @example
   * <!-- EX:S id="AnimTimeline.jumpToSequenceTag" code-type="ts" -->
   * ```ts
   * const {Entrance, Motion, Exit} = webchalk.createAnimationClipFactories();
   * const square = document.querySelector('.square');
   * 
   * const tLine = webchalk.newTimeline(
   *   [
   *     webchalk.newSequence(
   *       {jumpTag: 'flickering'},
   *       [
   *         Entrance(square, '~appear', [], {endDelay: 500}),
   *         Exit(square, '~disappear', [], {endDelay: 500}),
   *         Entrance(square, '~appear', [], {endDelay: 500}),
   *         Exit(square, '~disappear', [], {endDelay: 500}),
   *         Entrance(square, '~appear', [], {endDelay: 500}),
   *         Exit(square, '~disappear', [], {endDelay: 500}),
   *       ]
   *     ),
   * 
   *     webchalk.newSequence(
   *       {jumpTag: 'move around'},
   *       [
   *         Motion(square, '~translate', [{translate: '200px 0px'}]),
   *         Motion(square, '~translate', [{translate: '0px 200px'}]),
   *         Motion(square, '~translate', [{translate: '-200px 0px'}]),
   *         Motion(square, '~translate', [{translate: '0px -200px'}]),
   *       ]
   *     ),
   * 
   *     webchalk.newSequence(
   *       {jumpTag: 'go away', autoplays: true},
   *       [
   *         Exit(square, '~pinwheel', []),
   *       ]
   *     ),
   *   ]
   * );
   * 
   * // Promise-based timer
   * async function wait(milliseconds: number) {
   *   return new Promise(resolve => setTimeout(resolve, milliseconds));
   * }
   * 
   * (async () => {
   *   // jump straight to sequence with tag "move around"
   *   await tLine.jumpToSequenceTag('move around');
   * 
   *   await wait (1000); // wait 1 second
   * 
   *   // jump to sequence whose tag contains "flick"
   *   // (so now we're back at the beginning of the timeline)
   *   await tLine.jumpToSequenceTag(/flick/);
   * 
   *   await wait (1000); // wait 1 second
   * 
   *   // jump to sequence with tag "move around"
   *   // then look forward to see if any sequences have {autoplays: true}
   *   // the next one does, so it continues, skipping to the third sequence
   *   await tLine.jumpToSequenceTag('move around', {autoplayDetection: 'forward'});
   * 
   *   await wait (1000); // wait 1 second
   * 
   *   // play the last sequence
   *   await tLine.step('forward');
   * })();
   * ```
   * <!-- EX:E id="AnimTimeline.jumpToSequenceTag" -->
   * 
   * @group Playback Methods
   */
  jumpToSequenceTag(
    jumpTag: string | RegExp,
    options: {
      /**
       * The direction and/or the starting point of the search.
       * @defaultValue
       * ```ts
       * 'forward-from-beginning'
       * ```
       */
      search?: 'forward-from-beginning' | 'backward-from-end' | 'forward' | 'backward';
      /** An offset that changes the starting point of the search by the indicated amount. */
      searchOffset?: number;
      /** An offset that adds to the initial landing position. */
      targetOffset?: number;
      /**
       * Determines how the timeline should handle sequences set to autoplay once the
       * jump destination (after considering {@link options.targetOffset}) has been reached.
       *  * If `'none`', the timeline stays at the final landing position after the initial jumping operation.
       *  * If `'forward'`, the timeline will jump forward for as long as the next sequence is supposed to autoplay after the current sequence.
       *  * If `'backward'`, the timeline will jump backward for as long as the previous sequence is supposed to automatically
       * rewind after the current sequence is rewound (this is naturally only true when the current sequence is set to autoplay when the timeline steps forward).
       * @defaultValue
       * ```ts
       * 'none'
       * ```
       */
      autoplayDetection?: 'forward' | 'backward' | 'none';
    } = {},
  ): Promise<this> {
    const {
      search = 'forward-from-beginning',
      targetOffset = 0,
      searchOffset = 0,
      autoplayDetection = 'none',
    } = options;
    return this.jumpTo({ jumpTag, search, searchOffset, targetOffset, autoplayDetection });
  }

  /**
   * Jumps instantly to the sequence located at the specified heading(s).
   * @param headingSpecifics - An object containing the hierarchy of headings to search for.
   * @param options - An options object defining the offset of the jump and whether to consider autoplay.
   * @returns A {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} that resolves when the timeline has finished jumping.
   * 
   * @group Playback Methods
   */
  jumpToSequenceHeading(
    headingSpecifics: {h2?: string | RegExp; h3?: string | RegExp; h4?: string | RegExp; h5?: string | RegExp; h6?: string | RegExp;},
    options: {
      /** An offset that adds to the initial landing position. */
      targetOffset?: number;
      /**
       * Determines how the timeline should handle sequences set to autoplay once the
       * jump destination (after considering {@link options.targetOffset}) has been reached.
       *  * If `'none`', the timeline stays at the final landing position after the initial jumping operation.
       *  * If `'forward'`, the timeline will jump forward for as long as the next sequence is supposed to autoplay after the current sequence.
       *  * If `'backward'`, the timeline will jump backward for as long as the previous sequence is supposed to automatically
       * rewind after the current sequence is rewound (this is naturally only true when the current sequence is set to autoplay when the timeline steps forward).
       * @defaultValue
       * ```ts
       * 'none'
       * ```
       */
      autoplayDetection?: 'forward' | 'backward' | 'none';
    } = {},
  ): Promise<this> {
    const {
      targetOffset = 0,
      autoplayDetection = 'none',
    } = options;
    return this.jumpTo({ headingSpecifics, targetOffset, autoplayDetection });
  }

  // TODO: add clarification that position as a number is a 0-based index. Might even want to change that
  /**
   * Jumps instantly to the position within the timeline based on the {@link position} argument.
   * @param position - The target position within the timeline.
   * @param options - An options object defining the offset of the jump and whether to consider autoplay.
   * @returns A {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} that resolves when the timeline has finished jumping.
   * @group Playback Methods
   */
  jumpToPosition(
    position: 'beginning' | 'end' | number,
    options: {
      /** An offset that adds to the initial landing position. */
      targetOffset?: number;
      /**
       * Determines how the timeline should handle sequences set to autoplay once the
       * jump destination (after considering {@link options.targetOffset}) has been reached.
       *  * If `'none`', the timeline stays at the final landing position after the initial jumping operation.
       *  * If `'forward'`, the timeline will jump forward for as long as the next sequence is supposed to autoplay after the current sequence.
       *  * If `'backward'`, the timeline will jump backward for as long as the previous sequence as long as the previous sequence is supposed to automatically
       * rewind after the current sequence is rewound (this is naturally only true when the current sequence is set to autoplay when the timeline steps forward).
       * @defaultValue
       * ```ts
       * 'none'
       * ```
       */
      autoplayDetection?: 'forward' | 'backward' | 'none';
    } = {},
  ): Promise<this> {
    const {
      targetOffset = 0,
      autoplayDetection = 'none',
    } = options;
    return this.jumpTo({ position, targetOffset, autoplayDetection });
  }

  // immediately jumps to an AnimSequence in animSequences with the matching search arguments
  /**
   * @param options 
   * @group Playback Methods
   */
  private async jumpTo(options: {
    headingSpecifics: {h2?: string | RegExp; h3?: string | RegExp; h4?: string | RegExp; h5?: string | RegExp; h6?: string | RegExp;};
    targetOffset: number;
    autoplayDetection: 'forward' | 'backward' | 'none';
  }): Promise<this>;
  private async jumpTo(options: {
    jumpTag: string | RegExp;
    search: 'forward' | 'backward' | 'forward-from-beginning' | 'backward-from-end';
    searchOffset: number;
    targetOffset: number;
    autoplayDetection: 'forward' | 'backward' | 'none';
  }): Promise<this>;
  private async jumpTo(options: {position: 'beginning' | 'end' | number; targetOffset: number; autoplayDetection: 'forward' | 'backward' | 'none';}): Promise<this>;
  private async jumpTo(
    options: {
      targetOffset: number; autoplayDetection: 'forward' | 'backward' | 'none';
    }
    & (
      {
        jumpTag: string | RegExp;
        search?: 'forward' | 'backward' | 'forward-from-beginning' | 'backward-from-end';
        searchOffset?: number;
        position?: never;
        headingSpecifics?: never;
      }
      | {
        headingSpecifics: {h2?: string | RegExp; h3?: string | RegExp; h4?: string | RegExp; h5?: string | RegExp; h6?: string | RegExp;};
        position?: never;
        jumpTag?: never;
      }
      | {position: 'beginning' | 'end' | number; jumpTag?: never; headingSpecifics?: never;}
    ),
  ): Promise<this> {
    if (this.isAnimating) { throw new Error('Cannot use jumpTo() while currently animating.'); }
    // Calls to jumpTo() must be separated using await or something that similarly prevents simultaneous execution of code
    if (this.isJumping) { throw new Error('Cannot perform simultaneous calls to jumpTo() in timeline.'); }

    const { targetOffset, autoplayDetection, position, jumpTag, headingSpecifics } = options;

    // cannot specify multiple jump types
    if (!xor(jumpTag !== undefined, xor(position !== undefined, headingSpecifics))) {
      throw new TypeError(`jumpTo() must receive exactly one of tag, position, or headingSpecifics, not multiple. Received: ${jumpTag !== undefined ? `tag="${jumpTag}";` : ''} ${position !== undefined ? `position="${position}";` : ''}" ${headingSpecifics !== null ? `headingSpecifics="${headingSpecifics}";` : ''}.`);
    }
    // must specify at least one jump type
    if ((jumpTag === undefined) && (position === undefined) && !headingSpecifics) {
      throw new TypeError(`jumpTo() must receive a tag, position, or headingSpecifics. None were received.`);
    }
    if (!Number.isSafeInteger(targetOffset)) { throw new TypeError(`Invalid offset "${targetOffset}". Value must be an integer.`); }

    let finalTargetIndex: number;

    // find target index based on finding sequence with matching tag
    // Math.max(0) prevents wrapping
    if (jumpTag !== undefined) {
      const { search = 'forward-from-beginning', searchOffset = 0 } = options;
      if (!Number.isSafeInteger(targetOffset)) { throw new TypeError(`Invalid searchOffset "${searchOffset}". Value must be an integer.`); }
      
      let isBackwardSearch = false;
      let fromIndex: number;
      switch(search) {
        case "forward":
          fromIndex = Math.max(this.loadedSeqIndex + 1 + searchOffset, 0);
          break;
        case "backward":
          fromIndex = Math.max(this.loadedSeqIndex - 1 + searchOffset, 0);
          isBackwardSearch = true;
          break;
        case "forward-from-beginning":
          fromIndex = Math.max(searchOffset, 0);
          break;
        case "backward-from-end":
          fromIndex = Math.max(this.numSequences - 1 + searchOffset, 0);
          isBackwardSearch = true;
          break;
        default:
          throw new TypeError(`Invalid search value "${search}".`);
      }
      const sequenceMatchesTag = (sequence: AnimSequence, tag: RegExp | string): boolean => tag instanceof RegExp ? tag.test(sequence.getJumpTag()) : sequence.getJumpTag() === tag;

      let initialIndex = -1;
      // get index corresponding to matching AnimSequence
      if (!isBackwardSearch)
        { for (let i = fromIndex; i < this.numSequences; ++i) { if (sequenceMatchesTag(this.animSequences[i], jumpTag)) { initialIndex = i; break; } } }
      else
        { for (let i = fromIndex; i >= 0; --i) { if (sequenceMatchesTag(this.animSequences[i], jumpTag)) { initialIndex = i; break; } } }

      if (initialIndex === -1) { throw new Error(`Sequence tag "${jumpTag}" not found given conditions: search: ${search}; searchOffset: ${searchOffset}.`); }
      finalTargetIndex = initialIndex + targetOffset;
    }
    // find target index based on either the beginning or end of the timeline or a specific step
    else if (position !== undefined) {
      switch(true) {
        case position === "beginning":
          finalTargetIndex = 0 + targetOffset;
          break;
        case position === "end":
          finalTargetIndex = this.numSequences + targetOffset;
          break;
        case typeof position === 'number':
          if (!Number.isSafeInteger(position)) { throw new TypeError(`Invalid position "${position}". When using a number, value must be an integer.`); }
          finalTargetIndex = position;
          break;
        default: throw new RangeError(`Invalid jumpTo() position "${position}". Must be "beginning", "end", or an integer.`);
      }
    }
    // find target index based on multi-level search using headingSpecifics
    else {
      const {h2, h3, h4, h5, h6} = headingSpecifics;
      if (!(h2 || h3 || h4 || h5 || h6)) {
        throw new TypeError(`Invalid headingSpecifics. None of h2, h3, h4, h5, or h6 were specified.`);
      }
      
      // index min/max that will be narrowed down while looking for matching headings
      let searchRangeStart = 0;
      let searchRangeEnd = this.numSequences;

      let deepestLevel: `h${number}` = 'h2';
      let initialTargetIndex = -1;
      switch(true) {
        case (Boolean(h6)): deepestLevel = 'h6'; break;
        case (Boolean(h5)): deepestLevel = 'h5'; break;
        case (Boolean(h4)): deepestLevel = 'h4'; break;
        case (Boolean(h3)): deepestLevel = 'h3'; break;
        case (Boolean(h2)): deepestLevel = 'h2'; break;
      }

      const sequenceMatchesHeading = (sequence: AnimSequence, level?: keyof typeof headingSpecifics, text?: RegExp | string): boolean => {
        const seqHeadings = sequence.getHeadings();
        if (!seqHeadings) { return false; }

        // If both level and text, match on both.
        if (level && text) { return (text instanceof RegExp ? text.test(seqHeadings[level]!) : seqHeadings[level] === text); }
        // If only text, search for any heading on this sequence with matching text.
        else if (!level && text) { return Object.values(seqHeadings).some(heading => (text instanceof RegExp ? text.test(heading) : heading === text)); }
        // If only level, search for any heading on this sequence with the same level.
        else if (level && !text) { return Object.keys(seqHeadings).includes(level!); }
        else { throw new TypeError(`One of level or text needs to be specified.`); }
      };

      const narrowSearchRange = (level: keyof typeof headingSpecifics, text?: string | RegExp) => {
        if (typeof text !== 'string') { return; }
        
        for (let i = searchRangeStart; i < searchRangeEnd; ++i) {
          const currSequence = this.animSequences[i];
          if (sequenceMatchesHeading(currSequence, level, text)) {
            if (deepestLevel === level) { initialTargetIndex = i; }
            else {
              searchRangeStart = i;
              for (let j = searchRangeStart + 1; j < searchRangeEnd; ++j) {
                if (sequenceMatchesHeading(this.animSequences[j], level)) {
                  searchRangeEnd = j;
                  break;
                }
              }
            }
            break;
          }
        }
      };

      narrowSearchRange('h2', h2);
      narrowSearchRange('h3', h3);
      narrowSearchRange('h4', h4);
      narrowSearchRange('h5', h5);
      narrowSearchRange('h6', h6);

      // TODO: pretty print object
      if (initialTargetIndex === -1) { throw new Error(`Sequence heading search failed given the following conditions: headingSpecifics: ${headingSpecifics}.`); }
      finalTargetIndex = initialTargetIndex + targetOffset;
    }

    // check to see if requested target index is within timeline bounds
    {
      const errorPrefixString = `Jumping to ${jumpTag ? `tag "${jumpTag}"` : `position "${position}"`} with offset "${targetOffset}" goes`;
      const errorPostfixString = `but requested index was ${finalTargetIndex}.`;
      if (finalTargetIndex < 0)
      { throw new RangeError(`${errorPrefixString} before timeline bounds. Minimum index = 0, ${errorPostfixString}`); }
      if (finalTargetIndex > this.numSequences)
        { throw new RangeError(`${errorPrefixString} ahead of timeline bounds. Max index = ${this.numSequences}, ${errorPostfixString}`); }
    }

    this.isJumping = true;
    // if paused, then unpause to perform the jumping; then re-pause
    let wasPaused = this.isPaused;
    if (wasPaused) { this.unpause(); }
    // if skipping is not currently enabled, activate skipping button styling
    let wasSkipping = this.skippingOn;
    if (!wasSkipping) { this.playbackButtons.toggleSkippingButton?.styleActivation(); }

    // keep skipping forwards or backwards depending on direction of loadedSeqIndex

    const continueAutoplayForward = async () => {
      while (
        !this.atEnd
        && (this.animSequences[this.loadedSeqIndex - 1]?.getTiming('autoplaysNextSequence') || this.animSequences[this.loadedSeqIndex]?.getTiming('autoplays'))
      ) { await this.stepForward(); }
    }
    const continueAutoplayBackward = async () => {
      while (
        !this.atBeginning
        && (this.animSequences[this.loadedSeqIndex - 1]?.getTiming('autoplaysNextSequence') || this.animSequences[this.loadedSeqIndex]?.getTiming('autoplays'))
      ) { await this.stepBackward(); }
    }

    // play to the target sequence without playing the sequence
    if (this.loadedSeqIndex <= finalTargetIndex) {
      // Only proceed if the target sequence is NOT the current index or auto next will execute
      const sameSeq = this.loadedSeqIndex === finalTargetIndex;
      const wouldAutoNext = autoplayDetection === 'forward'
        && (
          this.animSequences[this.loadedSeqIndex].getTiming('autoplaysNextSequence')
          || this.animSequences[this.loadedSeqIndex + 1]?.getTiming('autoplays')
        );
      if (!sameSeq || wouldAutoNext) {
        this.playbackButtons.stepForwardButton?.styleActivation();
        while (this.loadedSeqIndex < finalTargetIndex) { await this.stepForward(); }
        switch(autoplayDetection) {
          // if autoplay detection forward, play as long as the loaded sequence is supposed to be autoplayed
          case "forward":
            // if the target sequence was never different but auto next is expected, we need to do the first step forward manually
            if (sameSeq && wouldAutoNext) {
              await this.stepForward();
            }
            await continueAutoplayForward();
            break;
          // if autoplay detection backward, rewind as long as the loaded sequence is supposed to be autoplayed
          case "backward":
            await continueAutoplayBackward();
            break;
          case "none": // do nothing
          default:
            break;
        }
        this.playbackButtons.stepForwardButton?.styleDeactivation();
      }
    }
    // rewind to the target sequence and rewind the sequence as well
    else {
      this.playbackButtons.stepBackwardButton?.styleActivation();
      while (this.loadedSeqIndex > finalTargetIndex) { await this.stepBackward(); }
      switch(autoplayDetection) {
        case "forward":
          await continueAutoplayForward();
          break;
        case "backward":
          await continueAutoplayBackward();
          break;
        case "none": // do nothing
        default:
          break;
      }
      this.webchalkTimelineEl?.scrollToSequence(this.animSequences[this.loadedSeqIndex], 'forward', 'start');
      this.playbackButtons.stepBackwardButton?.styleDeactivation();
    }

    if (!wasSkipping) { this.playbackButtons.toggleSkippingButton?.styleDeactivation(); }
    if (wasPaused) { this.pause(); }

    this.isJumping = false;
    return this;
  }

  /**
   * Turns on skipping if it is currently off or turns it off if it is currently on.
   * @see {@link AnimTimeline.turnSkippingOn|turnSkippingOn()}
   * @param options - An options object defining the behavior of the toggle.
   * @returns 
   * @group Playback Methods
   */
  async toggleSkipping(options: {
    /**@internal */
    viaButton?: boolean,
    /**
     * Explicitly instructs the method to either turn skipping on
     * (equivalent to {@link AnimTimeline.turnSkippingOn | turnSkippingOn()})
     * or turn skipping off (equivalent to {@link AnimTimeline.turnSkippingOff | turnSkippingOff()})
     */
    forceState?: 'on' | 'off'
  } = {}): Promise<this> {
    if (options.forceState) {
      const prevSkippingState = this.skippingOn;
      switch(options.forceState) {
        case "on": this.skippingOn = true; break;
        case "off": this.skippingOn = false; break;
        default: {
          throw this.generateError(RangeError, [`Invalid force value "${options.forceState}". Use "on" to turn on skipping or "off" to turn off skipping.`]);
        }
      }
      // if toggling did nothing, just return
      if (prevSkippingState === this.skippingOn) { return this; }
    }
    else {
      this.skippingOn = !this.skippingOn;
    }

    const viaButton = options.viaButton ?? false;
    return this.skippingOn ? this.turnSkippingOn({viaButton}) : this.turnSkippingOff({viaButton});
  }

  /**
   * Makes it so that any sequence that is played is finished instantly.
   *  * The timeline will still pause for any tasks generated by {@link AnimClip.scheduleTask}.
   * @group Playback Methods
   */
  async turnSkippingOn(): Promise<this>;
  /**@internal*/
  async turnSkippingOn(options?: { viaButton: boolean }): Promise<this>;
  async turnSkippingOn(options?: { viaButton: boolean }): Promise<this> {
    this.skippingOn = true;
    if (!options?.viaButton) { this.playbackButtons.toggleSkippingButton?.styleActivation(); }
    // if skipping is enabled in the middle of animating, force currently running AnimSequence to finish
    if (this.isAnimating && !this.isPaused) { await this.finishInProgressSequences(); }
    return this;
  }

  /**
   * Turns off the skipping effect.
   * @see {@link AnimTimeline.turnSkippingOff|turnSkippingOff()}
   * @group Playback Methods
   */
  turnSkippingOff(): this;
  /**@internal*/
  turnSkippingOff(options?: { viaButton: boolean }): this;
  turnSkippingOff(options?: { viaButton: boolean }): this {
    this.skippingOn = false;
    if (!options?.viaButton) { this.playbackButtons.toggleSkippingButton?.styleDeactivation(); }
    return this;
  }

  // tells the current AnimSequence(s) (really just 1 in this project iteration) to instantly finish its animations
  /**
   * Forces the animation sequences that are currently running within the timeline to instantly finish.
   *  * After the currently running animation sequences complete, the rest of the timeline runs normally.
   *  * The timeline will still pause for any scheduleTask generated by {@link AnimClip.scheduleTask}.
   *  * (Currently, only 1 sequence can play at a time in a timeline, so by "sequences", we just mean "sequence").
   * @group Playback Methods
   */
  async finishInProgressSequences(): Promise<this> {
    return this.doForInProgressSequences_async(sequence => sequence.finish());
  }

  // get all currently running animations that belong to this timeline and perform operation() with them
  private doForInProgressSequences(operation: SequenceOperation): this {
    for (const sequence of this.inProgressSequences.values()) {
      operation(sequence);
    }
    return this;
  }

  private async doForInProgressSequences_async(operation: AsyncSequenceOperation): Promise<this> {
    const promises: Promise<unknown>[] = [];
    for (const sequence of this.inProgressSequences.values()) {
      promises.push(operation(sequence));
    }
    await Promise.all(promises);
    return this;
  }

  /*-:**************************************************************************************************************************/
  /*-:******************************************        ERRORS        **********************************************************/
  /*-:**************************************************************************************************************************/
  protected generateError: TimelineErrorGenerator = (ErrorClassOrInstance, msg = ['<unspecified error>']) => {
    return generateError(ErrorClassOrInstance, msg as [logMessageStr: string, uiMessageFrags?: ErrorUIMessageFragments], {
      timeline: this
    });
  }

  protected generateLockedStructureError = (methodName: string) => {
    return generateError(
      CustomErrorClasses.LockedOperationError,
      [`Cannot use ${methodName}() while the timeline is in progress.`]
    );
  }
}

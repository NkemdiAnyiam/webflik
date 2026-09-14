import { AnimClip } from "./AnimationClip";
import { AnimTimeline } from "./AnimationTimeline";
import { CustomErrorClasses, errorTip, generateError, SequenceErrorGenerator, ErrorUIMessageFragments } from "../4_utils/errors";
import { getPartial, TBA_DURATION } from "../4_utils/helpers";
import { PickFromArray } from "../4_utils/utilityTypes";
import { webchalk } from "../Webchalk";
import { WebchalkSequenceElement } from "../3_components/pane-ui/WebchalkSequenceElement";

// TODO: update field descriptions
// TYPE
/**
 * An object containing configuration options used to define the timing and details of the animation sequence.
 * @category Interfaces
 * @interface
 */
export type AnimSequenceConfig = {
  /**
   * A string that is logged when debugging mode is enabled.
   * @defaultValue
   * ```ts
   * '<blank sequence description>'
   * ```
   */
  description: string;

  /**
   * An object that specifies new section headings that should start at this sequence, which will be displayed in the UI.
   * @defaultValue
   * ```ts
   * null
   * ```
   */
  headings: {
    h2?: string;
    h3?: string;
    h4?: string;
    h5?: string;
    h6?: string;
  } | null;

  /**
   * A string that can be used to identify the sequence as a jump point (like a bookmark in a document).
   * Pass it as an argument to {@link AnimTimeline.jumpToSequenceTag} to jump to the sequence.
   * @defaultValue
   * ```ts
   * ''
   * ```
   */
  jumpTag: string;

  /**
   * If `true`, the next sequence in the same timeline will automatically play after this sequence finishes.
   *  * If this sequence is not part of a timeline or is at the end of a timeline, this option has no effect.
   * @defaultValue
   * ```ts
   * false
   * ```
   */
  autoplaysNextSequence: boolean;

  /**
   * If `true`, this sequence will automatically play after the previous sequence in the same timeline finishes.
   *  * If this sequence is not part of a timeline or is at the beginning of a timeline, this option has no effect.
   * @defaultValue
   * ```ts
   * false
   * ```
   * 
   */
  autoplays: boolean;

  /**
   * The base playback rate of the sequence (ignoring any multipliers from a parent timeline).
   *  * Example: A value of `1` means 100% (the typical playback rate), and `0.5` means 50% speed.
   *  * Example: If the `playbackRate` of the parent timeline is `4` and the `playbackRate` of this sequence is `5`,
   * the `playbackRate` property is still `5`, but the sequence would run at 4 * 5 = 20x speed.
   */
  playbackRate: number;
};

// TYPE
/**
 * An object containing timing-related details about the sequence. Returned by {@link AnimSequence.getTiming}.
 * @see {@link AnimSequence.getTiming}
 * @category Interfaces
 * @interface
 */
export type AnimSequenceTiming = Pick<AnimSequenceConfig,
  | 'autoplays'
  | 'autoplaysNextSequence'
  | 'playbackRate'
> & {
  /**
   * The actual playback rate of the sequence after the playback rates of any parents are taken into account.
   *  * Example: If the `playbackRate` of the parent timeline is `4` and the `playbackRate` of this sequence is `5`,
   * the `compoundedPlaybackRate` will be 4 * 5 = 20.
   * @see {@link AnimSequenceTiming.playbackRate}
   */
  compoundedPlaybackRate: AnimSequence['compoundedPlaybackRate'];
  /**
   * The current time in milliseconds elapsed by the currently running clips within the sequence.
   * @remarks
   *  * Does not include pauses, scheduled tasks, etc.
   */
  currentTime: number;
};

// TYPE
/**
 * An object containing details about an sequence's current status. Returned by {@link AnimSequence.getStatus}.
 * @see {@link AnimSequence.getStatus}
 * @category Interfaces
 * @interface
 */
export type AnimSequenceStatus = {
  /**
   * `true` only if the sequence is in the process of playback and paused.
   */
  isPaused: boolean;

  /**
   * `true` only if the sequence is in the process of playback and unpaused.
   */
  isRunning: boolean;

  /**
   * `true` only if the sequence is in the process of playback (whether running or paused).
   */
  inProgress: boolean;

  /**
   * `true` only if a parent timeline has skipping enabled
   * (`isSkipping` is `true`) or is using a jumping method
   * (`isJumping` is `true`).
   * @see {@link AnimTimelineStatus.isSkipping}
   * @see {@link AnimTimelineStatus.isJumping}
   */
  skippingOn: boolean;
  
  /**
   * The current direction of the sequence.
   */
  direction: 'forward' | 'backward';

  /**
   * `true` only if the sequence is currently using `finish()`.
   * @see {@link AnimSequence.finish}
   */
  usingFinish: boolean;

  /**
   * `true` only if the sequence has been played or rewound at least once and is not currently in progress.
   */
  isFinished: boolean;

  /**
   * `true` only if the sequence has finished being played and not finished being rewound.
   * (if rewound at all).
   *  * Resets to `false` once the sequence has finished being rewound.
   */
  wasPlayed: boolean;

  /**
   * `true` only if the sequence has finished being rewound and not finished being played.
   *  * Resets to `false` once the sequence has finished being rewound.
   * (if played at all).
   */
  wasRewound: boolean;

  /**
   * Represents whether the sequence is currently allowed to accept changes to its structure.
   * Operations that change the sequence like {@link AnimSequence.addClips | addClips()}, {@link AnimSequence.removeClips | removeClips()},
   * etc. check whether the structure is locked before proceeding.
   *  * `true` when the sequence is in progress or in a forward finished state (the structure becomes locked and unable to
   * accept changes).
   *  * `false` after the sequence has gone back to its starting point after fully rewinding (the structure becomes unlocked
   * and allowed to accept changes).
   */
  lockedStructure: boolean;

  /**
   * `true` only if the sequence has experienced an irrecoverable error.
   */
  errored: boolean;
};

// TYPE
/**
 * An object containing basic information about the sequence and its parents & children.
 * @category Interfaces
 * @interface
 */
export type AnimSequenceHierarchy = {
  /**
   * The parent {@link AnimTimeline} that contains this sequence clip (may be `undefined`).
   * @group Structure
   */
  parentTimeline?: AnimTimeline;
  /**
   * The position of this sequence within its parent timeline (or `NaN` if there is no parent timeline).
   * @remarks
   * The first sequence in a sequence has a sequence number of `1`.
   * @group Structure
   */
  sequenceNumber: number;
  /**
   * The highest level of this sequence's lineage.
   *  * If the sequence is nested within an {@link AnimTimeline}: that timeline
   *  * Else: the sequence itself
   * @group Structure
   */
  root: AnimTimeline | AnimSequence;
  /**
   * A copy of this sequence's array of {@link AnimClip} objects.
   * @group Structure
   */
  clips: AnimClip[];
  /**
   * The number of clips in this sequence.
   * @group Structure
   */
  numClips: number;
}

// TYPE
type AnimationOperation = (animation: AnimClip) => void;
// TYPE
type AsyncAnimationOperation = (animation: AnimClip) => Promise<unknown>;

// TYPE
type FullyFinishedPromise<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
};

// TYPE
/**
 * Options specifying the location at which the clips should be inserted in {@link AnimSequence.addClips}.
 * @category hidden
 */
export type AddClipsOptions = {
  /**
   * Index at which the clips should be added.
   */
  atIndex: number;
};

// CLASS
/**
 * @hideconstructor
 * 
 * @groupDescription Property Getter Methods
 * Methods that return objects that contain various internal fields of the sequence (such as `autoplays` from `getTiming()`,
 * `inProgress` from `getStatus()`, etc.).
 * 
 * @groupDescription Property Setter Methods
 * Methods that allow the modification of various internal fields of the sequence.
 * 
 * @groupDescription Playback Methods
 * Methods that control the playback of the animation sequence.
 * 
 * @groupDescription Timing Event Methods
 * Methods that involve listening to the progress of the animation sequence to perform tasks at specific times.
 * 
 * @groupDescription Structure
 * Methods and/or fields related to the structure of the sequence, including methods related to the clips that make up
 * the sequence and what timeline the sequence belongs to (if any).
 * 
 * @groupDescription Configuration
 * Methods and/or fields related to the configuration settings of the sequence.
 */
export class AnimSequence {
  private static id = 0;

  private config: AnimSequenceConfig = {
    autoplays: false,
    autoplaysNextSequence: false,
    description: '<blank sequence description>',
    headings: null,
    playbackRate: 1,
    jumpTag: '',
  };

  /**
   * Returns an object containing the configuration options used to
   * define the timing, jump tag, and description of the animation sequence.
   * @returns An object containing
   *  * {@link AnimSequenceConfig.autoplays|autoplays},
   *  * {@link AnimSequenceConfig.autoplaysNextSequence|autoplaysNextSequence},
   *  * {@link AnimSequenceConfig.description|description},
   *  * {@link AnimSequenceConfig.playbackRate|playbackRate},
   *  * {@link AnimSequenceConfig.jumpTag|jumpTag},
   * @group Property Getter Methods
   * @group Configuration
   */
  getConfig(): AnimSequenceConfig {
    return { ...this.config };
  }
  
  /*-:**************************************************************************************************************************/
  /*-:*************************************        FIELDS & ACCESSORS        ***************************************************/
  /*-:**************************************************************************************************************************/
  /**
   * A number that uniquely identifies the sequence from other sequences.
   * Automatically generated.
   */
  readonly id: number;
  /**
   * @group Structure
   */
  /**@internal*/ _parentTimeline?: AnimTimeline; // pointer to parent AnimTimeline
  /**
   * The highest level of this sequence's lineage.
   *  * If the sequence is nested within an {@link AnimTimeline}: that timeline is the root.
   *  * Else: the sequence itself is the root.
   * @group Structure
   */
  get root(): AnimTimeline | AnimSequence { return this.parentTimeline ?? this; }
  /**
   * The parent {@link AnimTimeline} that contains this sequence
   * (`undefined` if the sequence is not part of a timeline).
   * @group Structure
   */
  get parentTimeline() { return this._parentTimeline; }
  private sequenceNumber: number = NaN;
  /** @internal */ updateSequenceNumber(trackNumber: number) {
    this.sequenceNumber = trackNumber;
    this.webchalkSequenceEl?.updateSequenceNumber(trackNumber);
  }
  animClips: AnimClip[] = []; // array of animClips TODO: make private
  /**
   * The number of clips in this sequence.
   * @group Structure
   */
  get numClips(): number { return this.animClips.length; }

  /**
   * Returns an object containing basic information about the sequence and its parents & children.
   * @returns An object containing basic information about the sequence and its parents & children.
   * @group Structure
   */
  getHierarchy(): AnimSequenceHierarchy {
    return {
      parentTimeline: this._parentTimeline,
      root: this.root,
      sequenceNumber: this.sequenceNumber,
      clips: this.animClips,
      numClips: this.animClips.length,
    };
  }

  private animClipGroupings_activeFinishOrder: AnimClip[][] = [];
  private animClipGroupings_endDelayFinishOrder: AnimClip[][] = [];
  private animClipGroupings_backwardActiveFinishOrder: AnimClip[][] = [];
  private animClip_forwardGroupings: AnimClip[][] = [[]];
  // CHANGE NOTE: AnimSequence now stores references to all in-progress clips
  private inProgressClips: Map<number, AnimClip> = new Map();
  
  private fullyFinished: FullyFinishedPromise<this> = this.getNewFullyFinished();

  /**@internal*/
  onStart: {do: Function; undo: Function;} = {
    do: () => {},
    undo: () => {},
  };
  /**@internal*/
  onFinish: {do: Function; undo: Function;} = {
    do: () => {},
    undo: () => {},
  };

  // GROUP: Status
  private isPaused = false;
  private isRunning = false;
  private usingFinish = false;
  private inProgress = false;
  private isFinished: boolean = false;
  private wasPlayed = false;
  private wasRewound = false;
  private get skippingOn() { return this._parentTimeline?.getStatus('skippingOn') || this._parentTimeline?.getStatus('isJumping') || false; }
  private get lockedStructure(): boolean {
    if (this.inProgress || this.wasPlayed) { return true; }
    return false;
  }
  private errored = false;
  /** @internal */
  setErrored() {
    this.errored = true;
    this.webchalkSequenceEl?.handleErrorState();
  }
  direction: AnimSequenceStatus['direction'] = 'forward';
  /**
   * Returns details about an sequence's current status.
   * @returns An object containing
   *  * {@link AnimSequenceStatus.inProgress|inProgress},
   *  * {@link AnimSequenceStatus.isPaused|isPaused},
   *  * {@link AnimSequenceStatus.isRunning|isRunning},
   *  * {@link AnimSequenceStatus.skippingOn|skippingOn},
   *  * {@link AnimSequenceStatus.isFinished|isFinished},
   *  * {@link AnimSequenceStatus.usingFinish|usingFinish},
   *  * {@link AnimSequenceStatus.wasPlayed|wasPlayed},
   *  * {@link AnimSequenceStatus.wasRewound|wasRewound},
   *  * {@link AnimSequenceStatus.lockedStructure|lockedStructure},
   * @group Property Getter Methods
   */
  getStatus(): AnimSequenceStatus;
  /**
   * Returns the value of a single specific property.
   * @param propName - The name of the desired property.
   * @ignore
   */
  getStatus<T extends keyof AnimSequenceStatus>(propName: T): AnimSequenceStatus[T];
  /**
   * Returns an object containing a subset of the object that would normally be returned.
   * @param propNames - An array of strings specifying which properties should be included.
   * @ignore
   */
  getStatus<T extends (keyof AnimSequenceStatus)[]>(propNames: (keyof AnimSequenceStatus)[] | T): PickFromArray<AnimSequenceStatus, T>;
  /**
   * @group Property Getter Methods
   */
  getStatus(specifics?: keyof AnimSequenceStatus | (keyof AnimSequenceStatus)[]):
    | AnimSequenceStatus
    | AnimSequenceStatus[keyof AnimSequenceStatus]
    | Partial<Pick<AnimSequenceStatus, keyof AnimSequenceStatus>>
  {
    const result: AnimSequenceStatus = {
      inProgress: this.inProgress,
      isPaused: this.isPaused,
      isRunning: this.isRunning,
      skippingOn: this.skippingOn,
      direction: this.direction,
      usingFinish: this.usingFinish,
      isFinished: this.isFinished,
      wasPlayed: this.wasPlayed,
      wasRewound: this.wasRewound,
      lockedStructure: this.lockedStructure,
      errored: this.errored,
    };

    return specifics ? getPartial(result, specifics) : result;
  }
  
  // GROUP: Timing
  /**@internal*/ usingPseudoJumpingMultiplier = false;
  /**
   * A multiplier applied to compounded playback rate to account for instances where
   * clips need an alternative to finish() because of some limitation (such as tasks).
   */
  private static pseudoJumpingPlaybackMultiplier = 100;

  protected get compoundedPlaybackRate() {
    return this.config.playbackRate * (this._parentTimeline?.getTiming().playbackRate ?? 1);
  }

  protected get currentTime(): number {
    const referenceClip = [...this.inProgressClips.values()][0];
    const currScheduleMs =  this.getStatus('direction') === 'forward'
      ? referenceClip?.fullStartTime + referenceClip?.currentTime
      : referenceClip?.fullFinishTime - referenceClip?.currentTime
    ;

    if (isNaN(currScheduleMs)) {
      return this.getStatus('wasPlayed') ? this.maxTime : 0;
    }

    return currScheduleMs;
  }

  /**
   * Equivalent to normal compounded playback rate multiplied by any additional factors.
   * Separate and used by {@link AnimClip.useCompoundedPlaybackRate} so that {@link AnimSequence.compoundedPlaybackRate}
   * can be retrieved without any hidden multipliers that the user does not need to be cognizant of.
   * @internal
   */
  get internalCompoundedPlaybackRate() {
    return this.compoundedPlaybackRate * (this.usingPseudoJumpingMultiplier ? AnimSequence.pseudoJumpingPlaybackMultiplier : 1);
  }

  /**
   * Returns timing-related details about the sequence.
   * @returns An object containing
   *  * {@link AnimSequenceTiming.autoplays|autoplays},
   *  * {@link AnimSequenceTiming.autoplaysNextSequence|autoplaysNextSequence},
   *  * {@link AnimSequenceTiming.compoundedPlaybackRate|compoundedPlaybackRate},
   *  * {@link AnimSequenceTiming.playbackRate|playbackRate},
   * @group Property Getter Methods
   */
  getTiming(): AnimSequenceTiming;
  /**
   * Returns the value of a single specific property.
   * @param propName - The name of the desired property.
   * @ignore
   */
  getTiming<T extends keyof AnimSequenceTiming>(propName: T): AnimSequenceTiming[T];
  /**
   * Returns an object containing a subset of the object that would normally be returned.
   * @param propNames - An array of strings specifying which properties should be included.
   * @ignore
   */
  getTiming<T extends (keyof AnimSequenceTiming)[]>(propNames: (keyof AnimSequenceTiming)[] | T): PickFromArray<AnimSequenceTiming, T>;
  /**
   * @group Property Getter Methods
   */
  getTiming(specifics?: keyof AnimSequenceTiming | (keyof AnimSequenceTiming)[]):
    | AnimSequenceTiming
    | AnimSequenceTiming[keyof AnimSequenceTiming]
    | Partial<Pick<AnimSequenceTiming, keyof AnimSequenceTiming>>
  {
    const config = this.config;
    const result: AnimSequenceTiming = {
      autoplays: config.autoplays,
      autoplaysNextSequence: config.autoplaysNextSequence,
      compoundedPlaybackRate: this.compoundedPlaybackRate, // / (this.pseudoJumpingEnabled ? AnimSequence.pseudoJumpingRate : 1),
      playbackRate: config.playbackRate,
      currentTime: this.currentTime,
    };

    return specifics ? getPartial(result, specifics) : result;
  }

  get maxTime(): number {
    const lastGrouping = this.animClipGroupings_endDelayFinishOrder.at(-1) ?? [];
    let maxTime = 0;
    for (let i = 0; i < lastGrouping.length; ++i) {
      const clip = lastGrouping[i];
      if (clip.getTiming('duration') === TBA_DURATION) {
        maxTime = Math.max(maxTime, clip.fullStartTime + clip.getTiming('delay') + clip.getTiming('endDelay'));
      }
      else {
        maxTime = Math.max(maxTime, clip.fullFinishTime);
      }
    }

    return maxTime;
  }

  // GROUP: Description and Jump tag
  /**
   * @returns The {@link AnimSequenceConfig.description|description} for this sequence.
   * @see {@link AnimSequenceConfig.description}
   * @group Property Getter Methods
   */
  getDescription() { return this.config.description; }

  /**
   * @returns The {@link AnimSequenceConfig.jumpTag|jumpTag} for this sequence.
   * @see {@link AnimSequenceConfig.jumpTag|jumpTag}
   * @group Property Getter Methods
   */
  getJumpTag() { return this.config.jumpTag; }

  /**
   * @returns The {@link AnimSequenceConfig.headings|headingOptions} for this sequence.
   * @see {@link AnimSequenceConfig.headings|headingOptions}
   * @group Property Getter Methods
   */
  getHeadings() { return this.config.headings ? {...this.config.headings} : null; }
  
  /**
   * Sets the {@link AnimSequenceConfig.description|description} for this sequence.
   * @param description - The new description.
   * @see {@link AnimSequenceConfig.description}
   * @group Property Setter Methods
   */
  setDescription(description: string): this {
    this.config.description = description;
    this.webchalkSequenceEl?.updateDescription(description);
    return this;
  }

  /**
   * Sets the {@link AnimSequenceConfig.jumpTag|jumpTag} for this sequence.
   * @param jumpTag - The new jump tag.
   * @see {@link AnimSequenceConfig.jumpTag}
   * @group Property Setter Methods
   */
  setJumpTag(jumpTag: string): this { this.config.jumpTag = jumpTag; return this; }

  /**
   * Sets the {@link AnimSequenceConfig.headings|headings} for this sequence (or deletes it if `null` or `{}` is provided).
   * @param headings - The new heading options.
   * @remarks
   * Setting a heading to the empty string `''` will delete it.
   * @see {@link AnimSequenceConfig.headings}
   * @group Property Setter Methods
   */
  setHeadings(headings: AnimSequenceConfig['headings']): this {
    if (!headings || (Object.keys(headings).length === 0)) { this.config.headings = null; return this; }
    
    this.config.headings = {...this.config.headings, ...headings};
    for (const key in this.config.headings) {
      if (!this.config.headings[key as keyof typeof this.config.headings]) {
        delete this.config.headings[key as keyof typeof this.config.headings];
      }
    }

    this.webchalkSequenceEl?.updateHeadings(this.config.headings);
    return this;
  }

  /*-:**************************************************************************************************************************/
  /*-:*********************************        CONSTRUCTOR & INITIALIZERS        ***********************************************/
  /*-:**************************************************************************************************************************/
  /**@internal*/
  static createInstance(config: Partial<AnimSequenceConfig> | AnimClip[] = {}, animClips?: AnimClip[]): AnimSequence {
    return new AnimSequence(config, animClips);
  }

  // constructor(config: Partial<AnimSequenceConfig>, ...animClips: AnimClip[]);
  // constructor(...animClips: AnimClip[]);
  constructor(configOrClips: Partial<AnimSequenceConfig> | AnimClip[], animClips?: AnimClip[]) {
    if (webchalk.sequenceCreatorLock) {
      throw this.generateError(TypeError, [`Illegal constructor. Sequences can only be instantiated using webchalk.newSequence().`]);
    }
    webchalk.sequenceCreatorLock = true;
    
    this.id = AnimSequence.id++;

    // If first argument is an AnimClip[], add clips to sequence.
    // Else, it must be a configuration object. Assign its values to this sequence's configuration object
    if (configOrClips instanceof Array) {
      this.addClips(configOrClips);
    }
    else {
      Object.assign<AnimSequenceConfig, Partial<AnimSequenceConfig>>(this.config, configOrClips);
      this.addClips(animClips ?? []);
    }
  }
  
  /*-:**************************************************************************************************************************/
  /*-:*************************************        STRUCTURE        ****************************************************/
  /*-:**************************************************************************************************************************/
  /**
   * Used by a parent to set pointers to itself (the parent) within the sequence.
   * @internal
   * @group Structure
   */
  setLineage(timeline: AnimTimeline): boolean {
    if (this._parentTimeline) {
      return false;
    }

    this._parentTimeline = timeline;
    for (const animClip of this.animClips) {
      animClip.setLineage('timeline', this);
    }

    return true;
  }

  /**
   * Used by a parent to remove pointers to itself (the parent) within the sequence.
   * @internal
   * @group Structure
   */
  removeLineage(): this {
    this._parentTimeline = undefined;
    this.updateSequenceNumber(NaN);
    for (const clip of this.animClips) {
      clip.removeLineage('timeline');
    }

    return this;
  }

  /**
   * Adds {@link AnimClip} objects to the end of the sequence.
   * @param animClips - An array of animation clips to add.
   * @returns 
   * @group Structure
   */
  addClips(animClips: AnimClip[]): this;
  // TODO: prevent play() and rewind() when sequence contains undefined entries (I don't think this will ever happen?)
  /**
   * Adds {@link AnimClip} objects to the specified location within the sequence.
   * @param location - An options object specifying the location at which the clips should be inserted.
   * @param animClips - The array of animation clips to add.
   * @returns 
   * @group Structure
   */
  addClips(location: AddClipsOptions, animClips: AnimClip[]): this;
  addClips(locationOrClips: AddClipsOptions | AnimClip[], animClips: AnimClip[] = []): this {
    if (this.lockedStructure) { throw this.generateLockedStructureError(this.addClips.name); }

    const [clips, loc] = (locationOrClips instanceof Array)
      ? [locationOrClips, undefined]
      : [animClips, locationOrClips];

    if (clips.length === 0) { return this; }

    for (let i = 0; i < clips.length; ++i) {
      const animClip = clips[i];
      if (!(animClip instanceof AnimClip)) {
        throw this.generateError(CustomErrorClasses.InvalidChildError, [`At least one of the objects being added is not an AnimClip.`]);
      }

      if (animClip.parentSequence) {
        // TODO: Improve error message
        throw this.generateError(CustomErrorClasses.InvalidChildError, [`At least one of the clips being added is already part of some sequence.`]);
      }
      
      if (!animClip.setLineage('sequence', this)) {
        // if setting lineage fails, undo setting lineage on previous clips attempting to be added
        for (let j = 0; j < i; ++j) {
          clips[j].removeLineage('sequence');
        }
        throw new CustomErrorClasses.InvalidChildError(`At least one of the clips being added appears in the given array multiple times.`);
      };
    }

    // insert clips
    const atIndex = loc ? loc.atIndex : this.animClips.length;
    this.animClips.splice(atIndex, 0, ...clips);
    // update the clip numbers of the new clips and any clips that are now after them in the array
    for (let i = atIndex; i < this.animClips.length; ++i) {
      this.animClips[i].updateClipNumber(i + 1);
    }
    this.webchalkSequenceEl?.insertClips(atIndex, clips);

    this.commit();

    return this;
  }

  // TODO: handle schedule updates
  /**
   * Removes the specified {@link AnimClip} objects from the sequence.
   * @param animClips - The array of animation clips to remove.
   * @returns 
   * @group Structure
   */
  removeClips(animClips: AnimClip[]): this {
    if (this.lockedStructure) { throw this.generateLockedStructureError(this.removeClips.name); }

    // sort the array of clips to remove so that we can traverse them in reverse order
    const sortedTargetClips = animClips.toSorted((a, b) => a.getHierarchy().clipNumber - b.getHierarchy().clipNumber);
    // final version of anim clips that will replace array stored in this sequence
    const finalAnimClips = [...this.animClips];
    // array of removed clips to return
    const removedClips: AnimClip[] = [];

    let lowestIndex = Infinity;

    for (let i = sortedTargetClips.length - 1; i >= 0; --i) {
      const index = this.findClipIndex(sortedTargetClips[i]);
      if (index === -1) {
        // TODO: improve error
        throw this.generateError(
          CustomErrorClasses.InvalidChildError,
          [`At least one of the clips being removed from this sequence was already not in the sequence.`]
        );
      }
      removedClips.push(...finalAnimClips.splice(index, 1));
      lowestIndex = Math.min(lowestIndex, index);
    }

    if (removedClips.length === 0) { return this; }
    
    // confirm deletion
    for (let i = 0; i < removedClips.length; ++i) {
      removedClips[i].removeLineage('sequence');
    }
    
    // update
    this.animClips = finalAnimClips;
    for (let i = lowestIndex; i < finalAnimClips.length; ++i) {
      finalAnimClips[i].updateClipNumber(i + 1);
    }
    this.webchalkSequenceEl?.removeClips(removedClips);

    this.commit();

    // TODO: return the array of removed clips
    return this;
  }
  
  /**
   * Removes a number of {@link AnimClip} objects from the sequence based on the provided indices range (0-based).
   * @param startIndex - The starting index, inclusive.
   * @param endIndex - The ending index, exclusive (if not specified, {@link startIndex} `+ 1` is used, removing one clip).
   * @returns An array containing the clips that were removed from the sequence.
   * @group Structure
   */
  removeClipsAt(startIndex: number, endIndex: number = startIndex + 1): AnimClip[] {
    if (this.lockedStructure) { throw this.generateLockedStructureError(this.removeClipsAt.name); }

    const finalAnimClips = [...this.animClips]; // replaces this.animClips at the end
    const removedClips = finalAnimClips.splice(startIndex, endIndex - startIndex);

    if (removedClips.length === 0) { return []; }

    // confirm deletion
    for (let i = 0; i < removedClips.length; ++i) {
      removedClips[i].removeLineage('sequence');
    }
    
    // update
    this.animClips = finalAnimClips;
    for (let i = Math.max(0, startIndex); i < finalAnimClips.length; ++i) {
      finalAnimClips[i].updateClipNumber(i + 1);
    }
    this.webchalkSequenceEl?.removeClips(removedClips);

    this.commit();

    return removedClips;
  }

  /**
   * Finds the index of a given {@link AnimClip} object within the sequence.
   * @param animClip - The animation clip to search for within the sequence.
   * @returns The index of {@link animClip} within the sequence, or `-1` if the clip is not part of the sequence.
   * @group Structure
   */
  findClipIndex(animClip: AnimClip): number {
    return this.animClips.findIndex((_animClip) => _animClip === animClip);
  }
  
  /*-:**************************************************************************************************************************/
  /*-:****************************************        UI METHODS        ********************************************************/
  /*-:**************************************************************************************************************************/
  /** @internal */ webchalkSequenceEl?: WebchalkSequenceElement;
  /** @internal */ get uiAttached(): boolean { return this.webchalkSequenceEl ? true : false; }
  
  /**
   * @internal
   * @group UI Methods
   */
  attachUI() {
    // TODO: improve error message
    if (this.uiAttached) { throw new Error('AnimSequence UI already attached'); }
    this.webchalkSequenceEl = new WebchalkSequenceElement();
    this.webchalkSequenceEl.animSequence = this;
  }

  /**
   * @internal
   * @group UI Methods
   */
  writeUI() {
    this.webchalkSequenceEl?.readSequence();
  }

  /**
   * @internal
   * @group UI Methods
   */
  detachUI() {
    // if (!this.uiAttached) { throw this.generateError(Error('AnimSequence UI is already not attached.')); }
    if (!this.uiAttached) { return; }
    this.webchalkSequenceEl!.remove();
    this.webchalkSequenceEl = undefined;

    for (const clip of this.animClips) {
      clip.detachUI();
    }
  }

  /*-:**************************************************************************************************************************/
  /*-:*****************************************        PLAYBACK        *********************************************************/
  /*-:**************************************************************************************************************************/
  private getNewFullyFinished(): FullyFinishedPromise<this> {
    const {resolve, promise} = Promise.withResolvers<this>();
    return {resolve, promise};
  }

  private handleFinishState(): void {
    if (this.isFinished) {
      this.isFinished = false;
      this.fullyFinished = this.getNewFullyFinished();
    }
  }

  // plays each animClip contained in this AnimSequence instance in sequential order
  /**
   * Plays the animation sequence (sequence runs forward).
   * @returns A promise that is resolved when the sequence finishes playing.
   * @group Playback Methods
   */
  async play(): Promise<this> {
    if (this.inProgress) { return this; }
    this.inProgress = true;
    this.isRunning = true;
    this.handleFinishState();
    this.direction = 'forward';

    // this.commit();

    this.onStart.do();

    const animClipGroupings_activeFinishOrder = this.animClipGroupings_activeFinishOrder;
    const indicesOfRateGroupings: number[] = [];
    // const activeGroupings2 = this.animClipGroupings_endDelayFinishOrder;
    const numGroupings = animClipGroupings_activeFinishOrder.length;

    for (let i = 0; i < numGroupings; ++i) {
      const grouping = animClipGroupings_activeFinishOrder[i];
      // TODO: probably want to reincorporate this
      // const activeGrouping2 = activeGroupings2[i];
      const groupingLength = grouping.length;

      // if (grouping.every(clip => clip.getTiming('timescaleType') === 'duration')) {
        // ensure that no clip finishes its active phase before any clip that should finish its active phase first (according to the calculated "perfect" timing)
        const noRateClips = grouping.filter(clip => clip.getTiming('timescaleType') !== 'rate');
        for (let j = 1; j < noRateClips.length; ++j) {
          noRateClips[j].addIntegrityAsyncCb('activePhase', 'end', { onPlay: () => noRateClips[j-1].scheduleIntegrityOuterResolver('forward', 'activePhase', 'end') });
          // activeGrouping2[j].animation.addIntegrityblocks('forward', 'endDelayPhase', 'end', activeGrouping2[j-1].animation.getFinished('forward', 'endDelayPhase'));
        }
      // }
      // else {
        // indicesOfRateGroupings.push(i);
      // }
    }

    let parallelClips: Promise<void>[] = [];
    this.webchalkSequenceEl?.startPlayhead('forward');
    this.webchalkSequenceEl?.togglePlayLight(true);
    for (let i = 0; i < this.animClip_forwardGroupings.length; ++i) {
      parallelClips = [];
      const grouping = this.animClip_forwardGroupings[i];
      // if any clipping within the current grouping has tasks, disable their ability to...
      // ... instantly finish
      const isUnjumpableGrouping = AnimSequence.checkUnjumpableGrouping(grouping, 'forward');
      if (isUnjumpableGrouping) {
        for (let i = 0; i < grouping.length; ++i) {
          grouping[i].disableJumpingOneTime();
          if (this.skippingOn) { this.togglePseudoJumpingRate(true); }
        }
      }
      // const isRateGrouping = indicesOfRateGroupings.includes(i);
      const firstClip = grouping[0];
      this.inProgressClips.set(firstClip.id, firstClip);
      // if (isRateGrouping) {
      //   // console.log(animClipGroupings_activeFinishOrder[i].map(clip => clip.getConfig().description));
      //   // prevents first clip from reaching end of active phase before a later-starting clip has a chance to...
      //   // ... add an integrityblock if needed (in the case when said clip ends earlier than this first block)
      //   // TODO: might need to explicitly exclude this from schedule ui
      //   firstClip.scheduleTask('activePhase', '99%', {onPlay: () => Promise.resolve()}, {frequencyLimit: 1});
      // }
      parallelClips.push(firstClip.play(this)
        .then(() => {this.inProgressClips.delete(firstClip.id)})
      );

      for (let j = 1; j < grouping.length; ++j) {
        // the start of any clip within a grouping should line up with the beginning of the preceding clip's active phase
        // (akin to PowerPoint timing)
        await grouping[j-1].scheduleIntegrityOuterResolver('forward', 'activePhase', 'beginning');
        const currAnimClip = grouping[j];
        this.inProgressClips.set(currAnimClip.id, currAnimClip);
        parallelClips.push(currAnimClip.play(this)
          .then(() => {this.inProgressClips.delete(currAnimClip.id)})
        );
      }

      // if (isRateGrouping) {
      //   this.commitForRate(i);
      //   console.log(animClipGroupings_activeFinishOrder[i].map(clip => clip.getConfig().description));
      //   // ensure that no clip finishes its active phase before any clip that should finish its active phase first (according to the calculated "perfect" timing)
      //   // TODO: probably don't look at grouping? Use a newly sorted array? No, this sentence doesn't make sense.
      //   for (let j = 1; j < grouping.length; ++j) {
      //     console.log(animClipGroupings_activeFinishOrder[i][j].getConfig().description, animClipGroupings_activeFinishOrder[i][j-1].getConfig().description);
      //     animClipGroupings_activeFinishOrder[i][j].addIntegrityblock('activePhase', 'end', { onPlay: () => animClipGroupings_activeFinishOrder[i][j-1].scheduleResolver('forward', 'activePhase', 'end') });
      //     // activeGrouping2[j].animation.addIntegrityblocks('forward', 'endDelayPhase', 'end', activeGrouping2[j-1].animation.getFinished('forward', 'endDelayPhase'));
      //   }
      // }

      await Promise.all(parallelClips);
      if (isUnjumpableGrouping) { this.togglePseudoJumpingRate(false); }
    }
    this.webchalkSequenceEl?.stopPlayhead(this.maxTime);
    this.webchalkSequenceEl?.togglePlayLight(false);

    this.inProgress = false;
    this.isRunning = false;
    this.isFinished = true;
    this.wasPlayed = true;
    this.wasRewound = false;
    this.usingFinish = false;
    this.fullyFinished.resolve(this);
    this.onFinish.do();
    this.webchalkSequenceEl?.toggleDarkenSchedule(true);
    return this;
  }

  // rewinds each animClip contained in this AnimSequence instance in reverse order
  /**
   * Rewinds the animation sequence (sequence runs backward).
   * @returns A promise that is resolved when the sequence finishes rewinding.
   * @group Playback Methods
   */
  async rewind(): Promise<this> {
    if (this.inProgress) { return this; }
    this.direction = 'backward';
    this.webchalkSequenceEl?.toggleDarkenSchedule(false);
    this.webchalkSequenceEl?.togglePlayLight(true);
    this.inProgress = true;
    this.isRunning = true;
    this.handleFinishState();


    const animClipGroupings_backwardActiveFinishOrder = this.animClipGroupings_backwardActiveFinishOrder;
    const numGroupings = animClipGroupings_backwardActiveFinishOrder.length;

    this.onFinish.undo();

    for (let i = 0; i < numGroupings; ++i) {
      const grouping = animClipGroupings_backwardActiveFinishOrder[i];
      const groupingLength = grouping.length;

      // ensure that no clip finishes rewinding its active phase before any clip that should finishing doing so first (according to the calculated "perfect" timing)
      for (let j = 1; j < groupingLength; ++j) {
        grouping[j].addIntegrityAsyncCb('activePhase', 'beginning', { onRewind: () => grouping[j-1].scheduleIntegrityOuterResolver('backward', 'activePhase', 'beginning') });
      }
    }
    
    let parallelClips: Promise<void>[] = [];
    const groupings = this.animClipGroupings_endDelayFinishOrder;
    const groupingsLength = groupings.length;
    
    this.webchalkSequenceEl?.startPlayhead('backward');
    for (let i = groupingsLength - 1; i >= 0; --i) {
      parallelClips = [];
      const grouping = groupings[i];
      const isUnjumpableGrouping = AnimSequence.checkUnjumpableGrouping(grouping, 'backward'); 
      if (isUnjumpableGrouping) {
        for (let i = 0; i < grouping.length; ++i) {
          grouping[i].disableJumpingOneTime();
          if (this.skippingOn) { this.togglePseudoJumpingRate(true); }
        }
      }
      const groupingLength = grouping.length;
      const lastClip = grouping[groupingLength - 1];
      this.inProgressClips.set(lastClip.id, lastClip);
      parallelClips.push(lastClip.rewind(this)
        .then(() => {this.inProgressClips.delete(lastClip.id)})
      );

      for (let j = groupingLength - 2; j >= 0; --j) {
        const currAnimClip = grouping[j];
        // Traverse back up the grouping until finding a clip that the current clip intersects with (one MUST exist).
        // Upon finding such a clip, wait for that intersection time and then rewind the current clip.
        for (let k = j + 1; k < groupingLength; ++k) {
          let intersectingClip = grouping[k];
          if (currAnimClip.fullFinishTime >= intersectingClip.fullStartTime) {
            await intersectingClip.scheduleIntegrityOuterResolver('backward', 'whole', currAnimClip.fullFinishTime - intersectingClip.fullStartTime);
            break;
          }
        }

        // once waiting period above is over, begin rewinding current clip
        this.inProgressClips.set(currAnimClip.id, currAnimClip);
        parallelClips.push(currAnimClip.rewind(this)
          .then(() => {this.inProgressClips.delete(currAnimClip.id)})
        );
      }
      await Promise.all(parallelClips);
      if (isUnjumpableGrouping) { this.togglePseudoJumpingRate(false); }
    }
    this.webchalkSequenceEl?.togglePlayLight(false);
    this.webchalkSequenceEl?.stopPlayhead(0);

    this.inProgress = false;
    this.isRunning = false;
    this.isFinished = true;
    this.wasPlayed = false;
    this.wasRewound = true;
    this.usingFinish = false;
    this.fullyFinished.resolve(this);
    this.onStart.undo();
    return this;
  }

  private static checkUnjumpableGrouping(grouping: AnimClip[], direction: 'forward' | 'backward'): boolean {
    return grouping.some(clip => clip.hasTaskParts(direction) || clip.hasPromises(direction));
  }

  /**
   * Determines whether to multiply the compounded playback rate by a special multiplier.
   * @param state - `true` or `false` depending on whether multiplier should be applied.
   * @returns 
   */
  private togglePseudoJumpingRate(state: boolean): void {
    // if no change, do nothing
    if (this.usingPseudoJumpingMultiplier === (this.usingPseudoJumpingMultiplier = state)) { return; }
    this.useCompoundedPlaybackRate();
  }
  
  /**
   * Pauses the animation sequence.
   *  * If the sequence is not already in progress, this method does nothing.
   * @group Playback Methods
   */
  pause(): this {
    if (!this.isRunning) { return this; }
    this.isRunning = false;
    this.isPaused = true;
    this.doForInProgressClips(animClip => animClip.pause(this));
    return this;
  }

  /**
   * Unpauses the animation sequence.
   *  * If the sequence is not currently paused, this method does nothing.
   * @group Playback Methods
   */
  unpause(): this {
    if (!this.isPaused) { return this; }
    this.isRunning = true;
    this.isPaused = false;
    this.doForInProgressClips(animClip => animClip.unpause(this));
    return this;
  }

  // TODO: check to see if it's necessary to prevent direct finish() calls if sequence has a parent timeline
  /**
   * Forces the animation sequence to instantly finish.
   *  * This works even if the animation sequence is not already currently in progress.
   *  * The sequence will still pause for any tasks generated by {@link AnimClip.scheduleTask}.
   *  * Does not work if the sequence is currently paused.
   * @group Playback Methods
   */
  async finish(): Promise<this> {
    if (this.usingFinish || this.isPaused) { return this; }
    this.usingFinish = true; // resets to false at the end of play() and rewind()

    this.togglePseudoJumpingRate(true);
    // if in progress, finish the current clips and let the proceeding ones read from this.usingFinish
    if (this.inProgress) { this.finishInProgressAnimations(); }
    // else, if this sequence is ready to play forward, just play (then all clips will read from this.usingFinish)
    else if (!this.wasPlayed || this.wasRewound) { this.play(); }
    // If sequence is at the end of its playback, finish() does nothing.
    // AnimTimeline calling AnimSequence.finish() in its method for finishing current sequences should still work
    // because that method is only called when sequences are already playing (so it hits the first if-statement)
    
    await this.fullyFinished.promise;
    this.togglePseudoJumpingRate(false);
    return this;
  }

  // used to skip currently running animation so they don't run at regular speed while using finish()
  /**
   * Forces the animation clips that are currently running within the sequence to instantly finish.
   *  * After the currently running animation clips complete, the rest of the sequence runs normally.
   *  * The sequence will still pause for any tasks generated by {@link AnimClip.scheduleTask}.
   * @group Playback Methods
   */
  async finishInProgressAnimations(): Promise<this> {
    return this.doForInProgressClips_async(animClip => animClip.finish(this));
  }

  /**
   * Sets the base playback rate of the sequence.
   * @param newRate - The new playback rate.
   * @group Playback Methods
   */
  updatePlaybackRate(newRate: number): this {
    this.config.playbackRate = newRate;
    this.useCompoundedPlaybackRate();
    return this;
  }

  /**
   * Multiplies playback rate of parent timeline (if exists) with base playback rate.
   * @group Playback Methods
   * @internal
   */
  useCompoundedPlaybackRate(): this {
    this.doForInProgressClips(animClip => animClip.useCompoundedPlaybackRate());
    return this;
  }

  private static activeBackwardFinishComparator = (clipA: AnimClip, clipB: AnimClip) => clipB.activeStartTime - clipA.activeStartTime;
  private static activeFinishComparator = (clipA: AnimClip, clipB: AnimClip) => clipA.activeFinishTime - clipB.activeFinishTime;
  private static endDelayFinishComparator = (clipA: AnimClip, clipB: AnimClip) => clipA.fullFinishTime - clipB.fullFinishTime;

  // TODO: Complete this method
  private commit(): this {
    const {
      activeBackwardFinishComparator,
      activeFinishComparator,
      endDelayFinishComparator,
    } = AnimSequence;

    let maxFinishTime = 0;
    const animClips = this.animClips;
    const numClips = animClips.length;
    this.animClip_forwardGroupings = [[]];
    this.animClipGroupings_backwardActiveFinishOrder = [];
    this.animClipGroupings_activeFinishOrder = [];
    this.animClipGroupings_endDelayFinishOrder = [];
    let currActiveBackwardFinishGrouping: AnimClip[] = [];
    let currActiveFinishGrouping: AnimClip[] = [];
    let currEndDelayGrouping: AnimClip[] = [];

    // let currTimeScaleType: 'duration' | 'rate' = animClips[0].getTiming('timescaleType');

    for (let i = 0; i < numClips; ++i) {
      const currAnimClip = animClips[i];
      const prevClip = animClips[i-1];
      const startsWithPrev = currAnimClip.getTiming('startsWithPrevious') || prevClip?.getTiming('startsNextClipToo');
      let currFullStartTime: number = 0;

      // the current clip is in a grouping of parallel clips or the first clip in the sequence
      if (startsWithPrev || i === 0) {
        // currActiveBackwardFinishGrouping.push(currAnimClip);
        currActiveFinishGrouping.push(currAnimClip);
        currEndDelayGrouping.push(currAnimClip);
        
        // if (currTimeScaleType === 'duration') {
        currFullStartTime = prevClip?.activeStartTime ?? 0;
        // }
      }
      // the current clip is starting a new grouping of parallel clips
      else {
        // sort and push current groupings
        // currTimeScaleType = currAnimClip.getTiming('timescaleType');
        currActiveFinishGrouping.sort(activeFinishComparator);
        currEndDelayGrouping.sort(endDelayFinishComparator);
        currActiveBackwardFinishGrouping = [...currEndDelayGrouping].reverse();
        currActiveBackwardFinishGrouping.sort(activeBackwardFinishComparator);
        this.animClipGroupings_backwardActiveFinishOrder.push(currActiveBackwardFinishGrouping);
        this.animClipGroupings_activeFinishOrder.push(currActiveFinishGrouping);
        this.animClipGroupings_endDelayFinishOrder.push(currEndDelayGrouping);

        // create new groupings
        this.animClip_forwardGroupings.push([]);
        currActiveBackwardFinishGrouping = [currAnimClip];
        currActiveFinishGrouping = [currAnimClip];
        currEndDelayGrouping = [currAnimClip];

        currFullStartTime = maxFinishTime;
        // currFullStartTime = prevClip.fullFinishTime;
      }

      this.animClip_forwardGroupings[this.animClip_forwardGroupings.length - 1].push(currAnimClip);

      currAnimClip.updateFullStartTime(currFullStartTime);

      const timeScaleType = currAnimClip.getTiming('timescaleType');
      if (timeScaleType === 'duration') {
        maxFinishTime = Math.max(currAnimClip.fullFinishTime, maxFinishTime);
      }
      else {
        maxFinishTime = Math.max(
          currAnimClip.fullStartTime + currAnimClip.getTiming('delay') + currAnimClip.getTiming('endDelay'),
          maxFinishTime
        )
      }
    }

    currActiveFinishGrouping.sort(activeFinishComparator);
    currEndDelayGrouping.sort(endDelayFinishComparator);
    currActiveBackwardFinishGrouping = [...currEndDelayGrouping].reverse();
    currActiveBackwardFinishGrouping.sort(activeBackwardFinishComparator);
    this.animClipGroupings_backwardActiveFinishOrder.push(currActiveBackwardFinishGrouping);
    this.animClipGroupings_activeFinishOrder.push(currActiveFinishGrouping);
    this.animClipGroupings_endDelayFinishOrder.push(currEndDelayGrouping);

    this.webchalkSequenceEl?.updateMaxSecondsDisplayed(this.maxTime / 1000);
    this.webchalkSequenceEl?.updateEmptyTimeFillWidth();

    return this;
  }

  /** @internal */
  commitForRate(clip: AnimClip): void {
    const {
      activeBackwardFinishComparator,
      activeFinishComparator,
      endDelayFinishComparator,
    } = AnimSequence;

    // Find index of grouping containing clip
    let indexOfGrouping = -1;
    loop1:
    for (let i = 0; i < this.animClip_forwardGroupings.length; ++i) {
      const grouping = this.animClip_forwardGroupings[i];
      for (let j = 0; j < grouping.length; ++j) {
        if (grouping[j] === clip) {
          indexOfGrouping = i;
          break loop1;
        }
      }
    }
    const currEndDelayGrouping: AnimClip[] = this.animClipGroupings_endDelayFinishOrder[indexOfGrouping];

    // Active finish times, end delay times, and backward finish times may now be different, so they must be re-sorted.
    this.animClipGroupings_activeFinishOrder[indexOfGrouping].sort(activeFinishComparator);
    currEndDelayGrouping.sort(endDelayFinishComparator);
    const currActiveBackwardFinishGrouping = [...currEndDelayGrouping].reverse();
    currActiveBackwardFinishGrouping.sort(activeBackwardFinishComparator);
    this.animClipGroupings_backwardActiveFinishOrder[indexOfGrouping] = currActiveBackwardFinishGrouping;

    // If there are more groupings after this one, they will be affected by any change in the...
    // ... maximum finish time of the current grouping.
    const nextForwardGrouping = this.animClip_forwardGroupings[indexOfGrouping + 1];
    if (nextForwardGrouping) {
      // Compute the new max finish time of current group resulting from the change to clip's duration.
      const oldMaxFinishTime = nextForwardGrouping[0].fullStartTime;
      let newMaxFinishTime = clip.getTiming('duration') === TBA_DURATION
        ? clip.fullStartTime + clip.getTiming('delay') + clip.getTiming('endDelay')
        : clip.fullFinishTime;
      const currEndDelayGrouping: AnimClip[] = this.animClipGroupings_endDelayFinishOrder[indexOfGrouping];
      for (let i = 0; i < currEndDelayGrouping.length; ++i) {
        const currClip = currEndDelayGrouping[i];
        if (currClip.getTiming('timescaleType') === 'rate' && currClip.getTiming('duration') === TBA_DURATION) { continue; }
        if (currClip === clip) { continue; }
        newMaxFinishTime = Math.max(newMaxFinishTime, currClip.fullFinishTime);
      }

      // If maximum finish time within the grouping changed, update start times of clips in upcoming groupings.
      const deltaMaxFinishTime = newMaxFinishTime - oldMaxFinishTime;
      if (deltaMaxFinishTime !== 0) {
        for (let i = indexOfGrouping + 1; i < this.animClip_forwardGroupings.length; ++i) {
          const futureGrouping = this.animClip_forwardGroupings[i];
          for (let j = 0; j < futureGrouping.length; ++j) {
            const futureClip = futureGrouping[j];
            futureClip.updateFullStartTime(futureClip.fullStartTime + deltaMaxFinishTime);
          }
        }
      }
    }

    this.webchalkSequenceEl?.updateMaxSecondsDisplayed(this.maxTime / 1000);
    this.webchalkSequenceEl?.updateEmptyTimeFillWidth();
  }

  // get all currently running animations that belong to this timeline and perform operation() with them
  private doForInProgressClips(operation: AnimationOperation): this {
    for (const animClip of this.inProgressClips.values()) {
      operation(animClip);
    }
    return this;
  }

  private async doForInProgressClips_async(operation: AsyncAnimationOperation): Promise<this> {
    const promises: Promise<unknown>[] = [];
    for (const animClip of this.inProgressClips.values()) {
      promises.push(operation(animClip));
    }
    await Promise.all(promises);
    return this;
  }

  /*-:**************************************************************************************************************************/
  /*-:************************************        TIMING EVENT METHODS        **************************************************/
  /*-:**************************************************************************************************************************/
  // TODO: Write documentation
  /**
   * 
   * @param functions 
   * @returns 
   * @group Timing Event Methods
   */
  setOnStart(functions: {do: Function, undo: Function}): this {
    this.onStart.do = functions.do;
    this.onStart.undo = functions.undo;
    return this;
  }

  /**
   * 
   * @param functions 
   * @returns 
   * @group Timing Event Methods
   */
  setOnFinish(functions: {do: Function, undo: Function}): this { 
    this.onFinish.do = functions.do;
    this.onFinish.undo = functions.undo;
    return this;
  }

  /*-:**************************************************************************************************************************/
  /*-:******************************************        ERRORS        **********************************************************/
  /*-:**************************************************************************************************************************/
  protected generateError: SequenceErrorGenerator = (ErrorClassOrInstance, msg = ['<unspecified error>']) => {
    return generateError(ErrorClassOrInstance, msg as [logMessageStr: string, uiMessageFrags?: ErrorUIMessageFragments], {
      sequence: this,
      timeline: this._parentTimeline
    });
  }

  // TODO: figure out why this doesn't return this.generateError()
  protected generateLockedStructureError = (methodName: string) => {
    return generateError(
      CustomErrorClasses.LockedOperationError,
      [`Cannot use ${methodName}() while the sequence is in progress or in a forward finished state.`
      + errorTip(
        `Tip: Generally, changes cannot be made to the structure of a sequence once it has left its starting point.`
        + ` This is to preserve continuity (once a sequence moves forward, it is locked in history until it is completely rewound).`
      )]
    );
  }
}

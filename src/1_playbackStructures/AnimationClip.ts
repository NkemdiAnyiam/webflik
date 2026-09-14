import { AnimSequence } from "./AnimationSequence";
import { AnimTimeline } from "./AnimationTimeline";
import { EntranceClip, MotionClip, TransitionClip } from "./AnimationClipCategories";
import { webchalk, Webchalk } from "../Webchalk";
import { EffectOptions, PresetEffectBank, PresetEffectDefinition, EffectFrameGeneratorSet } from "../2_animationEffects/presetEffectCreation";
import { call, deepComparison, detab, getPartial, mergeArrays, TBA_DURATION, xor } from "../4_utils/helpers";
import { EasingString, useEasing } from "../2_animationEffects/easing";
import { CustomErrorClasses, ClipErrorGenerator, errorTip, generateError, ErrorUIMessageFragments } from "../4_utils/errors";
import { DOMElement, EffectCategory, Mutator, StyleProperty } from "../4_utils/interfaces";
import { WebchalkConnectorElement } from "../3_components/WebchalkConnectorElement";
import { WebchalkAnimation, NestedWebchalkAnimation } from "./WebchalkAnimation";
import { PartialPick, PickFromArray, WithRequired } from "../4_utils/utilityTypes";
import { WebchalkClipElement } from "../3_components/pane-ui/WebchalkClipElement";

// /**
//  * Spreads {@link objOrIterable} whether it is an array of keyframes
//  * or an object of property-indexed keyframes
//  * @param objOrIterable - an array of keyframes or property-indexed keyframes
//  * @returns The result of spreading {@link objOrIterable} into a new object or array.
//  */
// function spreadKeyframes(objOrIterable: Keyframes): Keyframes {
//   if (Symbol.iterator in objOrIterable) { return [...objOrIterable]; }
//   else { return {...objOrIterable}; }
// }

// TYPE
/**
 * An object containing configuration options that determine what CSS classes should be added or removed
 * from the target element when the clip is played or rewound.
 * 
 * @category Subtypes
 */
export type CssClassOptions = {
  /**
   * An array of CSS classes to add to the element when the clip finishes playing.
   */
  toAddOnFinish: string[];

  /**
   * An array of CSS classes to add to the element when the clip starts playing.
   */
  toAddOnStart: string[];

  /**
   * An array of CSS classes to remove from the element when the clip finishes playing.
   */
  toRemoveOnFinish: string[];

  /**
   * An array of CSS classes to remove from the element when the clip starts playing.
   */
  toRemoveOnStart: string[];
};

// TYPE
type CustomKeyframeEffectOptions = {
  /**
   * If `true`, the next clip in the same sequence will play at the same time as this clip.
   *  * If this clip is not part of a sequence or is at the end of a sequence, this option has no effect.
   */
  startsNextClipToo: boolean;

  /**
   * If `true`, this clip will play at the same time as the previous clip in the same sequence.
   *  * If this clip is not part of a sequence or is at the beginning of a sequence, this option has no effect.
   */
  startsWithPrevious: boolean;

  // TODO: figure out best way to handle commitStyles behavior regarding effects that
  // don't actually need to use commitStyles()
  /**
   * Determines whether the effects of the animation will persist after the clip finishes.
   *  * If `false`, the effects of the animation will not persist after the clip finishes.
   *  * If `true`, the effects will attempt to be committed. If the element is not rendered by the
   * time the clip finishes because of the CSS class "webchalk-display-none", the clip will try to forcefully apply the styles by
   * instantly unhiding the element, committing the animation styles, then re-hiding the element (necessary because JavaScript
   * does not allow animation results to be saved to unrendered elements).
   *    * If the element is unrendered for any reason other than having the "webchalk-display-none" class by the time the clip finishes,
   * then this will fail, and an error will be thrown.
   */
  commitsStyles: false | true;

  /**
   * Resolves how the element's animation impacts the element's underlying property values.
   * @see [KeyframeEffect: composite property](https://developer.mozilla.org/en-US/docs/Web/API/KeyframeEffect/composite)
   */
  composite: CompositeOperation;

  /**
   * An object containing arrays of CSS classes that should be added to or removed from the element.
   *  * The array of classes to add is added first, and then the array of classes to remove is removed.
   *  * Changes are automatically undone in the appropriate order when the clip is rewound.
   */
  cssClasses: Partial<CssClassOptions>;
};

// TYPE
type KeyframeTimingOptions = {
  /**
   * The number of milliseconds the active phase of the animation takes to complete.
   *  * This refers to the actual effect of the animation, not the delay or endDelay.
   */
  duration: number;

  /**
   * The rate of the animation's change over time.
   *  * Accepts a typical `<easing-function>`, such as `"linear"`, `"ease-in"`, `"step-end"`, `"cubic-bezier(0.42, 0, 0.58, 1)"`, etc.
   *  * Also accepts autocompleted preset strings (such as `"bounce-in"`, `"power-1-out"`, etc.)
   * that produce preset easing effects using linear functions.
   */
  easing: EasingString;

  /**
   * The base playback rate of the animation (ignoring any multipliers from a parent sequence/timeline).
   *  * Example: A value of `1` means 100% (the typical playback rate), and `0.5` means 50% speed.
   *  * Example: If the `playbackRate` of the parent sequence is `4` and the `playbackRate` of this clip is `5`,
   * the `playbackRate` property is still `5`, but the clip would run at 4 * 5 = 20x speed.
   */
  playbackRate: number;

  /**
   * The number of milliseconds the delay phase of the animation takes to complete.
   *  * This refers to the time before the active phase of the animation starts (i.e., before the animation effect begins).
   */
  delay: number;

  /**
   * The number of milliseconds the endDelay phase of the animation takes to complete.
   *  * This refers to the time after the active phase of the animation end (i.e., after the animation effect has finished).
   */
  endDelay: number;
};

// TYPE
/**
 * An object containing configuration options used to define both the timing and effects of the animation clip.
 * Used as the last argument in most clip factory functions created by {@link Webchalk.createAnimationClipFactories}.
 * Returned by {@link AnimClip.getConfig}.
 * @see {@link AnimClip.getConfig}.
 * 
 * @category Interfaces
 * @interface
 */
export type AnimClipConfig = KeyframeTimingOptions & CustomKeyframeEffectOptions & {
  /**
   * A string that is displayed in the UI if the timeline pane UI is opened and logged to the console if debugging mode is enabled.
   * @defaultValue
   * ```ts
   * '<blank sequence description>'
   * ```
   */
  description: string;
};

// TYPE
/**
 * An object containing timing-related details about an animation.
 * Returned by {@link AnimClip.getTiming}.
 * @see {@link AnimClip.getTiming}
 * @category Interfaces
 * @interface
 */
export type AnimClipTiming = Pick<AnimClip['config'], 
  | 'startsNextClipToo'
  | 'startsWithPrevious'
  | 'duration'
  | 'delay'
  | 'endDelay'
  | 'easing'
  | 'playbackRate'
> & {
  /**
   * The actual playback rate of the animation after the playback rates of any parents are taken into account.
   *  * Example: If the `playbackRate` of the parent sequence is `4` and the `playbackRate` of this clip is `5`,
   * the `compoundedPlaybackRate` will be 4 * 5 = 20.
   * @see {@link AnimClipTiming.playbackRate}
   */
  compoundedPlaybackRate: AnimClip['compoundedPlaybackRate'];
  /**
   * The type of timescale the animation clip uses to measure the length of the animation.
   *  * `"duration"` indicates that the animation length follows a fixed amount of time.
   *  * `"rate"` indicates that the animation length depends on some variable change.
   */
  timescaleType: AnimClip['timescaleType'];
};

// TYPE
/**
 * An object containing specific details about an animation's effect.
 * Returned by {@link AnimClip.getEffectDetails}.
 * @see {@link AnimClip.getEffectDetails}
 * @category Interfaces
 * @interface
 */
export type AnimClipEffectDetails = {
  /**
   * The name of the animation effect.
   */
  effectName: AnimClip['effectName'];

  /**
   * The object containing both the function used to build the effect frame generators and
   * possibly a set of default configuration options for the effect.
   */
  presetEffectDefinition: AnimClip['presetEffectDefinition'];

  /**
   * The array containing the effect options used to set the behavior of the animation effect.
   */
  effectOptions: AnimClip['effectOptions'];

  /**
   * The category of the effect (e.g., `"Entrance"`, `"Exit"`, `"Motion"`, etc.).
   */
  category: AnimClip['category'];
};

// TYPE
/**
 * An object containing details about how the DOM element is modified beyond just the effect of the animation (such as modifying CSS classes).
 * Returned by {@link AnimClip.getModifiers}.
 * @see {@link AnimClip.getModifiers}
 * @category Interfaces
 * @interface
 */
export type AnimClipModifiers = Pick<AnimClipConfig, 'cssClasses' | 'composite' | 'commitsStyles'>;

// TYPE
/**
 * An object containing details about an animation's current status.
 * Returned by {@link AnimClip.getStatus}.
 * @see {@link AnimClip.getStatus}
 * @category Interfaces
 * @interface
 */
export type AnimClipStatus = {
  /**
   * `true` only if the clip is in the process of playback (whether running or paused).
   */
  inProgress: boolean;

  /**
   * `true` only if the clip is in the process of playback and unpaused.
   */
  isRunning: boolean;
  
  /**
   * `true` only if the clip is in the process of playback and paused.
   */
  isPaused: boolean;

  /**
   * The current direction of the animation.
   */
  direction: 'forward' | 'backward';

  /**
   * `true` only if the clip has experienced an irrecoverable error.
   */
  errored: boolean;
};

// TYPE
/**
 * An object containing basic information about the clip and its parents.
 * @category Interfaces
 * @interface
 */
export type AnimClipHierarchy = {
  /**
   * The parent {@link AnimSequence} that contains this clip
   * (`undefined` if the clip is not part of a sequence).
   * @group Structure
   */
  parentSequence?: AnimSequence;
  /**
   * The parent {@link AnimTimeline} that contains the {@link AnimSequence} that contains this clip (may be `undefined`).
   * @group Structure
   */
  parentTimeline?: AnimTimeline;
  /**
   * The position of this clip within its parent sequence (or `NaN` if there is no parent sequence).
   * @remarks
   * The first clip in a sequence has a clip number of `1`.
   * @group Structure
   */
  clipNumber: number;
  /**
   * The highest level of this clip's lineage.
   *  * If the clip is nested within an {@link AnimTimeline}: that timeline,
   *  * Else, if the clip is within an {@link AnimSequence}: that sequence,
   *  * Else: the clip itself
   * @group Structure
   */
  root: AnimTimeline | AnimSequence | AnimClip;
}

// TYPE
/**
 * An object that contains functions that will be called at
 * a certain time during an {@link AnimClip}'s playback.
 * Used in {@link AnimClip.scheduleTask}.
 * 
 * @category Subtypes
 */
export type ScheduledTask = {
  /** A function that will be called at the specified time when the clip is playing. */
  onPlay?: Function;
  /** A function that will be called at the specified time when the clip is rewinding. */
  onRewind?: Function;
};

// TYPE
/**
 * A {@link Promise} that contains an `id` field.
 * Used in {@link AnimClip.scheduleResolver}.
 * 
 * @category Subtypes
 */
export class PromiseWithId<T> extends Promise<T> {
  id: string = '';
};


// CLASS
/**
 * <!-- EX:S id="AnimClip.desc" code-type="comment-block" -->
 * A "clip" is the smallest building block of a timeline. It is essentially a [DOM element, effect] pair,
 * where a "DOM element" is some HTML element on the page and the effect is the animation effect that
 * will be applied to it (asynchronously).
 * 
 * The {@link AnimClip} class is abstract, meaning it cannot be instantiated. But it has several subclasses such as 
 * {@link EntranceClip}, {@link MotionClip}, {@link TransitionClip}, etc. Webchalk provides convenient factory functions
 * that can be used to create such clips—the factory functions can be obtained from {@link Webchalk.createAnimationClipFactories}.
 * Examples are shown below.
 * 
 * Generally (with some exceptions), using a clip factory function follows this format:
 * `const clip = <factory func>(<some element>, <effect name>, [<effect options>], {<optional clip configuration>});`
 * <!-- EX:E id="AnimClip.desc" -->
 * 
 * @example
 * <!-- EX:S id="AnimClip.class" code-type="ts" -->
 * ```ts
 * // retrieve the clip factory functions
 * const clipFactories = webchalk.createAnimationClipFactories();
 * 
 * // select an element from the DOM
 * const square = document.querySelector('.square');
 * 
 * // A = element, B = effect name, C = effect options, D = configuration (optional)
 * 
 * // create 3 animation clips using the clip factory functions Entrance(), Motion(), and Emphasis()
 * //                                     A       B           C
 * const entClip = clipFactories.Entrance(square, '~fade-in', []);
 * //                                   A       B             C
 * const motClip = clipFactories.Motion(square, '~translate', [{translate: '500px 0px', selfOffset: '50% 50%'}]);
 * //                                     A       B             C        D
 * const empClip = clipFactories.Emphasis(square, '~highlight', ['red'], {duration: 2000, easing: 'ease-in'});
 * 
 * (async () => {
 *   // play the clips one at a time
 *   await entClip.play();
 *   await motClip.play();
 *   await empClip.play();
 *   // rewind the clips one at a time
 *   await empClip.rewind();
 *   await motClip.rewind();
 *   await entClip.rewind();
 * })();
 * ```
 * <!-- EX:E id="AnimClip.class" -->
 * 
 * @hideconstructor
 * 
 * @groupDescription Property Getter Methods
 * Methods that return objects that contain various internal fields of the clip (such as `duration` from `getTiming()`,
 * `inProgress` from `getStatus()`, etc.).
 * 
 * @groupDescription Playback Methods
 * Methods that control the playback of the animation clip.
 * 
 * @groupDescription Timing Event Methods
 * Methods that involve listening to the progress of the animation clip to perform tasks at specific times.
 * 
 * @groupDescription Structure
 * Methods and/or fields related to the structure of the clip, including the element it targets
 * and any parent structures it belongs to.
 * 
 * @groupDescription Configuration
 * Methods and/or fields related to the configuration settings of the clip,
 * including configuration settings specific to the effect category of the clip.
 * 
 * @groupDescription Helper Methods
 * Methods to help with the functionality of clip operations.
 */
export abstract class AnimClip<TPresetEffectDefinition extends PresetEffectDefinition = PresetEffectDefinition, TClipConfig extends AnimClipConfig = AnimClipConfig> {
  private static id: number = 0;
  protected static MIN_DURATION = 0.01;

  /**
   * The base default configuration for any animation clip before any category-specific
   * configuration, preset effect definition configuration, or configuration passed in through
   * clip factory functions are applied.
   * @group Configuration
   */
  static get baseDefaultConfig() {
    return {
      commitsStyles: true,
      composite: 'replace',
      cssClasses: {
        toAddOnFinish: [],
        toAddOnStart: [],
        toRemoveOnFinish: [],
        toRemoveOnStart: [],
      },
      delay: 0,
      duration: 500,
      easing: 'linear',
      endDelay: 0,
      playbackRate: 1,
      startsNextClipToo: false,
      startsWithPrevious: false,
      description: `<blank clip description>`,
    } as const satisfies AnimClipConfig;
  }

  /**
   * @returns An effect definition with a function that returns empty arrays (so no actual keyframes).
   * @remarks
   * This static method is purely for convenience.
   * @group Helper Methods
   */
  public static createNoOpPresetEffectDefinition() { return {buildFrameGenerators() { return {keyframesGenerator_play: () => [], keyframesGenerator_rewind: () => []}; }} as PresetEffectDefinition; }

  /**
   * The default configuration for clips in a specific effect category, which includes
   * any additional configuration options that are specific to the effect category.
   *  * This never changes, and it available mostly just for reference. Consider it a
   * static property.
   *  * This does NOT include any default configuration from preset effect definitions or
   * configurations passed in from clip factory functions.
   * @group Configuration
   */
  abstract get categoryDefaultConfig(): TClipConfig;

  /**
   * The unchangeable default configuration for clips in a specific effect category.
   *  * This never changes, and it is available mostly just for reference. Consider it a static
   * property.
   *  * This does NOT include any immutable configuration from preset effect definitions.
   * @group Configuration
   */
  abstract get categoryImmutableConfig(): Partial<TClipConfig>;

  /**
   * All the unchangeable default configuration settings for the clip (both category-specific
   * immutable configurations and immutable configurations that come from the specific
   * preset effect definition).
   * @group Configuration
   */
  get immutableConfig(): this['categoryImmutableConfig'] & TPresetEffectDefinition['immutableConfig'] {
    return {
      ...this.presetEffectDefinition.immutableConfig,
      ...this.categoryImmutableConfig,
    };
  }

  /**
   * @group Configuration
   */
  protected config = {} as TClipConfig;

  /**
   * Returns an object containing the configuration options used to define both the timing and effects of the animation clip.
   * @returns An object containing
   *  * {@link AnimClipConfig.commitsStyles|commitsStyles},
   *  * {@link AnimClipConfig.composite|composite},
   *  * {@link AnimClipConfig.cssClasses|cssClasses},
   *  * {@link AnimClipConfig.delay|delay},
   *  * {@link AnimClipConfig.duration|duration},
   *  * {@link AnimClipConfig.easing|easing},
   *  * {@link AnimClipConfig.endDelay|endDelay},
   *  * {@link AnimClipConfig.playbackRate|playbackRate},
   *  * {@link AnimClipConfig.startsWithPrevious|startsWithPrevious},
   *  * {@link AnimClipConfig.startsNextClipToo|startsNextClipToo},
   *  * {@link AnimClipConfig.description|description},
   * @group Property Getter Methods
   * @group Configuration
   */
  getConfig(): TClipConfig {
    return {
      ...this.config,
      // TODO: figure out why this line needs to be here (it's causing the wrong error to be received when domElem is undefined or null)
      cssClasses: this.getModifiers('cssClasses'),
      // TODO: provide some kind of config for when domElem is undefined or null so that the fields aren't just undefined (this is caused by mergeConfigs being in initialize())
    };
  }

  /*-:**************************************************************************************************************************/
  /*-:*************************************        FIELDS & ACCESSORS        ***************************************************/
  /*-:**************************************************************************************************************************/
    // GROUP: Hierarchy
  /**
   * A number that uniquely identifies the clip from other clips.
   * Automatically generated.
   */
  readonly id: number;
  // TODO: remove the getters for these
  /**@internal*/ _parentSequence?: AnimSequence;
  /**@internal*/ _parentTimeline?: AnimTimeline;
  /**
   * The parent {@link AnimSequence} that contains this clip
   * (`undefined` if the clip is not part of a sequence).
   * @group Structure
   */
  get parentSequence() { return this._parentSequence; }
  /**
   * The parent {@link AnimTimeline} that contains the {@link AnimSequence} that contains this clip (may be `undefined`).
   * @group Structure
   */
  get parentTimeline() { return this._parentTimeline; }
  /**
   * The highest level of this clip's lineage.
   *  * If the clip is nested within an {@link AnimTimeline}: that timeline,
   *  * Else, if the clip is within an {@link AnimSequence}: that sequence,
   *  * Else: the clip itself
   * @group Structure
   */
  get root(): AnimTimeline | AnimSequence | AnimClip { return this.parentTimeline ?? this.parentSequence ?? this; }
  /**
   * The DOM element that is to be animated.
   * @group Structure
   */
  readonly domElem: DOMElement;
  private clipNumber: number = NaN;
  /** @internal */ updateClipNumber(trackNumber: number) {
    this.clipNumber = trackNumber;
    this.webchalkClipEl?.updateClipNumber(trackNumber);
  }

  /**
   * Returns an object containing basic information about the clip and its parents.
   * @returns An object containing basic information about the clip and its parents.
   * @group Structure
   */
  getHierarchy(): AnimClipHierarchy {
    return {
      parentSequence: this._parentSequence,
      parentTimeline: this._parentTimeline,
      root: this.root,
      clipNumber: this.clipNumber,
    };
  }

  // GROUP: Styles
  /**
    * Returns an object containing the specified style properties of the specified element.
    *  * Normal CSS properties _must_ be written in camelCase
    * (e.g., `['marginBottom', 'backgroundColor']`, _NOT_ `['margin-bottom', 'background-color']`),
    *  * CSS variables should be written normally (e.g., `['--nav-edge-color', '--brand-red']`).
    * @param element - The DOM element from which to read the styles.
    * @param styleProps - An array of strings representing camelCase CSS property names.
    * @returns An object where the keys are the specified camelCase strings and the values are the CSS property values.
    */
  getStyles(element: Element, styleProps: StyleProperty[]): {[key: string]: string};
  /**
    * Returns the string value of the specified CSS property name for the specified element.
    *  * Normal CSS properties _must_ be written in camelCase (e.g., `'marginBottom'`, _NOT_ `'margin-bottom'`),
    *  * CSS variables should be written normally (e.g., `'--brand-red'`).
    * @param element - The DOM element from which to read the style.
    * @param styleProps - A string representing a single camelCase CSS property name.
    * @returns The string value of the specified camelCase CSS property name.
    */
  getStyles(element: Element, styleProp: StyleProperty): string;
  /**
    * Returns an object containing the specified style properties of this clip's DOM element.
    *  * Normal CSS properties _must_ be written in camelCase
    * (e.g., `['marginBottom', 'backgroundColor']`, _NOT_ `['margin-bottom', 'background-color']`),
    *  * CSS variables should be written normally (e.g., `['--nav-edge-color', '--brand-red']`).
    * @param styleProps - An array of strings representing camelCase CSS property names.
    * @returns An object where the keys are the specified camelCase strings and the values are the CSS property values.
    */
  getStyles(styleProps: StyleProperty[]): {[key: string]: string};
  /**
    * Returns the string value of the specified CSS property name for this clip's DOM element.
    *  * Normal CSS properties _must_ be written in camelCase (e.g., `'marginBottom'`, _NOT_ `'margin-bottom'`),
    *  * CSS variables should be written normally (e.g., `'--brand-red'`).
    * @param styleProps - A string representing a single camelCase CSS property name.
    * @returns The string value of the specified camelCase CSS property name.
    */
  getStyles(styleProp: StyleProperty): string;
  /**
    * @group Property Getter Methods
    */
  getStyles(stylePropsOrEl: StyleProperty[] | StyleProperty | Element, styleProps?: StyleProperty[] | StyleProperty) {
    const elementSpecified = !!styleProps;
    const props = elementSpecified ? styleProps : stylePropsOrEl as Exclude<typeof stylePropsOrEl, Element>;
    const element = elementSpecified ? stylePropsOrEl as Extract<typeof stylePropsOrEl, Element> : this.domElem;

    // for each requested style property, set that property inside result object
    const styleDec = getComputedStyle(element);
    if (typeof props === 'string') {
      // @ts-expect-error
      return props.startsWith('--') ? styleDec.getPropertyValue(props) : styleDec[props];
    }
    else {
      // create object that will store style props
      const subsetObj = {} as any;
      for (const prop of props) {
        // @ts-expect-error
        subsetObj[prop] = prop.startsWith('--') ? styleDec.getPropertyValue(prop) : styleDec[prop as string];
      }
      return  subsetObj;
    }
  }

  /** @internal */ animation!: WebchalkAnimation;
  protected get nestedAnimations(): NestedWebchalkAnimation[] { return this.animation.nestedAnimations; };
  /**@internal*/
  get rafLoopsProgress(): number {
    const { progress, direction } = this.animation.effect!.getComputedTiming();

    const prog = direction === 'normal'
      // ?? 1 because during the active phase (the only time when raf runs), null progress means finished
      ? (progress ?? 1)
      // ?? 0 for the same reason except accounting for direction === 'reverse' instead of 'normal'
      : 1 - (progress ?? 0);

    return prog;
  }

  protected effectFrameGeneratorSetMetadata = {
    // true if both keyframes generators are undefined in frame generators
    noKeyframes: false,
    // true if both mutator generators are undefined in frame generators
    noRaf: false,
    // true if only backward keyframes generators is undefined in frame generators
    bFramesMirrored: false,
    // true if only backward mutator generator is undefined in frame generators
    bRafMirrored: false,
  };

  protected nestedEffectFrameGeneratorSetMetadataArray: {
    noKeyframes: boolean;
    noRaf: boolean;
    bFramesMirrored: boolean;
    bRafMirrored: boolean;
  }[] = [];

  // GROUP: Effect Details
  protected abstract get category(): EffectCategory;
  protected effectName: string;
  protected presetEffectDefinition: TPresetEffectDefinition;
  protected effectOptions: EffectOptions<TPresetEffectDefinition> = {} as EffectOptions<TPresetEffectDefinition>;
  /** @internal */ usageConfig: Partial<TClipConfig> = {}; // ONLY used for printing to clip info box UI
  
  /**@internal*/
  effectFrameGeneratorSet = {} as WithRequired<EffectFrameGeneratorSet, 'keyframesGenerator_play' | 'keyframesGenerator_rewind' | 'nestedEffectFrameGeneratorSets'>;
  /**@internal*/
  rafMutators: {
    forwardMutator?: Mutator;
    backwardMutator?: Mutator;
  } = {};
  /**@internal*/
  nestedRafMutators: {
    forwardMutators: Mutator[];
    backwardMutators: Mutator[];
  } = {
    forwardMutators: [],
    backwardMutators: [],
  }

  /**
   * Returns specific details about the animation's effect.
   * @returns An object containing
   *  * {@link AnimClipEffectDetails.category|category},
   *  * {@link AnimClipEffectDetails.effectName|effectName},
   *  * {@link AnimClipEffectDetails.presetEffectDefinition|presetEffectDefinition},
   *  * {@link AnimClipEffectDetails.effectOptions|effectOptions},
   */
  getEffectDetails(): AnimClipEffectDetails;
  /**
   * Returns the value of a single specific property.
   * @param propName - The name of the desired property.
   * @ignore
   */
  getEffectDetails<T extends keyof AnimClipEffectDetails>(propName: T): AnimClipEffectDetails[T];
  /**
   * Returns an object containing a subset of the object that would normally be returned.
   * @param propNames - An array of strings specifying which properties should be included.
   * @ignore
   */
  getEffectDetails<T extends (keyof AnimClipEffectDetails)[]>(propNames: (keyof AnimClipEffectDetails)[] | T): PickFromArray<AnimClipEffectDetails, T>;
  /**
   * @group Property Getter Methods
   */
  getEffectDetails(specifics?: keyof AnimClipEffectDetails | (keyof AnimClipEffectDetails)[]):
    | AnimClipEffectDetails
    | AnimClipEffectDetails[keyof AnimClipEffectDetails]
    | Partial<Pick<AnimClipEffectDetails, keyof AnimClipEffectDetails>>
  {
    const result: AnimClipEffectDetails = {
      category: this.category,
      effectName: this.effectName,
      presetEffectDefinition: this.presetEffectDefinition,
      effectOptions: this.effectOptions
    };

    return specifics ? getPartial(result, specifics) : result;
  }

  // GROUP: Timing
  private get compoundedPlaybackRate(): number {
    return this.config.playbackRate * (this._parentSequence?.internalCompoundedPlaybackRate ?? 1);
  }
  protected timescaleType: 'duration' | 'rate' = 'duration';
  
  /**@internal*/ fullStartTime = NaN;
  /**@internal*/ updateFullStartTime(fullStartTime: number) {
    this.fullStartTime = fullStartTime;
    this.webchalkClipEl?.updateFullStartTime(fullStartTime);
  }
  /**@internal*/ get activeStartTime() { return (this.fullStartTime + this.getTiming('delay')) / this.getTiming('playbackRate'); }
  /**@internal*/ get activeFinishTime() { return (this.fullStartTime + this.getTiming('delay') + this.getTiming('duration')) / this.getTiming('playbackRate'); }
  /**@internal*/ get fullFinishTime() { return (this.fullStartTime + this.getTiming('delay') + this.getTiming('duration') + this.getTiming('endDelay')) / this.getTiming('playbackRate'); }

  // TODO: position this somewhere better
  get currentTime() { return this.animation.currentTime as number; }
  /**
   * Returns timing-related details about the animation.
   * @returns An object containing
   *  * {@link AnimClipTiming.startsWithPrevious|startsWithPrevious},
   *  * {@link AnimClipTiming.startsNextClipToo|startsNextClipToo},
   *  * {@link AnimClipTiming.duration|duration},
   *  * {@link AnimClipTiming.delay|delay},
   *  * {@link AnimClipTiming.endDelay|endDelay},
   *  * {@link AnimClipTiming.easing|easing},
   *  * {@link AnimClipTiming.playbackRate|playbackRate},
   *  * {@link AnimClipTiming.compoundedPlaybackRate|compoundedPlaybackRate},
   */
  getTiming(): AnimClipTiming;
  /**
   * Returns the value of a single specific property.
   * @param propName - The name of the desired property.
   * @ignore
   */
  getTiming<T extends keyof AnimClipTiming>(propName: T): AnimClipTiming[T];
  /**
   * Returns an object containing a subset of the object that would normally be returned.
   * @param propNames - An array of strings specifying which properties should be included.
   * @ignore
   */
  getTiming<T extends (keyof AnimClipTiming)[]>(propNames: (keyof AnimClipTiming)[] | T): PickFromArray<AnimClipTiming, T>;
  /**
   * @group Property Getter Methods
   */
  getTiming(specifics?: keyof AnimClipTiming | (keyof AnimClipTiming)[]):
    | AnimClipTiming
    | AnimClipTiming[keyof AnimClipTiming]
    | Partial<Pick<AnimClipTiming, keyof AnimClipTiming>>
  {
    const config = this.config;
    const result: AnimClipTiming = {
      startsWithPrevious: config.startsWithPrevious,
      startsNextClipToo: config.startsNextClipToo,
      duration: config.duration,
      delay: config.delay,
      endDelay: config.endDelay,
      easing: config.easing,
      playbackRate: config.playbackRate,
      compoundedPlaybackRate: this.compoundedPlaybackRate,
      timescaleType: this.timescaleType,
    };

    return specifics ? getPartial(result, specifics) : result;
  }

  // GROUP: Modifiers
  /**
   * Returns details about how the DOM element is modified beyond just the effect of the animation.
   * @returns An object containing
   *  * {@link AnimClipModifiers.cssClasses|cssClasses},
   *  * {@link AnimClipModifiers.commitsStyles|commitsStyles},
   *  * {@link AnimClipModifiers.composite|composite},
   */
  getModifiers(): AnimClipModifiers;
  /**
   * Returns the value of a single specific property.
   * @param propName - The name of the desired property.
   * @ignore
   */
  getModifiers<T extends keyof AnimClipModifiers>(propName: T): AnimClipModifiers[T];
  /**
   * Returns an object containing a subset of the object that would normally be returned.
   * @param propNames - An array of strings specifying which properties should be included.
   * @ignore
   */
  getModifiers<T extends (keyof AnimClipModifiers)[]>(propNames: (keyof AnimClipModifiers)[] | T): PickFromArray<AnimClipModifiers, T>;
  /**
   * @group Property Getter Methods
   */
  getModifiers(specifics?: keyof AnimClipModifiers | (keyof AnimClipModifiers)[]) {
    const config = this.config;
    const result: AnimClipModifiers = {
      cssClasses: {
        toAddOnStart: [...(config.cssClasses.toAddOnStart ?? [])],
        toAddOnFinish: [...(config.cssClasses.toAddOnFinish ?? [])],
        toRemoveOnStart: [...(config.cssClasses.toRemoveOnStart ?? [])],
        toRemoveOnFinish: [...(config.cssClasses.toRemoveOnFinish ?? [])],
      },
      composite: config.composite,
      commitsStyles: config.commitsStyles,
    };

    return specifics ? getPartial(result, specifics) : result;
  }

  // GROUP: Status
  protected inProgress: AnimClipStatus['inProgress'] = false; // true only during animate() (regardless of pause state)
  protected isRunning: AnimClipStatus['isRunning'] = false; // true only when inProgress and !isPaused
  protected isPaused: AnimClipStatus['isPaused'] = false;
  protected direction: AnimClipStatus['direction'] = 'forward';
  protected firstRun: boolean = true;
  // TODO: Add to AnimClipStatus
  protected isFinished: boolean = false;
  // protected get durationPending(): boolean {
  //   // return this.timescaleType === 'rate' && (this.firstRun || this.direction === 'backward' && !this.inProgress);
  //   return this.animation.durationPending;
  // }
  private errored = false;
  /** @internal */
  setErrored() {
    this.errored = true;
    this.webchalkClipEl?.handleErrorState();
  }
  /**
   * Returns details about the animation's current status.
   * @returns An object containing
   *  * {@link AnimClipStatus.inProgress|inProgress},
   *  * {@link AnimClipStatus.isRunning|isRunning},
   *  * {@link AnimClipStatus.isPaused|isPaused},
   *  * {@link AnimClipStatus.direction|direction},
   */
  getStatus(): AnimClipStatus;
  /**
   * Returns the value of a single specific property.
   * @param propName - The name of the desired property
   * @ignore
   */
  getStatus<T extends keyof AnimClipStatus>(propName: T): AnimClipStatus[T];
  /**
   * Returns an object containing a subset of the object that would normally be returned.
   * @param propNames - An array of strings specifying which properties should be included.
   * @ignore
   */
  getStatus<T extends (keyof AnimClipStatus)[]>(propNames: (keyof AnimClipStatus)[] | T): PickFromArray<AnimClipStatus, T>;
  /**
   * @group Property Getter Methods
   */
  getStatus(specifics?: keyof AnimClipStatus | (keyof AnimClipStatus)[]):
    | AnimClipStatus
    | AnimClipStatus[keyof AnimClipStatus]
    | Partial<Pick<AnimClipStatus, keyof AnimClipStatus>>
  {
    const result: AnimClipStatus = {
      inProgress: this.inProgress,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      direction: this.direction,
      errored: this.errored,
    };

    return specifics ? getPartial(result, specifics) : result;
  }

  /*-:**************************************************************************************************************************/
  /*-:*********************************        CONSTRUCTOR & INITIALIZERS        ***********************************************/
  /*-:**************************************************************************************************************************/
  /**
   * Used by a parent to set pointers to itself (the parent) within the clip.
   * @internal
   */
  setLineage(level: 'sequence' | 'timeline', sequence: AnimSequence): boolean {
    switch(level) {
      case "sequence":
        if (this._parentSequence) { return false; }
        this._parentSequence = sequence;
        this._parentTimeline = sequence.getHierarchy().parentTimeline;
        break;
      case "timeline":
        this._parentTimeline = sequence._parentTimeline;
        break;
      default: this.generateError(RangeError, [`Invalid level "${level}". Must be "sequence" or "timeline"`]);
    }

    return true;
  }

  /**
   * Used by a parent to remove pointers to itself (the parent) within the clip.
   * @internal
   */
  removeLineage(level: 'sequence' | 'timeline'): this {
    switch(level) {
      case "sequence":
        this._parentSequence = undefined;
        this._parentTimeline = undefined;
        this.updateClipNumber(NaN);
        break;
      case "timeline":
        this._parentTimeline = undefined
        break;
      default: this.generateError(RangeError, [`Invalid level "${level}". Must be "sequence" or "timeline"`]);
    }
    
    return this;
  }

  constructor(domElem: DOMElement | null | undefined, effectName: string, bank: PresetEffectBank) {
    if (webchalk.clipCreatorLock) {
      throw this.generateError(
        TypeError,
        [`Illegal constructor. Clips can only be instantiated using clip factory functions.` +
        errorTip(
          `Tip: A "factory function" is just a function that returns an instance of a class without using 'new'.` +
          ` Our "clip" factory functions are created by webchalk.createAnimationClipFactories(),` +
          ` a method that returns an object containing factory functions like Entrance(), Motion(), etc.`
        )]
      );
    }
    webchalk.clipCreatorLock = true;

    this.id = AnimClip.id++;
    
    if (!domElem) {
      throw this.generateError(CustomErrorClasses.InvalidElementError, [`Element must not be null or undefined.`]);
    }
    this.domElem = domElem;
    this.effectName = effectName;
    
    this.presetEffectDefinition = bank[effectName] as TPresetEffectDefinition;

    // checking if this.presetEffectDefinition exists is deferred until initialize()
  }

  /**@internal*/
  initialize(effectOptions: EffectOptions<TPresetEffectDefinition>, effectConfig: Partial<TClipConfig> = {}): this {
    // Throw error if invalid effectName
    // Deferred until initialize() so that this.category has actually been initialized by derived class by now
    if (!this.presetEffectDefinition) { throw this.generateError(RangeError, [`Invalid effect name: "${this.effectName}" does not exists in the "${this.category}" category.`]); }

    this.effectOptions = effectOptions;
    this.usageConfig = effectConfig;

    this.config = this.mergeConfigs(effectConfig, this.presetEffectDefinition.defaultConfig ?? {}, this.presetEffectDefinition.immutableConfig ?? {});
    // cannot be exactly 0 because that causes some Animation-related bugs that can't be easily worked around
    this.config.duration = Math.max(this.getTiming('duration') as number, AnimClip.MIN_DURATION);

    // playbackRate is not included because it is computed at the time of animating
    const { delay, duration, endDelay, easing, composite } = this.config;
    const keyframeOptions: KeyframeEffectOptions = {
      delay,
      duration,
      endDelay,
      fill: 'forwards',
      easing: useEasing(easing),
      composite: composite,
    };

    this.animation = new WebchalkAnimation(this.domElem, keyframeOptions, this.generateError, this);

    // TODO: Figure out how to disable any pausing/stepping functionality in the timeline while stopped for tasks
    this.animation.pauseForTasks = () => {
      this.parentTimeline?.disablePlaybackButtons();
      this.root.pause();
    }
    this.animation.unpauseFromTasks = () => {
      this.root.unpause();
      this.parentTimeline?.enablePlaybackButtons();
    }

    return this;
  }

  private static mergeCssClassesConfig<T extends {cssClasses?: Partial<CssClassOptions>}>(...configObjects: T[]): CssClassOptions {
    return {
      toAddOnFinish: mergeArrays(...configObjects.map(obj => obj['cssClasses']?.['toAddOnFinish'])),
      toAddOnStart: mergeArrays(...configObjects.map(obj => obj['cssClasses']?.['toAddOnStart'])),
      toRemoveOnFinish: mergeArrays(...configObjects.map(obj => obj['cssClasses']?.['toRemoveOnFinish'])),
      toRemoveOnStart: mergeArrays(...configObjects.map(obj => obj['cssClasses']?.['toRemoveOnStart'])),
    };
  }

  protected mergeConfigs(
    usageConfig: Partial<TClipConfig>,
    effectDefinitionDefaultConfig: Partial<TClipConfig>,
    effectDefinitionImmutableConfig: Partial<TClipConfig>,
  ): TClipConfig {
    return {
      ...AnimClip.baseDefaultConfig,

      // layer 2 subclass defaults take priority
      ...this.categoryDefaultConfig,

      // layer 3 config defined in preset effect definition takes priority over default
      ...effectDefinitionDefaultConfig,

      // layer 4 config (person using Webchalk) takes priority over preset definition
      ...usageConfig,

      // mergeable properties
      cssClasses: AnimClip.mergeCssClassesConfig<PartialPick<AnimClipConfig, 'cssClasses'>>(
        AnimClip.baseDefaultConfig,
        this.categoryDefaultConfig,
        effectDefinitionDefaultConfig,
        usageConfig,
      ),

      // layer 3 immutable config take priority over layer 4 config
      ...effectDefinitionImmutableConfig,

      // layer 2 subclass immutable config takes priority over layer 3 immutable config
      ...this.categoryImmutableConfig,
    };
  }

  /*-:**************************************************************************************************************************/
  /*-:****************************************        UI METHODS        ********************************************************/
  /*-:**************************************************************************************************************************/
  /** @internal */ webchalkClipEl?: WebchalkClipElement;
  /** @internal */ get uiAttached(): boolean { return this.webchalkClipEl ? true : false; } // TODO: probably put this in status???
  
  /**
   * @internal
   * @group UI Methods
   */
  attachUI() {
    // TODO: improve error message
    if (this.uiAttached) { throw this.generateError(new Error('AnimClip UI already attached.')); }
    this.webchalkClipEl = new WebchalkClipElement();
    this.webchalkClipEl.animClip = this;
  }

  /**
   * @internal
   * @group UI Methods
  */
  writeUI() {
    if (!this.uiAttached) { throw this.generateError(new Error('AnimClip UI must be attached before writing.')); }
    this.webchalkClipEl?.readClip();
  }

  /**
   * @internal
   * @group UI Methods
   */
  detachUI() {
    // if (!this.uiAttached) { throw this.generateError(Error('AnimClip UI is already not attached.')); }
    if (!this.uiAttached) { return; }
    this.webchalkClipEl!.remove();
    this.webchalkClipEl = undefined;
  }

  /*-:**************************************************************************************************************************/
  /*-:*****************************************        PLAYBACK        *********************************************************/
  /*-:**************************************************************************************************************************/
  private currAnimatePromise: Promise<this> = new Promise(resolve => {});
  
  /**
   * Plays the animation clip (animation runs forward).
   * @returns A promise that is resolved when the animation finishes playing (including playing its endDelay phase).
   * @group Playback Methods
   */
  async play(): Promise<this>;
  /**@internal*/
  async play(parentSequence: AnimSequence): Promise<this>;
  async play(parentSequence?: AnimSequence): Promise<this> {
    // both parentSequence vars should either be undefined or the same AnimSequence
    if (this._parentSequence !== parentSequence) { this.throwChildPlaybackError(this.play.name); }
    this.currAnimatePromise = this.animate('forward');
    return this.currAnimatePromise;
  }

  /**
   * Rewinds the animation clip (animation runs backward).
   * @returns A promise that is resolved when the animation finishes rewinding (including rewinding its delay phase).
   * @group Playback Methods
   */
  async rewind(): Promise<this>;
  /**@internal*/
  async rewind(parentSequence: AnimSequence): Promise<this>;
  async rewind(parentSequence?: AnimSequence): Promise<this> {
    if (this._parentSequence !== parentSequence) { this.throwChildPlaybackError(this.rewind.name); }
    this.currAnimatePromise = this.animate('backward');
    return this.currAnimatePromise;
  }

  /**
   * Pauses the animation clip.
   *  * If the clip is not already in progress, this method does nothing.
   * @group Playback Methods
   */
  pause(): this;
  /**@internal*/
  pause(parentSequence?: AnimSequence): this;
  pause(parentSequence?: AnimSequence): this {
    if (this._parentSequence !== parentSequence) { this.throwChildPlaybackError(this.pause.name); }
    if (this.isRunning) {
      this.isPaused = true;
      this.isRunning = false;
      this.animation.pause();
    }
    return this;
  }

  /**
   * Unpauses the animation clip.
   *  * If the clip is not currently paused, this method does nothing.
   * @group Playback Methods
   */
  unpause(): this;
  /**@internal*/
  unpause(parentSequence: AnimSequence): this;
  unpause(parentSequence?: AnimSequence): this {
    if (this._parentSequence !== parentSequence) { this.throwChildPlaybackError(this.unpause.name); }
    if (this.isPaused) {
      this.isPaused = false;
      this.isRunning = true;
      this.animation.play();
    }
    return this;
  }

  /**
   * Forces the animation clip to instantly finish.
   *  * This works even if the animation is not already currently in progress.
   *  * The animation will still pause for any tasks generated by {@link AnimClip.scheduleTask | scheduleTask()}.
   *  * Does not work if the clip is currently paused.
   * @returns A promise that is resolved when the clip has finished.
   * @group Playback Methods
   */
  async finish(): Promise<this>;
  /**@internal*/
  async finish(parentSequence: AnimSequence): Promise<this>;
  async finish(parentSequence?: AnimSequence): Promise<this> {
    if (this._parentSequence !== parentSequence) { this.throwChildPlaybackError(this.finish.name); }
    // finish() is not allowed to execute if clip is paused
    // TODO: maybe throw an error instead of just returning
    if (this.isPaused) { return this; }
    
    // Needs to play/rewind first if not already in progress.
    // This is essentially for the case where the animation is NOT part of a sequence and finish()
    // is called without having first called play() or rewind() (I decided that the expected behavior is to
    // instantly finish the animation in whatever the current direction is).
    if (!this.inProgress) {
      switch(this.animation.direction) {
        case "forward":
          return this.play(parentSequence!);
        case "backward":
          return this.rewind(parentSequence!);
        default: throw this.generateError(
          Error,
          [`An error here should be impossible. this.animation.direction should only be 'forward' or 'backward'.`]
        );
      }
    }
    else {
      if (!this.jumpingDisabled) {
        this.animation.finish();
      }
      return this.currAnimatePromise;
    }
  }

  // accepts a time to wait for (converted to an endDelay) and returns a Promise that is resolved at that time
  /**
   * Returns a `Promise` that is resolved when the animation clip reaches the specified time in the specified direction.
   * @param direction - The direction the animation will be going when the Promise is resolved.
   * @param phase - The phase of the animation where the Promise will be resolved.
   * @param timePosition - The time position within the phase when the Promise will be resolved.
   * @returns A promise that is resolved at the specific time point of the animation.
   * 
   * @example
   * <!-- EX:S id="AnimClip.scheduleResolver-1" code-type="ts" -->
   * ```ts
   * async function testFunc() {
   *   const { Entrance } = webchalk.createAnimationClipFactories();
   *   const square = document.querySelector('.square');
   *   const ent = Entrance(square, '~fade-in', []);
   *   // wait until ent is played and gets 1/5 of the way through the active phase of the animation
   *   await ent.scheduleResolver('forward', 'activePhase', '20%');
   *   console.log('1/5 done playing!');
   * }
   * 
   * testFunc();
   * ```
   * <!-- EX:E id="AnimClip.scheduleResolver-1" -->
   * 
   * @example
   * <!-- EX:S id="AnimClip.scheduleResolver-2" code-type="ts" -->
   * ```ts
   * async function testFunc() {
   *   const { Entrance } = webchalk.createAnimationClipFactories();
   *   const square = document.querySelector('.square');
   *   const ent = Entrance(square, '~fade-in', []);
   *    // wait until ent is eventually rewound and gets 4/5 of the way through rewinding the active phase of the animation
   *    await ent.scheduleResolver('backward', 'activePhase', '20%');
   *    console.log('4/5 done rewinding!');
   * }
   * 
   * testFunc();
   * ```
   * <!-- EX:E id="AnimClip.scheduleResolver-2" -->
   * 
   * @group Timing Event Methods
   */
  scheduleResolver(
    direction: 'forward' | 'backward',
    phase: 'delayPhase' | 'activePhase' | 'endDelayPhase' | 'whole',
    timePosition: number | 'beginning' | 'end' | `${number}%`,
    schedulingOptions?: {
      /**
       * A text description for what is awaiting the specified time point. This can be displayed in the UI.
       * @defaultValue
       * ```ts
       * '<blank label>'
       * ```
       */
      label?: string;
    }
  ): PromiseWithId<void> {
    return this.animation.scheduleResolver(direction, phase, timePosition, schedulingOptions);
  }

  /**
   * @internal
   * @grouping Timing Event Methods
   */
  scheduleIntegrityOuterResolver(
    direction: 'forward' | 'backward',
    phase: 'delayPhase' | 'activePhase' | 'endDelayPhase' | 'whole',
    timePosition: number | 'beginning' | 'end' | `${number}%`
  ): Promise<void> {
    return this.animation.scheduleResolver(direction, phase, timePosition, {forIntegrity: true});
  }

  /**
   * @internal
   * @group Timing Event Methods
   */
  addIntegrityAsyncCb(
    phase: 'delayPhase' | 'activePhase' | 'endDelayPhase' | 'whole',
    timePosition: number | 'beginning' | 'end' | `${number}%`,
    promises: {onPlay?: Function, onRewind?: Function},
  ): void {
    return this.animation.addIntegrityAsyncCb(phase, timePosition, promises);
  }

  /**
   * Pauses the animation clip when it reaches the specified time and performs the specified task,
   * unpausing once the task is complete.
   *  * If the clip is part of a structure (like a sequence), the entire structure is paused as well.
   * @param phase - The phase of the animation to place the blocks in.
   * @param timePosition - The time position within the phase when the task should be performed.
   * @param task - An object that contains the functions that should be called when {@link timePosition} is reached.
   * @param schedulingOptions - An options object defining the behavior of the scheduling.
   * @param schedulingOptions.frequencyLimit - The maximum number of times the task can be performed.
   * @returns The string id (auto-generated) referring to the task and its spot in the schedule.
   * 
   * @example
   * <!-- EX:S id="AnimClip.scheduleTask-1" code-type="ts" -->
   * ```ts
   * async function wait(milliseconds: number) { // Promise-based timer
   *    return new Promise(resolve => setTimeout(resolve, milliseconds));
   * }
   * 
   * const square = document.querySelector('.square');
   * const { Entrance } = webchalk.createAnimationClipFactories();
   * const ent = Entrance(square, '~fade-in', [], {endDelay: 1500});
   * 
   * // adds 1 task that will pause the clip for 2 seconds once the clip is 15% through the active phase
   * ent.scheduleTask('activePhase', '15%', {onPlay: () => wait(2000)});
   * // adds 1 more task at the same point that will pause the clip for 3 seconds.
   * ent.scheduleTask('activePhase', '15%', {onPlay: () => wait(3000)});
   * // adds 1 task at 40% into the endDelay phase that will...
   * // ... log 'HELLO' if the clip is playing forward
   * // ... log 'WORLD' if the clip is rewinding
   * ent.scheduleTask('endDelayPhase', '40%', {
   *   onPlay: () => console.log('HELLO'),
   *   onRewind: () => console.log('WORLD')
   * }, {frequencyLimit: 2});
   * 
   * (async () => {
   *   // 1) First play
   *   await ent.play();
   *   // ↑
   *   // Once ent is 15% through the active phase, it will pause and handle its scheduled tasks.
   *   // -- "wait(2000)" resolves after 2 seconds.
   *   // -- "wait(3000)" resolves after 3 seconds.
   *   // There are no more tasks at this point, so playback is resumed.
   *   // Once ent is 40% through the endDelay phase, it will pause and handle its tasks
   *   // -- 'HELLO' is logged to the console
   *   // There are no more tasks at this point, so playback is resumed.
   * 
   *   // 2) First rewind
   *   await ent.rewind();
   *   // ↑
   *   // Once ent rewinds back to the 40% point of the endDelay phase, it will pause and...
   *   // ... handle its scheduled tasks
   *   // -- 'WORLD' is logged to the console
   *   // There are no more tasks at this point, so playback is resumed.
   * 
   *   // 3) Second play
   *   await ent.play();
   *   // ↑
   *   // Once ent is 15% through the active phase, it will pause and handle its scheduled tasks.
   *   // -- "wait(2000)" resolves after 2 seconds.
   *   // -- "wait(3000)" resolves after 3 seconds.
   *   // There are no more tasks at this point, so playback is resumed.
   *   // Once ent is 40% through the endDelay phase, it will pause and handle its tasks
   *   // -- 'HELLO' is logged to the console
   *   // -- -- Since the frequency limit was 2, this subtask is removed
   *   // There are no more tasks at this point, so playback is resumed.
   * 
   *   // 4) Second rewind
   *   await ent.rewind();
   *   // ↑
   *   // Once ent rewinds back to the 40% point of the endDelay phase, it will pause and...
   *   // ... handle its scheduled tasks
   *   // -- 'WORLD' is logged to the console
   *   // -- -- Since the frequency limit was 2, this subtask is removed
   *   // There are no more tasks at this point, so playback is resumed.
   * 
   *   // 5) Third play
   *   await ent.play();
   *   // ↑
   *   // Once ent is 15% through the active phase, it will pause and handle its scheduled tasks.
   *   // -- "wait(2000)" resolves after 2 seconds.
   *   // -- "wait(3000)" resolves after 3 seconds.
   *   // There are no more tasks at this point, so playback is resumed.
   * 
   *   // 6) Third rewind
   *   await ent.rewind();
   *   // ↑ No scheduled tasks, so playback runs uninterrupted
   * })();
   * ```
   * <!-- EX:E id="AnimClip.scheduleTask-1" -->
   * 
   * @group Timing Event Methods
   */
  scheduleTask(
    phase: 'delayPhase' | 'activePhase' | 'endDelayPhase' | 'whole',
    timePosition: number | 'beginning' | 'end' | `${number}%`,
    task: ScheduledTask,
    schedulingOptions: {
      /**
       * The maximum number of times the task can be performed.
       * @defaultValue
       * ```ts
       * Infinity
       * ```
       */
      frequencyLimit?: number;
      /**
       * A text description for the task that can be displayed in the UI.
       * @defaultValue
       * ```ts
       * '<blank task description>'
       * ```
       */
      description?: string;
    } = {}
  ): string {
    return this.animation.scheduleTask(phase, timePosition, task, schedulingOptions);
  }

  /**
   * Removes the task represented by the string id (id obtained from {@link AnimClip.scheduleTask | scheduleTask()}).
   * @param taskId - The string id of the task to remove.
   * @returns The removed task.
   * 
   * @group Timing Event Methods
   */
  unscheduleTask(taskId: string): ScheduledTask {
    return this.animation.unscheduleTask(taskId);
  }

  /**
   * Removes the resolver for the promise represented by the string id (id obtained from {@link AnimClip.scheduleResolver | scheduleResolver()}.id).
   * @param promiseId - The string id of the promise whose resolver to remove.
   * @returns The removed resolver.
   * 
   * @group Timing Event Methods
   */
  unscheduleResolver(promiseId: string): (value: void | PromiseLike<void>) => void {
    return this.animation.unscheduleResolver(promiseId);
  }

  /**
   * @internal
   */
  hasTaskParts(direction: 'forward' | 'backward') {
    return this.animation.hasTaskParts(direction);
  }
  /**
   * @internal
   */
  hasPromises(direction: 'forward' | 'backward') {
    return this.animation.hasPromises(direction);
  }

  /**
   * Multiplies playback rate of parent timeline and sequence (if exist) with base playback rate.
   * @group Playback Methods
   * @internal
   */
  useCompoundedPlaybackRate() { this.animation.updatePlaybackRate(this.compoundedPlaybackRate); }

  /**@internal */
  jumpingDisabled = false;

  /**
   * @group Playback Methods
   * @internal
   */
  disableJumpingOneTime() {
    this.jumpingDisabled = true;
  }

  /*-:**************************************************************************************************************************/
  /*-:*****************************************         ANIMATE         ********************************************************/
  /*-:**************************************************************************************************************************/
  protected _onStartForward(): void {};
  protected _onFinishForward(): void {};
  protected _onStartBackward(): void {};
  protected _onFinishBackward(): void {};

  /**
   * Updates the duration of rate-based animation clips.
   * @param duration - The duration computed once the clip plays.
   */
  protected updateDuration(duration: number, rescheduleTasks: boolean = true): void {
    this.config.duration = duration;
    this.animation.updateDuration(duration, rescheduleTasks);
    this.webchalkClipEl?.updateDuration(duration);
    this._parentSequence?.commitForRate(this);
  }

  protected async animate(direction: 'forward' | 'backward'): Promise<this> {
    if (this.inProgress) { return this; }

    // if this is the first time running animate() or the generator building is set to repeat,
    // retrieve the generators and update animation effects' directions according to presence
    // of keyframes generators
    if (
      this.firstRun
      || direction === 'forward' && this.presetEffectDefinition.howOftenBuildGenerators === 'on-every-play'
    ) {
      this.firstRun = false;
      this.retrieveGenerators();
      
      this.animation.forwardEffect.updateTiming({
        direction: this.effectFrameGeneratorSet.reverseKeyframesEffect ? 'reverse' : 'normal',
      });
      const nestedAnimations = this.nestedAnimations;
      for (let i = 0; i < nestedAnimations.length; ++i) {
        nestedAnimations[i].forwardEffect.updateTiming({
          direction: this.effectFrameGeneratorSet.reverseKeyframesEffect ? 'reverse' : 'normal',
        });
      }

      this.animation.backwardEffect.updateTiming({
        // if no backward keyframes generator was specified, assume the reverse of the forward keyframes generator
        direction: xor(
          this.effectFrameGeneratorSetMetadata.bFramesMirrored,
          this.effectFrameGeneratorSet.reverseKeyframesEffect
        ) ? 'reverse' : 'normal'
      });
      for (let i = 0; i < this.nestedAnimations.length; ++i) {
        this.nestedAnimations[i].backwardEffect.updateTiming({
          direction: xor(
            this.nestedEffectFrameGeneratorSetMetadataArray[i].bFramesMirrored,
            this.effectFrameGeneratorSet.reverseKeyframesEffect
          ) ? 'reverse' : 'normal'
        });
      }
    }

    const {
      config,
      animation,
      nestedAnimations,
      effectFrameGeneratorSet,
      effectFrameGeneratorSetMetadata,
      effectFrameGeneratorSet: {nestedEffectFrameGeneratorSets},
      nestedEffectFrameGeneratorSetMetadataArray,
    } = this;

    animation.setDirection(direction);
    for (let i = 0; i < nestedAnimations.length; ++i) {
      nestedAnimations[i].setDirection(direction);
    }
    this.direction = direction;
    // Clear the current keyframes to prevent interference with generators
    switch(direction) {
      case 'forward':
        animation.setForwardFrames([{fontFeatureSettings: 'normal'}]);
        for (let i = 0; i < nestedAnimations.length; ++i) {
          nestedAnimations[i].setForwardFrames([{fontFeatureSettings: 'normal'}]);
        }
        break;
      case 'backward':
        animation.setBackwardFrames([{fontFeatureSettings: 'normal'}]);
        for (let i = 0; i < nestedAnimations.length; ++i) {
          nestedAnimations[i].setBackwardFrames([{fontFeatureSettings: 'normal'}]);
        }
        break;
      default:
        throw this.generateError(
          Error,
          [`An error here should be impossible. this.animation.direction should only be 'forward' or 'backward'.`]
        );
    }
    this.useCompoundedPlaybackRate();

    // used as resolve() and reject() in the eventually returned promise

    // if animation is being activated after having finished playback at some point,...
    // ... reset fullyFinished promise
    if (this.isFinished) {
      this.isFinished = false;
    }
    const { promise, resolve, reject } = Promise.withResolvers<this>();
    
    this.inProgress = true;
    this.isRunning = true;

    if (
      (this._parentSequence?.getStatus('skippingOn') || this._parentSequence?.getStatus('usingFinish'))
      && !this.jumpingDisabled
    )
      { animation.finish(); }
    else
      { animation.play(); }
    if (this._parentSequence?.getStatus('isPaused')) { this.pause(this.parentSequence); }
    this._parentTimeline?.webchalkTimelineEl?.scrollToClip(this, direction);
    
    // After delay phase, apply class modifications and call onStart functions.
    animation.onDelayFinish = () => {
      try {
        switch(direction) {
          // FORWARD
          case 'forward':
            // handle CSS classes and pre-start function
            // TODO: add classes to all elements???
            this.domElem.classList.add(...config.cssClasses.toAddOnStart ?? []);
            this.domElem.classList.remove(...config.cssClasses.toRemoveOnStart ?? []);
            this._onStartForward();
            
            // Generate keyframes
            // Keyframe generation is done here so that generations operations that rely on the side effects of class modifications and _onStartForward()...
            // ...can function properly.
            try {
              const reverseKeyframesEffect = effectFrameGeneratorSet.reverseKeyframesEffect;
              animation.setForwardFrames(effectFrameGeneratorSet.keyframesGenerator_play(), reverseKeyframesEffect);
              for (let i = 0; i < nestedAnimations.length; ++i) {
                const nestedEffectFrameGenSet = nestedEffectFrameGeneratorSets[i];
                nestedAnimations[i].setForwardFrames(nestedEffectFrameGenSet.keyframesGenerator_play!(), reverseKeyframesEffect);
              }
              this.rafMutators.forwardMutator = effectFrameGeneratorSet.mutatorGenerator_play?.();
              this.nestedRafMutators.forwardMutators = [];
              for (let i = 0; i < nestedAnimations.length; ++i) {
                const nestedEffectFrameGenSet = nestedEffectFrameGeneratorSets[i];
                if (nestedEffectFrameGenSet.mutatorGenerator_play) {
                  this.nestedRafMutators.forwardMutators.push(nestedEffectFrameGenSet.mutatorGenerator_play());
                }
              }
            }
            catch (err: unknown) {
              throw this.generateError(err as Error);
            }

            // If RAF mutator exists, begin RAF loop
            // NEXT REMINDER: figure this out
            if (this.rafMutators.forwardMutator || (this.nestedRafMutators.forwardMutators.length > 0)) { requestAnimationFrame(this.loop); }

            // sets it back to 'forwards' in case it was set to 'none' in a previous running
            animation.effect?.updateTiming({fill: 'forwards'});
            for (let i = 0; i < nestedAnimations.length; ++i) {
              nestedAnimations[i].effect?.updateTiming({fill: 'forwards'});
            }
            break;
    
          // BACKWARD
          case 'backward':
            // handle pre-start function and CSS classes
            this._onStartBackward();
            this.domElem.classList.add(...config.cssClasses.toRemoveOnFinish ?? []);
            this.domElem.classList.remove(...config.cssClasses.toAddOnFinish ?? []);

            // Generate keyframes
            try {
              const reverseKeyframesEffect = effectFrameGeneratorSet.reverseKeyframesEffect;
              animation.setBackwardFrames(effectFrameGeneratorSet.keyframesGenerator_rewind(), effectFrameGeneratorSetMetadata.bFramesMirrored, reverseKeyframesEffect);
              this.rafMutators.backwardMutator = this.effectFrameGeneratorSet.mutatorGenerator_rewind?.();

              for (let i = 0; i < nestedAnimations.length; ++i) {
                const nestedEffectFrameGenSet = nestedEffectFrameGeneratorSets[i];
                const nestedAnim = this.nestedAnimations[i];
                nestedAnim.setBackwardFrames(nestedEffectFrameGenSet.keyframesGenerator_rewind!(), nestedEffectFrameGeneratorSetMetadataArray[i].bFramesMirrored, reverseKeyframesEffect);
                if (nestedEffectFrameGenSet.mutatorGenerator_rewind) {
                  this.nestedRafMutators.backwardMutators.push(nestedEffectFrameGenSet.mutatorGenerator_rewind());
                }
              }
            }
            catch (err: unknown) { throw this.generateError(err as Error); }

            // If RAF mutator exists, begin RAF loop
            if (this.rafMutators.backwardMutator || (this.nestedRafMutators.backwardMutators.length > 0)) { requestAnimationFrame(this.loop); }
            break;
    
          default:
            throw this.generateError(RangeError, [`Invalid direction "${direction}" passed to animate(). Must be "forward" or "backward".`]);
        }
      }
      catch(err: unknown) {
        reject(err);
      }
    };

    // After active phase, then handle commit settings, apply class modifications, and call onFinish functions.
    animation.onActiveFinish = () => {
      const commitStylesAndAddClasses = (animation: WebchalkAnimation | NestedWebchalkAnimation, noKeyframes: boolean) => {
        const domElem = animation.target;

        try {
          // if should commit styles, only try to use commitStyles() if there are meaningful keyframes
          if (config.commitsStyles && !noKeyframes) {
            // Attempt to apply the styles to the element.
            try {
              animation.commitStyles();
              // ensures that accumulating effects are not stacked after commitStyles() (hopefully, new spec will prevent the need for this workaround)
              animation.effect?.updateTiming({ fill: 'none' });
            }
            // If commitStyles() fails, it's because the element is not rendered.
            catch (_) {
              // attempt to override the hidden state and apply the style.
              try {
                domElem.classList.add('webchalk-force-show'); // CHANGE NOTE: Use new hidden classes
                animation.commitStyles();
                animation.effect?.updateTiming({ fill: 'none' });
                domElem.classList.remove('webchalk-force-show');
              }
              // If this fails, then the element's parent is hidden. Do not attempt to remedy; throw error instead.
              catch (err: unknown) {
                const reasons = [];
                if (getComputedStyle(domElem).display === 'none') {
                  reasons.push(detab`Something is causing the CSS style {display: hidden} to be applied besides the class "webchalk-display-none".`);
                }
                let ancestor = domElem;
                while (ancestor = ancestor.parentElement as DOMElement) {
                  if (!ancestor) { break; }
                  if (getComputedStyle(ancestor).display === 'none') {
                    reasons.push(detab`One of the parent elements of the element is unrendered.`);
                  }
                }
                throw this.generateError(CustomErrorClasses.CommitStylesError,
                  [detab`Failed to commit styles on the element while it was unrendered.\
                  Animation styles normally cannot be saved on unrendered elements in JavaScript, but Webchalk allows it ONLY IF\
                  the element is unrendered due to having the CSS class "webchalk-display-none". If there is ANY other reason\
                  for the element not being rendered, the styles cannot be committed.
                  Detected reasons:\n`
                  + reasons.map((reason, index) => `    ${index + 1}) ${reason}`).join('\n')],
                  domElem
                );
              }
            }
          }
    
          // TODO: figure this out for co animations
          switch(direction) {
            case 'forward':
              this.domElem.classList.add(...config.cssClasses.toAddOnFinish ?? []);
              this.domElem.classList.remove(...config.cssClasses.toRemoveOnFinish ?? []);
              this._onFinishForward();
              break;
            case 'backward':
              this._onFinishBackward();
              this.domElem.classList.add(...config.cssClasses.toRemoveOnStart ?? []);
              this.domElem.classList.remove(...config.cssClasses.toAddOnStart ?? []);
              break;
          }
        }
        catch (err: unknown) {
          reject(err);
        }
      };

      commitStylesAndAddClasses(animation, effectFrameGeneratorSetMetadata.noKeyframes);
      for (let i = 0; i < nestedAnimations.length; ++i) {
        commitStylesAndAddClasses(nestedAnimations[i], nestedEffectFrameGeneratorSetMetadataArray[i].noKeyframes);
      }
    };
    
    // After endDelay phase, cancel animation and resolve overall promise.
    animation.onEndDelayFinish = () => {
      this.inProgress = false;
      this.isRunning = false;
      animation.cancel();
      // if rate-based length, reset duration to unknown after finishing rewinding
      if (this.timescaleType === 'rate' && this.direction === 'backward') { this.updateDuration(TBA_DURATION, false); }
      this.isFinished = true;
      this.jumpingDisabled = false; // only matters if jumpingDisabled was activated by disableJumpingOneTime()
      resolve(this);
    };

    return promise.catch((err) => {
      this.root.pause();
      throw err;
    });
  }

  private retrieveGenerators(): void {
    try {
      // retrieve generators
      let {
        keyframesGenerator_play,
        keyframesGenerator_rewind,
        mutatorGenerator_play,
        mutatorGenerator_rewind,
        reverseKeyframesEffect = false,
        reverseMutatorEffect = false,
        nestedEffectFrameGeneratorSets = [],
      } = call(this.presetEffectDefinition.buildFrameGenerators, this, ...this.getEffectDetails().effectOptions);

      // format main effect frame generator set and metadata
      const tempEffectFrameGeneratorSet = {
        keyframesGenerator_play,
        keyframesGenerator_rewind,
        mutatorGenerator_play,
        mutatorGenerator_rewind,
      }
      
      this.formatFrameGeneratorSet(tempEffectFrameGeneratorSet, this.effectFrameGeneratorSetMetadata);

      this.effectFrameGeneratorSet = {
        ...tempEffectFrameGeneratorSet as WithRequired<
          typeof this.effectFrameGeneratorSet,
          'keyframesGenerator_play' | 'keyframesGenerator_rewind'
        >,
        reverseKeyframesEffect,
        reverseMutatorEffect,
        // TODO: dispose of old sets when necessary
        nestedEffectFrameGeneratorSets,
      };

      // format co-effect frame generator set and create metadata
      // and create new co animation objects
      this.animation.deleteNestedAnimations();
      this.nestedEffectFrameGeneratorSetMetadataArray = [];

      for (let i = 0; i < nestedEffectFrameGeneratorSets.length; ++i) {
        // handle generator set and metadata
        const nestedEffectFrameGeneratorSet = nestedEffectFrameGeneratorSets[i];
        const nestedEffectFrameGeneratorSetMetadata = {
          bFramesMirrored: false,
          bRafMirrored: false,
          noKeyframes: false,
          noRaf: false,
        };
        this.nestedEffectFrameGeneratorSetMetadataArray.push(nestedEffectFrameGeneratorSetMetadata);

        this.formatFrameGeneratorSet(nestedEffectFrameGeneratorSet, nestedEffectFrameGeneratorSetMetadata);

        // create co-animation
        const { delay, duration, endDelay, easing, composite } = this.config;
        const keyframeOptions: KeyframeEffectOptions = {
          delay,
          duration,
          endDelay,
          fill: 'forwards',
          easing: useEasing(easing),
          composite: composite,
        };

        this.animation.createNestedAnimation(nestedEffectFrameGeneratorSet.domElem, keyframeOptions, this.generateError, this);
      }
    }
    catch (err: unknown) { throw this.generateError(err as Error); }
  }

  private formatFrameGeneratorSet(
    generatorSet: Pick<EffectFrameGeneratorSet,
      | 'keyframesGenerator_play'
      | 'keyframesGenerator_rewind'
      | 'mutatorGenerator_play'
      | 'mutatorGenerator_rewind'
    >,
    generatorSetMetadata: {
      bFramesMirrored: boolean;
      bRafMirrored: boolean;
      noKeyframes: boolean;
      noRaf: boolean;
    }
  ): void {
    // if no generators are specified, make keyframes generators return empty keyframes array
    if (!(generatorSet.keyframesGenerator_play || generatorSet.keyframesGenerator_rewind || generatorSet.mutatorGenerator_play || generatorSet.mutatorGenerator_rewind)) {
      generatorSet.keyframesGenerator_play = () => [];
      generatorSet.keyframesGenerator_rewind = () => [];
      generatorSetMetadata.noKeyframes = true;
      generatorSetMetadata.noRaf = true;
    }
    else {
      // if both keyframe generators are unspecified, make them return empty keyframes array
      if (!generatorSet.keyframesGenerator_play && !generatorSet.keyframesGenerator_rewind) {
        generatorSetMetadata.noKeyframes = true;
        generatorSet.keyframesGenerator_play = () => [];
        generatorSet.keyframesGenerator_rewind = () => [];
      }
      // if backward keyframes generator is unspecified, use forward generator and set mirrored to true
      else if (!generatorSet.keyframesGenerator_rewind) {
        generatorSet.keyframesGenerator_rewind = generatorSet.keyframesGenerator_play!;
        generatorSetMetadata.bFramesMirrored = true;
      }
      // if forward keyframes generator is unspecified, throw error
      else if (!generatorSet.keyframesGenerator_play) {
        throw new CustomErrorClasses.InvalidEffectError(
          `The backward keyframes generator cannot be specified without the forward keyframes generator as well.`
        );
      }

      // if both RAF generators are unspecified, do nothing
      if (!generatorSet.mutatorGenerator_play && !generatorSet.mutatorGenerator_rewind) {
        generatorSetMetadata.noRaf = true;
      }
      // if backward RAF mutator generator is unspecified, use forward generator and set mirrored to true
      else if (!generatorSet.mutatorGenerator_rewind) {
        generatorSet.mutatorGenerator_rewind = generatorSet.mutatorGenerator_play;
        generatorSetMetadata.bRafMirrored = true;
      }
      // if forward RAF mutator generator is unspecified, throw error
      else if (!generatorSet.mutatorGenerator_play) {
        throw new CustomErrorClasses.InvalidEffectError(
          `The backward mutator generator cannot be specified without the forward mutator generator as well.`
        );
      }
    }
  }

  private loop = (): void => {
    const rafMutators = this.rafMutators;
    const nestedRafMutators = this.nestedRafMutators;
    try {
      switch(this.animation.direction) {
        case "forward":
          rafMutators.forwardMutator?.();
          for (let i = 0; i < nestedRafMutators.forwardMutators.length; ++i) {
            nestedRafMutators.forwardMutators[i]();
          }
          break;
        case "backward":
          rafMutators.backwardMutator?.();
          for (let i = 0; i < nestedRafMutators.backwardMutators.length; ++i) {
            nestedRafMutators.backwardMutators[i]();
          }
          break;
        default: throw this.generateError(Error, [`Something very wrong occurred for there to be an error here.`]);
      }
    }
    catch (err: unknown) { throw this.generateError(err as Error); }

    if (this.rafLoopsProgress === 1) { return; }
    requestAnimationFrame(this.loop);
  }

  /**
   * Calculates the value partway between two fixed numbers (an initial value and a final value)
   * based on the progress of the animation.
   *  * Intended for use inside {@link EffectFrameGeneratorSet.mutatorGenerator_play} and {@link EffectFrameGeneratorSet.mutatorGenerator_rewind}.
   * @param initialVal - The starting value.
   * @param finalVal - The ending value.
   * @returns The number that is a percentage of the way between `initialVal` and `finalVal` based on the percentage of completion of the animation (playing or rewinding).
   * 
   * @see {@link EffectFrameGeneratorSet}
   * 
   * @example
   * <!-- EX:S id="AnimClip.computeTween-1" code-type="ts" -->
   * ```ts
   * const {Entrance} = webchalk.createAnimationClipFactories({
   *   additionalEntranceEffectBank: {
   *     rotate: {
   *       buildFrameGenerators(degrees: number) {
   *         return {
   *           // when playing, keep computing the value between 0 and 'degrees'
   *           mutatorGenerator_play: () => () => { this.domElem.style.rotate = this.computeTween(0, degrees)+'deg'; },
   *           // when rewinding, keep computing the value between 'degrees' and 0
   *           mutatorGenerator_rewind: () => () => { this.domElem.style.rotate = this.computeTween(degrees, 0)+'deg'; }
   *         };
   *       }
   *     }
   *   },
   * });
   * 
   * const someElement = document.querySelector('.some-element');
   * 
   * (async () => {
   *   await Entrance(someElement, 'rotate', [360], {duration: 2000}).play();
   *   // ↑ At 1.5 seconds (or 1500ms), the animation is 1.5/2 = 75% done playing.
   *   // Thus, computeTween(0, 360) at that exactly moment would...
   *   // return the value 75% of the way between 0 and 360 (= 270).
   *   // Therefore, at 1.5 seconds of playing, someElement's rotation is set to "270deg".
   *   
   *   await Entrance(someElement, 'rotate', [360], {duration: 2000}).rewind();
   *   // ↑ At 0.5 seconds (or 500ms), the animation is 0.5/2 = 25% done rewinding.
   *   // Thus, computeTween(360, 0) at that exactly moment would...
   *   // return the value 25% of the way between 360 and 0 (= 270).
   *   // Therefore, at 0.5 seconds of rewinding, someElement's rotation is set to "270deg".
   * })();
   * ```
   * <!-- EX:E id="AnimClip.computeTween-1" -->
   * 
   * @group Helper Methods
   */
  computeTween(initialVal: number, finalVal: number): number {
    // if animation progress is complete and commitsStyles is false,
    // return the initial value
    if (this.rafLoopsProgress === 1 && this.config.commitsStyles === false) {
      return initialVal;
    }

    // if using a mirror for the backward mutator, computeTween() should flip the progress
    // if mutators are reversed, computeTween() should flip the progress
    const flipProgress = xor(
      // this.animation.direction === 'backward' && this.effectFrameGeneratorSetMetadata.bRafMirrored,
      this.direction === 'backward'
        && new Error().stack?.includes('mutatorGenerator_play' as keyof Pick<EffectFrameGeneratorSet, 'mutatorGenerator_play'>),
      this.effectFrameGeneratorSet.reverseMutatorEffect
    );

    // return linear interpolation between initial value and final value based on progress of animation
    return initialVal + (finalVal - initialVal) * (flipProgress ? 1 - this.rafLoopsProgress : this.rafLoopsProgress);
  }

  /*-:**************************************************************************************************************************/
  /*-:***************************************         OPERATIONS         *******************************************************/
  /*-:**************************************************************************************************************************/
  // TODO: Make compare() work for subclass-specific properties as well.
  // TODO: Add code examples.
  /**
   * Compares this animation clip with another animation clip on the specified fields and returns `true` only if the fields are equivalent.
   * Possible fields for comparison are
   *  * {@link AnimClip.domElem|domElem},
   *  * {@link AnimClipEffectDetails.category|category},
   *  * {@link AnimClipEffectDetails.effectName|effectName},
   *  * {@link AnimClipEffectDetails.effectOptions|effectOptions},
   *  * {@link AnimClipTiming.duration|duration},
   *  * {@link AnimClipTiming.delay|delay},
   *  * {@link AnimClipTiming.endDelay|endDelay},
   *  * {@link AnimClipTiming.startsNextClipToo|startsNextClipToo},
   *  * {@link AnimClipTiming.startsWithPrevious|startsWithPrevious},
   *  * {@link AnimClipTiming.playbackRate|playbackRate},
   * @remarks
   * If no fields are specified, all of the possible options for comparison are tested.
   * @param otherClip - The clip to compare the current clip to.
   * @param fields - An array of strings indicating which fields to compare the clips on.
   * @returns A boolean value indicating the result of comparing the clips on the specified fields.
   * @group Operations
   */
  compare<TClip extends AnimClip>(
    otherClip: TClip,
    fields: (
      keyof Pick<AnimClip,
        'domElem'
      >
      | keyof Pick<ReturnType<AnimClip['getEffectDetails']>, 'category' | 'effectName' | 'effectOptions'>
      | keyof Pick<ReturnType<AnimClip['getTiming']>, 'duration' | 'delay' | 'endDelay' | 'startsNextClipToo' | 'startsWithPrevious' | 'playbackRate'>
    )[]
  ): boolean {
    let isEquivalent = true;

    for (const field of fields) {
      if (field === 'domElem') { isEquivalent &&= this.domElem === otherClip.domElem; }
      else if (field === 'category') { isEquivalent &&= this.category === otherClip.category; }
      else if (field === 'effectName') { isEquivalent &&= this.effectName === otherClip.effectName; }
      else if (field === 'effectOptions') { isEquivalent &&= deepComparison(this.effectOptions, otherClip.effectOptions); }
      else if (field === 'duration') {  isEquivalent &&= this.getTiming('duration') === otherClip.getTiming('duration'); }
      else if (field === 'delay') {  isEquivalent &&= this.getTiming('delay') === otherClip.getTiming('delay'); }
      else if (field === 'endDelay') {  isEquivalent &&= this.getTiming('endDelay') === otherClip.getTiming('endDelay'); }
      else if (field === 'playbackRate') {  isEquivalent &&= this.getTiming('playbackRate') === otherClip.getTiming('playbackRate'); }
      else if (field === 'startsNextClipToo') {  isEquivalent &&= this.getTiming('startsNextClipToo') === otherClip.getTiming('startsNextClipToo'); }
      else if (field === 'startsWithPrevious') {  isEquivalent &&= this.getTiming('startsWithPrevious') === otherClip.getTiming('startsWithPrevious'); }
    }

    return isEquivalent;
  }

  /*-:**************************************************************************************************************************/
  /*-:*****************************************         ERRORS         *********************************************************/
  /*-:**************************************************************************************************************************/
  protected generateError: ClipErrorGenerator = (ErrorClassOrInstance, msg = ['<unspecified error>'], elementOverride?: DOMElement) => {
    return generateError(ErrorClassOrInstance, msg as [logMessageStr: string, uiMessageFrags?: ErrorUIMessageFragments], {
      timeline: this._parentTimeline,
      sequence: this._parentSequence,
      clip: this,
      element: elementOverride ? elementOverride : this.domElem
    });
  }

  private throwChildPlaybackError(funcName: string): never {
    throw this.generateError(CustomErrorClasses.ChildPlaybackError, [`Cannot directly call ${funcName}() on an animation clip while it is part of a sequence.`]);
  }

  protected preventConnector() {
    if (this.domElem instanceof WebchalkConnectorElement) {
      throw this.generateError(CustomErrorClasses.InvalidElementError,
        [`Connectors cannot be animated using ${this.category}().` +
        `${errorTip(`Tip: WebchalkConnectorElement elements cannot be animated using Entrance() or Exit() because many of the animations are not really applicable.` +
          ` Instead, any entrance or exit effects that make sense for connectors are defined in ConnectorEntrance() and ConnectorExit().`
        )}`],
        this.domElem
      );
    }
  }
}

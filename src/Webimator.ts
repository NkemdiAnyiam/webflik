import { AnimClip} from "./1_playbackStructures/AnimationClip";
import {
  EntranceClip, ExitClip, EmphasisClip, MotionClip, ScrollerClip, TransitionClip,
  ConnectorEntranceClip, ConnectorExitClip, ConnectorSetterClip,
} from "./1_playbackStructures/AnimationClipCategories";
import { Layer3MutableClipConfig } from "./2_animationEffects/generationTypes";
import { AnimSequence, AnimSequenceConfig } from "./1_playbackStructures/AnimationSequence";
import { AnimTimeline, AnimTimelineConfig } from "./1_playbackStructures/AnimationTimeline";
import { WbmtrConnector, WbmtrConnectorConfig } from "./3_components/WbmtrConnector";
import {
  libPresetEntrances, libPresetExits, libPresetEmphases, libPresetMotions,
  libPresetConnectorEntrances, libPresetConnectorExits, libPresetScrolls, libPresetTransitions
} from "./2_animationEffects/libraryPresetBanks";
import { useEasing } from "./2_animationEffects/easing";
import { MultiUnitPlacementX, MultiUnitPlacementY, ScrollingOptions } from "./4_utils/interfaces";
import { WbmtrPlaybackButton } from "./3_components/WbmtrPlaybackButton";
import { EffectGeneratorBank, EffectNameIn, EffectGenerator } from "./2_animationEffects/generationTypes";

/**
 * @hideconstructor
 */
export class Webimator {
  // used to prevent direct calls to playback structures' constructors
  /**@internal*/ sequenceCreatorLock = true;
  /**@internal*/ timelineCreatorLock = true;
  /**@internal*/ clipCreatorLock = true;

  newSequence(config: Partial<AnimSequenceConfig>, ...animClips: AnimClip[]): AnimSequence;
  newSequence(...animClips: AnimClip[]): AnimSequence;
  newSequence(config: Partial<AnimSequenceConfig> | AnimClip = {}, ...animClips: AnimClip[]): AnimSequence {
    this.sequenceCreatorLock = false;
    const sequence = new AnimSequence(config, ...animClips);
    return sequence;
  }

  newTimeline(config: Partial<AnimTimelineConfig>, ...animSequences: AnimSequence[]): AnimTimeline;
  newTimeline(...animSequences: AnimSequence[]): AnimTimeline;
  newTimeline(config: Partial<AnimTimelineConfig> | AnimSequence = {}, ...animSequences: AnimSequence[]): AnimTimeline {
    this.timelineCreatorLock = false;
    const timeline = new AnimTimeline(config, ...animSequences);
    return timeline;
  }
  
  readonly classes = Object.freeze({
    AnimTimeline,
    AnimSequence,
    AnimClip,
    EntranceClip,
    ExitClip,
    EmphasisClip,
    MotionClip,
    TransitionClip,
    ScrollerClip,
    ConnectorSetterClip,
    ConnectorEntranceClip,
    ConnectorExitClip,
    WbmtrConnector,
    WbmtrPlaybackButton,
  });

  /**
   * Creates functions that return {@link AnimClip}s for specific effect categories. A clip for a given category can use
   *  a single preset animation effect from the effects bank of the same category. For example,
   * `createAnimationClipFactories().Entrance(someElement, '~appear', [])` will use the "\~appear" animation effect from the
   * bank of entrance animation effects, but the "\~appear" animation will obviously not be found in the bank of exit animation
   * effects, so `createAnimationClipFactories().Exit(someElement, '~appear', [])` will throw an error.
   * - Developers may add their own custom animations to the Entrance, Exit, Emphasis, and Motion categories by using the
   * {@link customPresetEffectBanks} parameter.
   * @param customPresetEffectBanks - optional object containing additional banks that the developer can use to add their own custom preset effects
   * @param customPresetEffectBanks.customEntranceEffects - objects of type {@link EffectGeneratorBank}, containing keys that represent effect names and values that are {@link EffectGenerator}s to be used with the `Entrance()` clip factory function
   * @param customPresetEffectBanks.customExitEffects - objects of type {@link EffectGeneratorBank}, containing keys that represent effect names and values that are {@link EffectGenerator}s to be used with the `Exit()` clip factory function
   * @param customPresetEffectBanks.customEmphasisEffects - objects of type {@link EffectGeneratorBank}, containing keys that represent effect names and values that are {@link EffectGenerator}s to be used with the `Emphasis()` clip factory function
   * @param customPresetEffectBanks.customMotionEffects - objects of type {@link EffectGeneratorBank}, containing keys that represent effect names and values that are {@link EffectGenerator}s to be used with the `Motion()` clip factory function
   * @returns Factory functions that return category-specific {@link AnimClip}s, each with intellisense for their category-specific effects banks.
   * 
   * @example
    ```ts
    // Using the method and using one of the `Entrance()` factory function
    const clipFactories = webimator.createAnimationClipFactories();
    const ent = clipFactories.Entrance(someElement, '~fly-in', ['from-top'], {duration: 2000});
    ent.play();
    ```
   * 
   * @example
    ```ts
    // Using destructuring assignment to conveniently extract the `Entrance()` and `Motion()` factory functions
    const {Entrance, Motion} = webimator.createAnimationClipFactories();
    const ent = Entrance(someElement, '~fly-in', ['from-top'], {duration: 2000});
    const mot1 = Motion(someElement, '~translate', [{translateX: '500px'}], {duration: 1000});
    const mot2 = Motion(someElement, '~translate', [{translateY: '500px'}], {duration: 500});
    // clips are added to a sequence
    const seq = webimator.newSequence(ent, mot1, mot2);
    seq.play();
   * ```
   * 
   * @example
   * ```ts
   * // Extending the preset entrances and motions banks with custom effects
    const clipFactories = webimator.createAnimationClipFactories({
      // CUSTOM ENTRANCES
      customEntranceEffects: {
        coolZoomIn: {
          generateKeyframes(initialScale: number) {
            return {
              forwardFrames: [
                {scale: initialScale, opacity: 0},
                {scale: 1, opacity: 1}
              ],
              // (backwardFrames could have been omitted in this case because
              // the reversal of forwardFrames is exactly equivalent)
              backwardFrames: [
                {scale: 1, opacity: 1},
                {scale: initialScale, opacity: 0}
              ]
            };
          }
        },

        blinkIn: {
          generateKeyframes() {
            return {
              forwardFrames: [
                {opacity: 0}, {opacity: 1}, {opacity: 0}, {opacity: 1}, {opacity: 0}, {opacity: 1}
              ],
              // (backwardFrames omitted because the reversal of forwardFrames is exactly equivalent)
            };
          }
        }
      },

      // CUSTOM EXITS
      customExitEffects: {
        // a custom animation effect for flying out to the left side of the screen
        flyOutLeft: {
          generateKeyframeGenerators() {
            const computeTranslationStr = () => {
              const orthogonalDistance = -(this.domElem.getBoundingClientRect().right);
              const translationString = `${orthogonalDistance}px 0px`;
              return translationString;
            }
      
            return {
              forwardGenerator: () => {
                return [
                  {translate: computeTranslationStr()}
                ];
              },
              // backwardGenerator could have been omitted because the result of running forwardGenerator()
              // again and reversing the keyframes produces the same desired rewinding effect in this case
              backwardGenerator: () => {
                return [
                  {translate: computeTranslationStr()},
                  {translate: `0 0`}
                ];
              }
            };
          },
          
          immutableConfig: {
            // this means that the translation is added onto the element's position instead of replacing it
            composite: 'accumulate',
          }
        },
      }
    });

    // the custom animations you created are now valid as well as detected by TypeScript
    const ent1 = clipFactories.Entrance(someElement, 'coolZoomIn', [0.2]);
    const ent2 = clipFactories.Entrance(someElement, 'blinkIn', []);
    const ext = clipFactories.Exit(someElement, 'flyOutLeft', []);
   * ```
   */
  createAnimationClipFactories
  <
   // default = {} ensures intellisense for a given bank still works
   // without specifying the field (why? not sure)
    CustomEntranceBank extends EffectGeneratorBank<EntranceClip> = {},
    CustomExitBank extends EffectGeneratorBank<ExitClip> = {},
    CustomEmphasisBank extends EffectGeneratorBank<EmphasisClip> = {},
    CustomMotionBank extends EffectGeneratorBank<MotionClip> = {},
    _EmptyTransitionBank extends EffectGeneratorBank<TransitionClip> = {},
    _EmptyConnectorEntranceBank extends EffectGeneratorBank<ConnectorEntranceClip> = {},
    _EmptyConnectorExitBank extends EffectGeneratorBank<ConnectorExitClip> = {},
    _EmptyScrollerBank extends EffectGeneratorBank<ScrollerClip> = {},
    IncludeLibPresets extends boolean = true
  >
  (
    customPresetEffectBanks: {
      /** object of type {@link EffectGeneratorBank}, containing keys that represent effect names and values that are {@link EffectGenerator}s to be used with `Entrance()` clip factory function */
      customEntranceEffects?: CustomEntranceBank & EffectGeneratorBank<EntranceClip>;
      /** object of type {@link EffectGeneratorBank}, containing keys that represent effect names and values that are {@link EffectGenerator}s to be used with the `Exit()` clip factory function */
      customExitEffects?: CustomExitBank & EffectGeneratorBank<ExitClip>;
      /** object of type {@link EffectGeneratorBank}, containing keys that represent effect names and values that are {@link EffectGenerator}s to be used with the `Emphasis()` clip factory function */
      customEmphasisEffects?: CustomEmphasisBank & EffectGeneratorBank<EmphasisClip>;
      /** object of type {@link EffectGeneratorBank}, containing keys that represent effect names and values that are {@link EffectGenerator}s to be used with the `Motion()` clip factory function */
      customMotionEffects?: CustomMotionBank & EffectGeneratorBank<MotionClip>;
    } = {},
    /**
     * if `false`, the preset effects that normally come with the framework will be excluded
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    includeLibraryPresets: IncludeLibPresets | void = true as IncludeLibPresets
  ) {
    const {customEntranceEffects, customExitEffects, customEmphasisEffects, customMotionEffects} = customPresetEffectBanks as {
      customEntranceEffects?: CustomEntranceBank & EffectGeneratorBank<EntranceClip>;
      customExitEffects?: CustomExitBank & EffectGeneratorBank<ExitClip>;
      customEmphasisEffects?: CustomEmphasisBank & EffectGeneratorBank<EmphasisClip>;
      customMotionEffects?: CustomMotionBank & EffectGeneratorBank<MotionClip>;
    };
    Webimator.checkBanksFormatting(customEntranceEffects, customExitEffects, customEmphasisEffects, customMotionEffects);

    type TogglePresets<TLibBank, TCustomBank> = Readonly<(IncludeLibPresets extends true ? TLibBank : {}) & TCustomBank>;

    const mergeBanks = <L, U>(libraryBank: L, customBank: U) => {
      const combinedBank = {...(includeLibraryPresets ? libraryBank : {}), ...(customBank ?? {})} as EffectGeneratorBank;
      // // set effectName and sourceBank properties of each generator to thier obviously corresponding values
      // // Object.assign circumvents the Readonly<>, preventing a TS error
      // for (const key in combinedBank) {
      //   const extras = { effectName: key, sourceBank: combinedBank } satisfies Partial<EffectGenerator>;
      //   Object.assign(combinedBank[key], extras);
      // }
      return combinedBank as TogglePresets<L, U>;
    }
    
    // Merge the library preset banks with any custom banks addons from layer 4
    const combinedEntranceBank = mergeBanks(libPresetEntrances, customEntranceEffects as CustomEntranceBank);
    const combinedExitBank = mergeBanks(libPresetExits, customExitEffects as CustomExitBank);
    const combinedEmphasisBank = mergeBanks(libPresetEmphases, customEmphasisEffects as CustomEmphasisBank);
    const combinedMotionBank = mergeBanks(libPresetMotions, customMotionEffects as CustomMotionBank);
    const combinedTransitionBank = mergeBanks(libPresetTransitions, {} as _EmptyTransitionBank);
    const combinedConnectorEntranceBank = mergeBanks(libPresetConnectorEntrances, {} as _EmptyConnectorEntranceBank);
    const combinedConnectorExitBank = mergeBanks(libPresetConnectorExits, {} as _EmptyConnectorExitBank);
    const combinedScrollerBank = mergeBanks(libPresetScrolls, {} as _EmptyScrollerBank);

    const self = this;
    // return functions that can be used to instantiate AnimClips with intellisense for the combined banks
    return {
      Entrance: function<TGeneratorBank extends typeof combinedEntranceBank, TEffectName extends EffectNameIn<TGeneratorBank>, TEffectGenerator extends TGeneratorBank[TEffectName]>(
        domElem: Element | null | undefined,
        effectName: TEffectName,
        ...initializationParams: Parameters<EntranceClip<TEffectGenerator>['initialize']>
      ) {
        self.clipCreatorLock = false;
        return new EntranceClip<TEffectGenerator>(domElem, effectName, combinedEntranceBank).initialize(...initializationParams);
      },

      Exit: function<TGeneratorBank extends typeof combinedExitBank, TEffectName extends EffectNameIn<TGeneratorBank>, TEffectGenerator extends TGeneratorBank[TEffectName]>(
        domElem: Element | null | undefined,
        effectName: TEffectName,
        ...initializationParams: Parameters<ExitClip<TEffectGenerator>['initialize']>
      ) {
        self.clipCreatorLock = false;
        return new ExitClip<TEffectGenerator>(domElem, effectName, combinedExitBank).initialize(...initializationParams);
      },

      Emphasis: function<TGeneratorBank extends typeof combinedEmphasisBank, TEffectName extends EffectNameIn<TGeneratorBank>, TEffectGenerator extends TGeneratorBank[TEffectName]>(
        domElem: Element | null | undefined,
        effectName: TEffectName,
        ...initializationParams: Parameters<EmphasisClip<TEffectGenerator>['initialize']>
      ) {
        self.clipCreatorLock = false;
        return new EmphasisClip<TEffectGenerator>(domElem, effectName, combinedEmphasisBank).initialize(...initializationParams);
      },

      Motion: function<TGeneratorBank extends typeof combinedMotionBank, TEffectName extends EffectNameIn<TGeneratorBank>, TEffectGenerator extends TGeneratorBank[TEffectName]>(
        domElem: Element | null | undefined,
        effectName: TEffectName,
        ...initializationParams: Parameters<MotionClip<TEffectGenerator>['initialize']>
      ) {
        self.clipCreatorLock = false;
        return new MotionClip<TEffectGenerator>(domElem, effectName, combinedMotionBank).initialize(...initializationParams);
      },

      Transition: function<TGeneratorBank extends typeof combinedTransitionBank, TEffectName extends EffectNameIn<TGeneratorBank>, TEffectGenerator extends TGeneratorBank[TEffectName]>(
        domElem: Element | null | undefined,
        effectName: TEffectName,
        ...initializationParams: Parameters<TransitionClip<TEffectGenerator>['initialize']>
      ) {
        self.clipCreatorLock = false;
        return new TransitionClip<TEffectGenerator>(domElem, effectName, combinedTransitionBank).initialize(...initializationParams);
      },

      ConnectorSetter: function(
        connectorElem: WbmtrConnector | null | undefined,
        pointA: [elemA: Element | null | undefined, xPlacement: number | MultiUnitPlacementX, yPlacement: number | MultiUnitPlacementY] | ['preserve'],
        pointB: [elemB: Element | null | undefined, xPlacement: number | MultiUnitPlacementX, yPlacement: number | MultiUnitPlacementY] | ['preserve'],
        connectorConfig: WbmtrConnectorConfig = {} as WbmtrConnectorConfig
      ) {
        self.clipCreatorLock = false;
        const effectName = `~set-line-points`;
        return new ConnectorSetterClip(
          connectorElem, pointA, pointB, effectName, {[effectName]: {...AnimClip.createNoOpEffectGenerator(), /*effectName*/}}, connectorConfig
        ).initialize([]);
      },

      ConnectorEntrance: function<
        TGeneratorBank extends typeof combinedConnectorEntranceBank, TEffectName extends EffectNameIn<TGeneratorBank>, TEffectGenerator extends TGeneratorBank[TEffectName]
      >(
        connectorElem: WbmtrConnector | null | undefined,
        effectName: TEffectName,
        ...initializationParams: Parameters<ConnectorEntranceClip<TEffectGenerator>['initialize']>
      ) {
        self.clipCreatorLock = false;
        return new ConnectorEntranceClip<TEffectGenerator>(connectorElem, effectName, combinedConnectorEntranceBank).initialize(...initializationParams);
      },

      ConnectorExit: function<TGeneratorBank extends typeof combinedConnectorExitBank, TEffectName extends EffectNameIn<TGeneratorBank>, TEffectGenerator extends TGeneratorBank[TEffectName]>(
        connectorElem: WbmtrConnector | null | undefined,
        effectName: TEffectName,
        ...initializationParams: Parameters<ConnectorExitClip<TEffectGenerator>['initialize']>
      ) { 
        self.clipCreatorLock = false;
        return new ConnectorExitClip<TEffectGenerator>(connectorElem, effectName, combinedConnectorExitBank).initialize(...initializationParams);
      },
      
      Scroller: function<TGeneratorBank extends typeof combinedScrollerBank, TEffectName extends EffectNameIn<TGeneratorBank>, TEffectGenerator extends TGeneratorBank[TEffectName]>
      (
        domElem: Element | null | undefined,
        effectName: TEffectName,
        ...initializationParams: Parameters<ScrollerClip<TEffectGenerator>['initialize']>
      ) {
        self.clipCreatorLock = false;
        return new ScrollerClip<TEffectGenerator>(domElem, effectName, combinedScrollerBank).initialize(...initializationParams);
      },
    };
  }

  /**@internal*/
  scrollAnchorsStack: [target: Element, scrollOptions: ScrollingOptions][] = [];

  get utils() {
    return {
      useEasing,
    };
  }

  private static checkBanksFormatting(...banks: (EffectGeneratorBank | undefined)[]) {
    const errors: string[] = [];
    
    const checkForArrowFunctions = (bank?: EffectGeneratorBank) => {
      if (!bank) { return; }
      for (const animName in bank) {
        const entry = bank[animName];
        const generator = entry.generateKeyframes ?? entry.generateKeyframeGenerators ?? entry.generateRafMutators ?? entry.generateRafMutatorGenerators;
        if (generator.toString().match(/^\(.*\) => .*/)) {
          errors.push(`"${animName}"`);
        }
      }
    };

    for (const bank of banks) { checkForArrowFunctions(bank); }

    if (errors.length > 0) {
      throw new SyntaxError(
        `Arrow functions are not allowed to be used as generators. Detected in the following animation definitions:${errors.map(msg => `\n${msg}`)}`
      );
    }
  }
}

/**
 * @ignore
 */
export const webimator = new Webimator();

// const thing =  webimator.createAnimationClipFactories({
//   customEntranceEffects: {
//     hello: {
//       generateKeyframes() { return {
//         forwardFrames: []
//       } },
//       defaultConfig: {
        
//       },
//       immutableConfig: {
//         duration: 0
//       }
//     }
//   }
// }).Entrance(new HTMLElement(), '~appear', [], {}).getModifiers();

export type {
  AnimClipConfig,
  AnimClipEffectDetails,
  AnimClipModifiers,
  AnimClipStatus,
  AnimClipTiming,
  CssClassOptions,
  ScheduledTask,
} from "../1_playbackStructures/AnimationClip";
export {
  AnimClip,
} from "../1_playbackStructures/AnimationClip";

export type {
  ConnectorEntranceClipConfig,  
  ConnectorEntranceClipModifiers,
  ConnectorExitClipConfig,
  ConnectorSetterClipConfig,
  EmphasisClipConfig,
  EntranceClipConfig,
  EntranceClipModifiers,
  ExitClipConfig,
  Layer4MutableConfig,
  MotionClipConfig,
  ScrollerClipConfig,
  TransitionClipConfig,
  TransitionClipModifiers,
} from "../1_playbackStructures/AnimationClipCategories";
export {
  ConnectorEntranceClip,
  ConnectorExitClip,
  ConnectorSetterClip,
  EmphasisClip,
  EntranceClip,
  ExitClip,
  MotionClip,
  ScrollerClip,
  TransitionClip,
} from "../1_playbackStructures/AnimationClipCategories";

export type {
  AddClipsOptions,
  AnimSequenceConfig,
  AnimSequenceStatus,
  AnimSequenceTiming,
} from "../1_playbackStructures/AnimationSequence";
export {
  AnimSequence
} from "../1_playbackStructures/AnimationSequence";

export type {
  AnimTimelineConfig,
  AnimTimelineStatus,
  AnimTimelineTiming,
  AddSequencesOptions
} from "../1_playbackStructures/AnimationTimeline";
export {
  AnimTimeline,
} from "../1_playbackStructures/AnimationTimeline";


export type {
  WebchalkConnectorElementConfig,
} from "../3_components/WebchalkConnectorElement";
export {
  WebchalkConnectorElement,
} from "../3_components/WebchalkConnectorElement";

// export {
//   WebchalkPlaybackButtonElement,
// } from "../3_components/WebchalkPlaybackButtonElement";

export type * from "../4_utils/interfaces";

export type { EffectFrameGeneratorSet, PresetEffectDefinition, PresetEffectBank, EffectNameIn, EffectOptions } from "../2_animationEffects/presetEffectCreation";

export type { PresetLinearEasingKey, EasingString, TrivialCssEasingFunction } from "../2_animationEffects/easing";

export type {
  ClipErrorGenerator,
  SequenceErrorGenerator,
  TimelineErrorGenerator,
  GeneralErrorGenerator,
} from "../4_utils/errors";
export {
  CustomErrorClasses,
} from "../4_utils/errors";

import {Hook} from "@feathersjs/feathers";

export type ChannelInfo = {
  upHoldLevel?: number;
  downHoldLevel?: number;
  upMaximumLevel?: number;
  downMinimumLevel?: number;
  upHoldDelay?: number;
  downHoldDelay?: number;
  upIncrement?: number;
  downDecrement?: number;
  upIncrementDelay?: number;
  downDecrementDelay?: number;
  startDelay?: number;
  effectId?: number;

  direction?: "inc" | "incDec" | "dec" | "decInc"
  transition?: boolean;
}

export type StateInfo = {
  red: ChannelInfo,
  green: ChannelInfo,
  blue: ChannelInfo,
}

export type StateChangeRequest = {
  key: string;
  data: StateInfo;
}

export type Signal = number | "nosignal";

export type SignalProviderPlugin = {
  signals: {
    name: string;
    description?: string;
    tags: string[];
    source: SignalSource;
  }[];
}

export type SignalSource = PollingSource | PollingCallbackSource | HookSource;

export type PollingSource = {
  type: "polling",
  interval: number, // how often to poll in seconds
  poll: () => Signal,
};

export type PollingCallbackSource = {
  type: "pollingCallback",
  interval: number, // how often to poll in seconds
  poll: (callback: (signal: Signal) => void) => void,
}

export type HookSource = {
  type: "hook",
  attach: (callback: (signal: Signal) => void) => void,
};

export type ChannelAnimation = {
  // these are all numeric values, optionally using a math expression

  upHoldLevel: string;
  downHoldLevel: string;

  upMaximumLevel: string;
  downMinimumLevel: string;

  upHoldDelay: string;
  downHoldDelay: string;

  upIncrement: string;
  downDecrement: string;

  startDelay: string;
  effectId: string;

  effectFlag: string;
};

export type Animation = {
  red: ChannelAnimation;
  green: ChannelAnimation;
  blue: ChannelAnimation;
};

/**
 This structure maps a signal to a set of animations on the keyboard.

 Each range maps a upper and lower bound of the signal value to a certain animation.
 */
export type SignalMapping = {
  signal: string; // the signal you're mapping
  ranges: {
    start: number;
    startInclusive: boolean;
    end: number;
    endInclusive: boolean;
    activatedAnimation: Animation | null; // the animation to use when the key is active, null to inherit the profile animation
    notActivatedAnimation: Animation | null; // the animation to use when the key is not active, null to inherit the profile animation
  }[];
  layouts: {
    [layout: string]: {
      keyGroups: string[][];
      mode: "all" | // all key groups get the same animation
        "multi" | // key groups will progressively be activated with all being the same color
        "multiSingle" | // only the highest key group will be activated
        "multiSplit" // activated key groups will have the signal value <= their end range
    }
  };
  fadeTime: string; // e.g. "start - end"
};

export type Profile = {
  defaultAnimations: {
    [layout: string]: {
      key: string;
      animation: Animation;
    }[];
  };
  enabledSignals: string[] | string;
};
export interface ChannelInfo {
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

    direction?: "inc" | "incDec" | "dec" | "decInc";
    transition?: boolean;
}

export interface StateInfo {
    red: ChannelInfo;
    green: ChannelInfo;
    blue: ChannelInfo;
}

export interface StateChangeRequest {
    key: string;
    data: StateInfo;
}

export type Signal = number | "nosignal";

export interface PluginSignal {
    name: string;
    description?: string;
    tags: string[];
    source: SignalSource;
}

export interface SignalProviderPlugin {
    signals: PluginSignal[];
}

export type SignalSource = PollingSource | PollingCallbackSource | HookSource;

export interface PollingSource {
    type: "polling";
    interval: number; // how often to poll in seconds
    poll: () => Signal;
}

export interface PollingCallbackSource {
    type: "pollingCallback";
    interval: number; // how often to poll in seconds
    poll: (callback: (signal: Signal) => void) => void;
}

export interface HookSource {
    type: "hook";
    attach: (callback: (signal: Signal) => void) => { unhook: () => void };
}

export interface ChannelAnimation {
    // these are all numeric values, optionally using a math expression

    upHoldLevel?: string;
    downHoldLevel?: string;

    upMaximumLevel?: string;
    downMinimumLevel?: string;

    upHoldDelay?: string;
    downHoldDelay?: string;

    upIncrement?: string;
    downDecrement?: string;
    
    upIncrementDelay?: string;
    downDecrementDelay?: string;

    startDelay?: string;
    effectId?: string;

    direction?: string;
    transition?: string;
}

export interface Animation {
    red: ChannelAnimation;
    green: ChannelAnimation;
    blue: ChannelAnimation;
}

/**
 This structure maps a signal to a set of animations on the keyboard.

 Each range maps a upper and lower bound of the signal value to a certain animation.
 */
export interface SignalMapping {
    signal: string; // the signal you're mapping
    min: 0;
    max: 100;
    ranges: Array<{
        start: number;
        startInclusive: boolean;
        end: number;
        endInclusive: boolean;
        activatedAnimation: Animation | null; // the animation to use when the key is active, null to inherit the profile animation
        notActivatedAnimation: Animation | null; // the animation to use when the key is not active, null to inherit the profile animation
    }>;
    layouts: {
        [layout: string]: {
            keyGroups: string[][];
            mode: "all" | // all key groups get the same animation (|g|g|g| -> |y|y|y| -> |r|r|r|)
                "multi" | // key groups will progressively be activated, all having the same animation (|g|.|.| -> |y|y|.| -> |r|r|r|)
                "multiSingle" | // only the highest key group will be activated (|g|.|.| -> |.|y|.| -> |.|.|r|)
                "multiSplit" // activated key groups will have the signal value <= their end range (|g|.|.| -> |g|y|.| -> |g|y|r|)
        }
    };
}

export interface Profile {
    name: string;
    description?: string;
    defaultAnimations: {
        [layout: string]: StateChangeRequest[];
    };
    uuid: string;
    enabledSignals: string[] | string;
}
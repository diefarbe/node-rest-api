import * as math from "mathjs";
import { KeyboardModule } from "./modules/keyboard";
import { SettingsModule } from "./modules/settings";
import {
    Animation, ChannelAnimation, ChannelInfo,
    PluginSignal,
    Profile,
    Signal, SignalMapping,
    SignalProviderPlugin, StateChangeRequest, StateInfo
} from "./types";

const requirePath = require("require-path");

interface EnabledSignal {
    pluginSignal: PluginSignal;
    timer: NodeJS.Timer | null;
    hook: { unhook: () => void } | null;
}

const NULL_PROFILE: Profile = {
    name: "NULL",
    uuid: "null",
    enabledSignals: [],
    defaultAnimations: {}
};
let activeProfile: Profile = NULL_PROFILE;

const signalPlugins: SignalProviderPlugin[] = [];
const enabledSignalPlugins: EnabledSignal[] = [];

const signals = new Map<string, Signal>();

let layout: string;

let settings: SettingsModule;
let keyboard: KeyboardModule;

// TODO ensure no gaps in ranges and they fall between min and max
const signalMappings: SignalMapping[] = [{
    signal: "cpu_utilization_max",
    min: 0,
    max: 100,
    ranges: [{
        start: 0,
        startInclusive: true,
        end: 60,
        endInclusive: true,
        activatedAnimation: solidColor("00FF00"),
        notActivatedAnimation: null,
    }, {
        start: 60,
        startInclusive: false,
        end: 80,
        endInclusive: true,
        activatedAnimation: solidColor("FFFF00"),
        notActivatedAnimation: null,
    }, {
        start: 80,
        startInclusive: false,
        end: 99,
        endInclusive: true,
        activatedAnimation: solidColor("FF0000"),
        notActivatedAnimation: null,
    }, {
        start: 99,
        startInclusive: false,
        end: 100,
        endInclusive: true,
        activatedAnimation: solidColorFlashing("FF0000"),
        notActivatedAnimation: null,
    }],
    layouts: {
        "en-US": {
            keyGroups: [
                ["1"],
                ["2"],
                ["3"],
                ["4"],
                ["5"],
                ["6"],
                ["7"],
                ["8"],
                ["9"],
                ["0"],
            ],
            mode: "multi"
        }
    },
    fadeTime: "1"
}, {
    signal: "memory_utilization",
    min: 0,
    max: 100,
    ranges: [{
        start: 0,
        startInclusive: true,
        end: 60,
        endInclusive: true,
        activatedAnimation: solidColor("00FF00"),
        notActivatedAnimation: null,
    }, {
        start: 60,
        startInclusive: false,
        end: 80,
        endInclusive: true,
        activatedAnimation: solidColor("FFFF00"),
        notActivatedAnimation: null,
    }, {
        start: 80,
        startInclusive: false,
        end: 100,
        endInclusive: true,
        activatedAnimation: solidColor("FF0000"),
        notActivatedAnimation: null,
    }],
    layouts: {
        "en-US": {
            keyGroups: [
                ["f1"],
                ["f2"],
                ["f3"],
                ["f4"],
                ["f5"],
                ["f6"],
                ["f7"],
                ["f8"],
                ["f9"],
                ["f10"],
            ],
            mode: "multi"
        }
    },
    fadeTime: "1"
}];

export function signalsInit(_settings: SettingsModule, _keyboard: KeyboardModule) {
    settings = _settings;
    keyboard = _keyboard;

    layout = settings.getLayout();

    setupKeyboard();

    requirePath({
        path: "plugins",
        include: ["*.js", "*/index.js"]
    })
        .then((modules: { [key: string]: SignalProviderPlugin }) => {
            for (const key in modules) {
                const plugin = modules[key];
                loadPlugin(plugin);
            }

            setProfile(activeProfile); // refresh the profile
        })
        .catch((errors: any) => {
            throw errors;
        });
}

function setupKeyboard() {
    const currentSettings = settings.getSettings();
    const profile = settings.getProfiles()[currentSettings.profile];
    setProfile(profile);
}

export function loadPlugin(plugin: SignalProviderPlugin) {
    // TODO ensure that there are no conflicting signals or duplicate tags
    signalPlugins.push(plugin);
}

export function disableSignal(signal: PluginSignal) {
    for (let i = 0; i < enabledSignalPlugins.length; i++) {
        const enabled = enabledSignalPlugins[i];
        if (enabled.pluginSignal === signal) {
            if (enabled.timer != null) {
                clearTimeout(enabled.timer);
            }
            if (enabled.hook != null) {
                enabled.hook.unhook();
            }
            enabledSignalPlugins.splice(i, 1);
            return;
        }
    }
}

export function enableSignal(signal: PluginSignal) {
    const enabledSignal: EnabledSignal = {
        pluginSignal: signal,
        timer: null,
        hook: null,
    };

    const source = signal.source; // type checking wants this for some reason
    switch (source.type) {
        case "polling":
            enabledSignal.timer = setInterval(() => {
                signalValueUpdate(signal.name, source.poll());
            }, source.interval * 1000);
            break;
        case "pollingCallback":
            enabledSignal.timer = setInterval(() => {
                source.poll((signal1) => {
                    signalValueUpdate(signal.name, signal1);
                });
            }, source.interval * 1000);
            break;
        case "hook":
            enabledSignal.hook = source.attach((signal1) => {
                signalValueUpdate(signal.name, signal1);
            });
            break;
        default:
            assertNever(source);
    }

    enabledSignalPlugins.push(enabledSignal);
}

export function setProfile(profile: Profile | null) {
    if (profile == null) profile = NULL_PROFILE;

    for (const signal of Object.assign([], enabledSignalPlugins)) {
        disableSignal(signal.pluginSignal);
    }

    if (typeof profile.enabledSignals === "string") {
        // we have a tag
        for (const plugin of signalPlugins) {
            for (const signal of plugin.signals) {
                if (profile.enabledSignals === "all") {
                    enableSignal(signal);
                } else {
                    for (const tag of signal.tags) {
                        if (profile.enabledSignals === tag) {
                            enableSignal(signal);
                        }
                    }
                }
            }
        }
    } else {
        // we have a list of signals
        for (const enabledSignal of profile.enabledSignals) {
            for (const plugin of signalPlugins) {
                for (const signal of plugin.signals) {
                    if (signal.name === enabledSignal) {
                        enableSignal(signal);
                    }
                }
            }
        }
    }

    keyboard.processKeyChanges(profile.defaultAnimations[layout]);

    activeProfile = profile;
}

/**
 * Called when the signal plugin returns a value update (via polling or a hook). Not necessarily different from last time.
 * @param {string} signal
 * @param {Signal} value
 */
function signalValueUpdate(signal: string, value: Signal) {
    const currentValue = signals.get(signal);
    if (currentValue !== value) {
        signals.set(signal, value);
        handleNewSignalValue(signal, value);
    }
}

/**
 * Called when the signal has a different value than before.
 * @param {string} signal
 * @param {Signal} value
 */
function handleNewSignalValue(signal: string, value: Signal) {
    //console.log(signal + ": " + value);
    for (const sig of signalMappings) {
        if (sig.signal === signal) {
            const lay = sig.layouts[layout];

            // if no signal, inherit the profile animation
            if (value === "nosignal") {
                const changes: StateChangeRequest[] = [];
                for (const group of lay.keyGroups) {
                    for (const key of group) {
                        changes.push(profileAnimation(key, activeProfile));
                    }
                }
                keyboard.processKeyChanges(changes);
                return;
            }

            // ensure the signal value is within range
            const val = Math.max(Math.min(value, sig.max), sig.min);

            // switch on the design
            if (lay.mode == "all") {
                // determine the animation for all keys
                let data: StateInfo | null = null;
                for (const range of sig.ranges) {
                    if (((range.start <= val && range.startInclusive) || (range.start < val && !range.startInclusive)) &&
                        ((val <= range.end && range.endInclusive) || (val < range.end && !range.endInclusive))) {
                        if (range.activatedAnimation != null) {
                            data = signalAnimation(range.activatedAnimation, val);
                        }
                    }
                }
                if (data == null) throw new Error("ranges invalid");

                // send them to the keys
                const changes: StateChangeRequest[] = [];
                for (const group of lay.keyGroups) {
                    for (const key of group) {
                        changes.push({
                            key,
                            data
                        });
                    }
                }
                keyboard.processKeyChanges(changes);
            } else if (lay.mode == "multi") {
                // determine the animation for all activated keys
                let data: StateInfo | null = null;
                for (const range of sig.ranges) {
                    if (((range.start <= val && range.startInclusive) || (range.start < val && !range.startInclusive)) &&
                        ((val <= range.end && range.endInclusive) || (val < range.end && !range.endInclusive))) {
                        if (range.activatedAnimation != null) {
                            data = signalAnimation(range.activatedAnimation, val);
                        }
                    }
                }
                if (data == null) throw new Error("ranges invalid");

                const changes: StateChangeRequest[] = [];

                // get colors for activated keys
                const numKeysActivated = Math.floor(lay.keyGroups.length * val / sig.max);
                for (let i = 0; i < numKeysActivated; i++) {
                    for (const key of lay.keyGroups[i]) {
                        changes.push({
                            key,
                            data
                        });
                    }
                }

                // get colors for non-activated keys
                for (let i = numKeysActivated; i < lay.keyGroups.length; i++) {
                    for (const key of lay.keyGroups[i]) {
                        changes.push(profileAnimation(key, activeProfile));
                    }
                }
                keyboard.processKeyChanges(changes);
            } else if (lay.mode == "multiSingle") {
                throw new Error("not implemented");
            } else if (lay.mode == "multiSplit") {
                throw new Error("not implemented");
            } else {
                assertNever(lay.mode);
            }
        }
    }
}

function profileAnimation(key: string, profile: Profile): StateChangeRequest {
    for (const change of profile.defaultAnimations[layout]) {
        if (change.key === key) {
            return change;
        }
    }
    throw new Error("Could not find key in profileAnimation().");
}

function signalAnimation(animation: Animation, value: number): StateInfo {
    return {
        red: signalAnimationHelper(animation.red, value),
        green: signalAnimationHelper(animation.green, value),
        blue: signalAnimationHelper(animation.blue, value),
    };
}

function signalAnimationHelper(channelAnimation: ChannelAnimation, value: number): ChannelInfo {
    const scope = {
        signal: value
    };
    return {
        upHoldLevel: channelAnimation.upHoldLevel === undefined ? undefined : math.eval(channelAnimation.upHoldLevel, scope),
        downHoldLevel: channelAnimation.downHoldLevel === undefined ? undefined : math.eval(channelAnimation.downHoldLevel, scope),
        upMaximumLevel: channelAnimation.upMaximumLevel === undefined ? undefined : math.eval(channelAnimation.upMaximumLevel, scope),
        downMinimumLevel: channelAnimation.downMinimumLevel === undefined ? undefined : math.eval(channelAnimation.downMinimumLevel, scope),
        upHoldDelay: channelAnimation.upHoldDelay === undefined ? undefined : math.eval(channelAnimation.upHoldDelay, scope),
        downHoldDelay: channelAnimation.downHoldDelay === undefined ? undefined : math.eval(channelAnimation.downHoldDelay, scope),
        upIncrement: channelAnimation.upIncrement === undefined ? undefined : math.eval(channelAnimation.upIncrement, scope),
        downDecrement: channelAnimation.downDecrement === undefined ? undefined : math.eval(channelAnimation.downDecrement, scope),
        upIncrementDelay: channelAnimation.upIncrementDelay === undefined ? undefined : math.eval(channelAnimation.upIncrementDelay, scope),
        downDecrementDelay: channelAnimation.downDecrementDelay === undefined ? undefined : math.eval(channelAnimation.downDecrementDelay, scope),
        startDelay: channelAnimation.startDelay === undefined ? undefined : math.eval(channelAnimation.startDelay, scope),
        effectId: channelAnimation.effectId === undefined ? undefined : math.eval(channelAnimation.effectId, scope),
        direction: channelAnimation.direction === undefined ? undefined : math.eval(channelAnimation.direction, scope),
        transition: channelAnimation.transition === undefined ? undefined : math.eval(channelAnimation.transition, scope),
    };
}

/**
 * Asserts that the input value type is of type `never`. This is useful for exhaustiveness checking: https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking
 * @param {never} x
 * @returns {never}
 */
function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}

function solidColor(color: string): Animation {
    return {
        red: {
            upHoldLevel: parseInt(color.substr(0, 2), 16).toString(),
            direction: '"inc"'
        },
        green: {
            upHoldLevel: parseInt(color.substr(2, 2), 16).toString(),
            direction: '"inc"'
        },
        blue: {
            upHoldLevel: parseInt(color.substr(4, 2), 16).toString(),
            direction: '"inc"'
        }
    };
}

function solidColorFlashing(color: string): Animation {
    return {
        red: {
            upHoldLevel: parseInt(color.substr(0, 2), 16).toString(),
            downHoldLevel: "0",
            direction: '"incDec"',
            upIncrement: "255",
            downDecrement: "40",
            upHoldDelay: "20",
            downHoldDelay: "20"
        },
        green: {
            upHoldLevel: parseInt(color.substr(2, 2), 16).toString(),
            downHoldLevel: "0",
            direction: '"incDec"',
            upIncrement: "255",
            downDecrement: "40",
            upHoldDelay: "20",
            downHoldDelay: "20"
        },
        blue: {
            upHoldLevel: parseInt(color.substr(4, 2), 16).toString(),
            downHoldLevel: "0",
            direction: '"incDec"',
            upIncrement: "255",
            downDecrement: "40",
            upHoldDelay: "20",
            downHoldDelay: "20"
        }
    };
}
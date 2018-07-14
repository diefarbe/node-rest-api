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

let activeProfile: Profile | null = null;

const signalPlugins: SignalProviderPlugin[] = [];
const enabledSignalPlugins: EnabledSignal[] = [];

const signals = new Map<string, Signal>();

let layout: string;

let settings: SettingsModule;
let keyboard: KeyboardModule;

const signalMappings: SignalMapping[] = [{
    signal: "cpu_utilization",
    min: 0,
    max: 100,
    ranges: [{
        start: 0,
        startInclusive: true,
        end: 20,
        endInclusive: true,
        activatedAnimation: solidColor("00FF00"),
        notActivatedAnimation: null,
    }, {
        start: 20,
        startInclusive: false,
        end: 30,
        endInclusive: true,
        activatedAnimation: solidColor("FFFF00"),
        notActivatedAnimation: null,
    }, {
        start: 30,
        startInclusive: false,
        end: 100,
        endInclusive: true,
        activatedAnimation: solidColor("FF0000"),
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
            mode: "all"
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
    for (const signal of Object.assign([], enabledSignalPlugins)) {
        disableSignal(signal.pluginSignal);
    }

    if (profile != null) {
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
    }

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
    console.log(signal + ":" + value);

    for (const sig of signalMappings) {
        if (sig.signal === signal) {
            const lay = sig.layouts[layout];
            if (value === "nosignal") {
                if (activeProfile != null) {
                    const changes: StateChangeRequest[] = [];
                    for (const group of lay.keyGroups) {
                        for (const key of group) {
                            changes.push(profileAnimation(key, activeProfile));
                        }
                    }
                    keyboard.processKeyChanges(changes);
                }
                return;
            }
            const val = Math.max(Math.min(value, sig.max), sig.min);
            switch (lay.mode) {
                case "all":
                    let data: StateInfo | null = null;
                    for (const range of sig.ranges) {
                        if (((range.start <= val && range.startInclusive) || (range.start < val && !range.startInclusive)) &&
                            ((val <= range.end && range.endInclusive) || (val < range.end && !range.endInclusive))) {
                            if (range.activatedAnimation != null) {
                                data = signalAnimation(range.activatedAnimation, val);
                            }
                        }
                    }
                    console.log(JSON.stringify(data));
                    const changes: StateChangeRequest[] = [];
                    for (const group of lay.keyGroups) {
                        for (const key of group) {
                            if (data != null) {
                                changes.push({
                                    key,
                                    data
                                });
                            } else if (activeProfile != null) {
                                changes.push(profileAnimation(key, activeProfile));
                            }
                        }
                    }
                    keyboard.processKeyChanges(changes);
                    break;
                case "multi":
                    throw new Error("not implemented");
                    break;
                case "multiSingle":
                    throw new Error("not implemented");
                    break;
                case "multiSplit":
                    throw new Error("not implemented");
                    break;
                default:
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
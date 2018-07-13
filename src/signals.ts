import {
    Animation,
    ChannelAnimation,
    ChannelInfo,
    PluginSignal,
    Profile,
    Signal,
    SignalProviderPlugin,
    StateChangeRequest
} from "./state";
import {APIKeyboard} from "./keyboard";
import * as math from "mathjs";
import {MathNode} from "mathjs";

const requirePath = require("require-path");

type EnabledSignal = {
    pluginSignal: PluginSignal,
    timer: NodeJS.Timer | null,
    hook: { unhook: () => void } | null
};

let activeProfile: Profile | null = null;

let plugins: SignalProviderPlugin[] = [];
let enabledSignals: EnabledSignal[] = [];

let signals = new Map<string, Signal>();

let layout = "en-US"; // changing this at runtime requires calling `setProfile(activeProfile)`

let apiKeyboard: APIKeyboard;

export function signalsInit(_apiKeyboard: APIKeyboard) {
    apiKeyboard = _apiKeyboard;

    requirePath({
        path: "plugins",
        include: ["*.js", "*/index.js"]
    })
        .then((modules: { [key: string]: SignalProviderPlugin }) => {
            for (let key in modules) {
                let plugin = modules[key];
                loadPlugin(plugin);
            }

            setProfile(activeProfile); // refresh the profile
        })
        .catch((errors: any) => {
            throw errors;
        });

    const defaultProfile: Profile = require("../assets/profiles/breathing_stripes.json");
    setProfile(defaultProfile);
    //apiKeyboard.processKeyChanges(defaultProfile.defaultAnimations[layout]);
}

export function loadPlugin(plugin: SignalProviderPlugin) {
    // TODO ensure that there are no conflicting signals or duplicate tags
    plugins.push(plugin);
}

export function disableSignal(signal: PluginSignal) {
    for (let i = 0; i < enabledSignals.length; i++) {
        let enabled = enabledSignals[i];
        if (enabled.pluginSignal == signal) {
            if (enabled.timer != null) clearTimeout(enabled.timer);
            if (enabled.hook != null) enabled.hook.unhook();
            enabledSignals.splice(i, 1);
            return;
        }
    }
}

export function enableSignal(signal: PluginSignal) {
    let enabledSignal: EnabledSignal = {
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
                source.poll(signal1 => {
                    signalValueUpdate(signal.name, signal1);
                });
            }, source.interval * 1000);
            break;
        case "hook":
            enabledSignal.hook = source.attach(signal1 => {
                signalValueUpdate(signal.name, signal1);
            });
            break;
        default:
            assertNever(source);
    }

    enabledSignals.push(enabledSignal);
}

export function setProfile(profile: Profile | null) {
    for (let signal of Object.assign([], enabledSignals)) {
        disableSignal(signal.pluginSignal);
    }

    if (profile != null) {
        if (typeof profile.enabledSignals == "string") {
            // we have a tag
            for (let plugin of plugins) {
                for (let signal of plugin.signals) {
                    if (profile.enabledSignals == "all") {
                        enableSignal(signal);
                    } else {
                        for (let tag of signal.tags) {
                            if (profile.enabledSignals == tag) {
                                enableSignal(signal);
                            }
                        }
                    }
                }
            }
        } else {
            // we have a list of signals
            for (let enabledSignal of profile.enabledSignals) {
                for (let plugin of plugins) {
                    for (let signal of plugin.signals) {
                        if (signal.name == enabledSignal) {
                            enableSignal(signal);
                        }
                    }
                }
            }
        }
        apiKeyboard.processKeyChanges(profile.defaultAnimations[layout]);
    }

    activeProfile = profile;
}

/**
 * Called when the signal plugin returns a value update (via polling or a hook). Not necessarily different from last time.
 * @param {string} signal
 * @param {Signal} value
 */
function signalValueUpdate(signal: string, value: Signal) {
    let currentValue = signals.get(signal);
    if (currentValue != value) {
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
    // TODO
    console.log(signal + ":" + value);
}

function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}
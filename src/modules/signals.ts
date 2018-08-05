import * as math from "mathjs";
import { KeyboardModule } from "./keyboard";
import { SettingsModule } from "./settings";
import {
    Animation, ChannelAnimation, ChannelInfo,
    PluginSignal,
    Profile,
    Signal, SignalMapping, SignalProfile,
    SignalProviderPlugin, StateChangeRequest, StateInfo
} from "../types";
import { KeyInfo } from "@diefarbe/lib";
import { assertNever } from "../utils";
import { Logger } from "../log";

const requirePath = require("require-path");

interface EnabledSignal {
    pluginSignal: PluginSignal;
    timer: NodeJS.Timer | null;
    hook: { unhook: () => void } | null;
}

export class SignalsModule {
    private readonly logger = new Logger("SignalsModule");

    private activeSignalProfile: SignalProfile;
    private activeProfile: Profile;

    private signalPlugins: SignalProviderPlugin[] = [];
    private enabledSignalPlugins: EnabledSignal[] = [];

    private signals = new Map<string, Signal>();

    private layout: string;

    // TODO ensure no gaps in ranges and they fall between min and max
    private readonly signalMappings: SignalMapping[] = [{
        signal: "cpu_utilization_max",
        min: 0,
        max: 100,
        ranges: [{
            start: 0,
            startInclusive: true,
            end: 80,
            endInclusive: true,
            activatedAnimation: this.solidColor("00FF00"),
            notActivatedAnimation: null,
        }, {
            start: 80,
            startInclusive: false,
            end: 90,
            endInclusive: true,
            activatedAnimation: this.solidColor("FFFF00"),
            notActivatedAnimation: null,
        }, {
            start: 90,
            startInclusive: false,
            end: 99,
            endInclusive: true,
            activatedAnimation: this.solidColor("FF0000"),
            notActivatedAnimation: null,
        }, {
            start: 99,
            startInclusive: false,
            end: 100,
            endInclusive: true,
            activatedAnimation: this.solidColorFlashing("FF0000"),
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
        }
    }, {
        signal: "memory_utilization",
        min: 0,
        max: 100,
        ranges: [{
            start: 0,
            startInclusive: true,
            end: 80,
            endInclusive: true,
            activatedAnimation: this.solidColor("00FF00"),
            notActivatedAnimation: null,
        }, {
            start: 80,
            startInclusive: false,
            end: 90,
            endInclusive: true,
            activatedAnimation: this.solidColor("FFFF00"),
            notActivatedAnimation: null,
        }, {
            start: 90,
            startInclusive: false,
            end: 100,
            endInclusive: true,
            activatedAnimation: this.solidColor("FF0000"),
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
        }
    }, {
        signal: "ws_data",
        min: 0,
        max: 100,
        ranges: [{
            start: 0,
            startInclusive: true,
            end: 50,
            endInclusive: true,
            activatedAnimation: this.solidColor("FF0000"),
            notActivatedAnimation: null,
        }, {
            start: 50,
            startInclusive: false,
            end: 100,
            endInclusive: true,
            activatedAnimation: this.solidColor("00FF00"),
            notActivatedAnimation: null,
        }],
        layouts: {
            "en-US": {
                keyGroups: [["a"], ["s"]],
                mode: "multi"
            }
        }
    }];

    public constructor(
        private settings: SettingsModule,
        private keyboard: KeyboardModule) {
        this.layout = this.settings.getLayout();
        this.activeSignalProfile = this.nullSignalProfile();
        this.activeProfile = this.nullProfile();
    }

    public signalsInit() {
        this.logger.info("Initializing signals.");
        //const currentSettings = this.settings.getSettings();
        //const profile = this.settings.getProfiles()[currentSettings.profile];
        this.setSignalProfile({
            profile: "default",
            enabledSignals: "all"
        });

        requirePath({
            path: "plugins",
            include: ["*.js", "*/index.js"]
        })
            .then((modules: { [key: string]: SignalProviderPlugin }) => {
                for (const key in modules) {
                    this.logger.info("Found signal provider plugin:", key);
                    const plugin = modules[key];
                    this.loadPlugin(plugin);
                }

                this.setSignalProfile(this.activeSignalProfile); // refresh the signal profile
            })
            .catch((errors: any) => {
                throw errors;
            });
    }

    public loadPlugin(plugin: SignalProviderPlugin) {
        // TODO ensure that there are no conflicting signals or duplicate tags, possibly a conflicting signal results in the most recent plugin load taking precedence
        this.signalPlugins.push(plugin);
    }


    public disableSignal(signal: PluginSignal) {
        for (let i = 0; i < this.enabledSignalPlugins.length; i++) {
            const enabled = this.enabledSignalPlugins[i];
            if (enabled.pluginSignal === signal) {
                if (enabled.timer != null) {
                    clearTimeout(enabled.timer);
                }
                if (enabled.hook != null) {
                    enabled.hook.unhook();
                }
                this.enabledSignalPlugins.splice(i, 1);
                return;
            }
        }
    }

    public enableSignal(signal: PluginSignal) {
        const enabledSignal: EnabledSignal = {
            pluginSignal: signal,
            timer: null,
            hook: null,
        };

        const source = signal.source; // type checking wants this for some reason
        switch (source.type) {
            case "polling":
                enabledSignal.timer = setInterval(() => {
                    this.signalValueUpdate(signal.name, source.poll());
                }, source.interval * 1000);
                break;
            case "pollingCallback":
                enabledSignal.timer = setInterval(() => {
                    source.poll((signal1) => {
                        this.signalValueUpdate(signal.name, signal1);
                    });
                }, source.interval * 1000);
                break;
            case "hook":
                enabledSignal.hook = source.attach((signal1) => {
                    this.signalValueUpdate(signal.name, signal1);
                });
                break;
            case "endpoint":
                // TODO add a /signal/$name API endpoint to modify this
                break;
            default:
                assertNever(source);
        }

        this.enabledSignalPlugins.push(enabledSignal);
    }
    
    public setSignalProfile(signalProfile: SignalProfile | null) {
        if (signalProfile == null) signalProfile = this.nullSignalProfile();
        
        const profile = this.lookupProfile(signalProfile.profile);
        
        // TODO don't disable everything like this, detect the differences and do that
        
        for (const signal of Object.assign([], this.enabledSignalPlugins)) {
            this.disableSignal(signal.pluginSignal);
        }

        if (typeof signalProfile.enabledSignals === "string") {
            // we have a tag
            for (const plugin of this.signalPlugins) {
                for (const signal of plugin.signals) {
                    if (signalProfile.enabledSignals === "all") {
                        this.enableSignal(signal);
                    } else {
                        for (const tag of signal.tags) {
                            if (signalProfile.enabledSignals === tag) {
                                this.enableSignal(signal);
                            }
                        }
                    }
                }
            }
        } else {
            // we have a list of signals
            for (const enabledSignal of signalProfile.enabledSignals) {
                for (const plugin of this.signalPlugins) {
                    for (const signal of plugin.signals) {
                        if (signal.name === enabledSignal) {
                            this.enableSignal(signal);
                        }
                    }
                }
            }
        }

        // TODO don't overwrite the keys that are controlled by signals
        this.keyboard.processKeyChanges(profile.defaultAnimations[this.layout]);

        this.activeSignalProfile = signalProfile;
        this.activeProfile = profile;
    }

    /**
     * Called when the signal plugin returns a value update (via polling or a hook). Not necessarily different from last time.
     * @param {string} signal
     * @param {Signal} value
     */
    public signalValueUpdate(signal: string, value: Signal) {
        const currentValue = this.signals.get(signal);
        if (currentValue !== value) {
            this.signals.set(signal, value);
            this.handleNewSignalValue(signal, value);
        }
    }

    /**
     * Called when the signal has a different value than before.
     * @param {string} signal
     * @param {Signal} value
     */
    private handleNewSignalValue(signal: string, value: Signal) {
        //console.log(signal + ": " + value);
        for (const sig of this.signalMappings) {
            if (sig.signal === signal) {
                const lay = sig.layouts[this.layout];

                // if no signal, inherit the profile animation
                if (value === "nosignal") {
                    const changes: StateChangeRequest[] = [];
                    for (const group of lay.keyGroups) {
                        for (const key of group) {
                            changes.push(this.profileAnimation(key, this.activeProfile));
                        }
                    }
                    this.keyboard.processKeyChanges(changes);
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
                                data = this.signalAnimation(range.activatedAnimation, val);
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
                    this.keyboard.processKeyChanges(changes);
                } else if (lay.mode == "multi") {
                    // determine the animation for all activated keys
                    let data: StateInfo | null = null;
                    for (const range of sig.ranges) {
                        if (((range.start <= val && range.startInclusive) || (range.start < val && !range.startInclusive)) &&
                            ((val <= range.end && range.endInclusive) || (val < range.end && !range.endInclusive))) {
                            if (range.activatedAnimation != null) {
                                data = this.signalAnimation(range.activatedAnimation, val);
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
                            changes.push(this.profileAnimation(key, this.activeProfile));
                        }
                    }
                    this.keyboard.processKeyChanges(changes);
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

    private profileAnimation(key: string, profile: Profile): StateChangeRequest {
        for (const change of profile.defaultAnimations[this.layout]) {
            if (change.key === key) {
                return change;
            }
        }
        throw new Error("Could not find key in profileAnimation().");
    }

    private signalAnimation(animation: Animation, value: number): StateInfo {
        return {
            red: this.signalAnimationHelper(animation.red, value),
            green: this.signalAnimationHelper(animation.green, value),
            blue: this.signalAnimationHelper(animation.blue, value),
        };
    }

    private signalAnimationHelper(channelAnimation: ChannelAnimation, value: number): ChannelInfo {
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

    private solidColor(color: string): Animation {
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

    private solidColorFlashing(color: string): Animation {
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

    private nullProfile(): Profile {
        let ret: Profile = {
            name: "NULL",
            uuid: "null",
            defaultAnimations: {}
        };
        ret.defaultAnimations[this.layout] = [];
        for (let key in KeyInfo[this.layout]) {
            ret.defaultAnimations[this.layout].push({
                key: key,
                data: {
                    red: {
                        upHoldLevel: 0,
                        direction: "inc"
                    },
                    green: {
                        upHoldLevel: 0,
                        direction: "inc"
                    },
                    blue: {
                        upHoldLevel: 0,
                        direction: "inc"
                    }
                }
            });
        }

        return ret;
    }
    
    private nullSignalProfile(): SignalProfile {
        return {
            profile: "NULL",
            enabledSignals: []
        };
    }
    
    private lookupProfile(profile: string): Profile {
        return this.settings.getProfiles()[profile] || this.nullProfile();
    }
}
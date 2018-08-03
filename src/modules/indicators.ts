
import {
    SignalMapping,
    Signal,
    StateChangeRequest,
    StateInfo,
} from "../types";
import { Animations } from "../utils/Animations";
import { assertNever } from "../utils/Asserts";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { Logger } from "../utils/Logger";

export class IndicatorModule {
    
    private readonly logger = new Logger("KeyboardModule");

    private layout: string = "unknown";

    public constructor(
        private keyboardEvents: KeyboardEvents) {
    }

    init() {
        this.keyboardEvents.addListener("onSignalValueUpdated", this.onSignalValueUpdated);
        this.keyboardEvents.addListener("onSettingsChanged", this.onSettingsChanged);
    }

    deinit() {
        this.keyboardEvents.removeListener("onSignalValueUpdated", this.onSignalValueUpdated);
        this.keyboardEvents.removeListener("onSettingsChanged", this.onSettingsChanged);
    }

    onSettingsChanged = (settings: any) => {
        this.layout = settings.layout;
    }

    // TODO ensure no gaps in ranges and they fall between min and max
    // TODO remove this hardcoded stuff
    private readonly signalMappings: SignalMapping[] = [{
        signal: "cpu_utilization_max",
        min: 0,
        max: 100,
        ranges: [{
            start: 0,
            startInclusive: true,
            end: 80,
            endInclusive: true,
            activatedAnimation: Animations.solidColor("00FF00"),
            notActivatedAnimation: null,
        }, {
            start: 80,
            startInclusive: false,
            end: 90,
            endInclusive: true,
            activatedAnimation: Animations.solidColor("FFFF00"),
            notActivatedAnimation: null,
        }, {
            start: 90,
            startInclusive: false,
            end: 99,
            endInclusive: true,
            activatedAnimation: Animations.solidColor("FF0000"),
            notActivatedAnimation: null,
        }, {
            start: 99,
            startInclusive: false,
            end: 100,
            endInclusive: true,
            activatedAnimation: Animations.solidColorFlashing("FF0000"),
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
            activatedAnimation: Animations.solidColor("00FF00"),
            notActivatedAnimation: null,
        }, {
            start: 80,
            startInclusive: false,
            end: 90,
            endInclusive: true,
            activatedAnimation: Animations.solidColor("FFFF00"),
            notActivatedAnimation: null,
        }, {
            start: 90,
            startInclusive: false,
            end: 100,
            endInclusive: true,
            activatedAnimation: Animations.solidColor("FF0000"),
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
    }];

    getInfo() {
        return this.signalMappings;
    }

    /**
    * Called when the signal has a different value than before.
    * @param {string} signal
    * @param {Signal} value
    */
    private onSignalValueUpdated = (signal: string, value: Signal) => {
        this.logger.info("Signal Value updated: " + signal + ":" + value);
        for (const sig of this.signalMappings) {
            if (sig.signal === signal) {
                const lay = sig.layouts[this.layout];

                // if no signal, inherit the profile animation
                if (value === "nosignal") {
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
                                data = Animations.signalAnimation(range.activatedAnimation, val);
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
                    this.keyboardEvents.on("onStateChangeRequested", changes);
                } else if (lay.mode == "multi") {
                    // determine the animation for all activated keys
                    let data: StateInfo | null = null;
                    for (const range of sig.ranges) {
                        if (((range.start <= val && range.startInclusive) || (range.start < val && !range.startInclusive)) &&
                            ((val <= range.end && range.endInclusive) || (val < range.end && !range.endInclusive))) {
                            if (range.activatedAnimation != null) {
                                data = Animations.signalAnimation(range.activatedAnimation, val);
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

                    this.keyboardEvents.emit("onStateChangeRequested", changes, false);
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
}
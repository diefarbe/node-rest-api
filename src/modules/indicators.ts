
import {
    ISignalMapping,
    IStateChangeRequest,
    IStateInfo,
    Signal,
} from "../types";
import { Animations } from "../utils/Animations";
import { assertNever } from "../utils/Asserts";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { Logger } from "../utils/Logger";

export class IndicatorModule {

    private readonly logger = new Logger("KeyboardModule");

    private layout: string = "unknown";
    private changes: { [key: string]: IStateInfo } = {};

    // TODO ensure no gaps in ranges and they fall between min and max
    // TODO remove this hardcoded stuff
    private readonly signalMappings: ISignalMapping[] = [{
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
        max: 100,
        min: 0,
        ranges: [{
            activatedAnimation: Animations.solidColor("00FF00"),
            end: 80,
            endInclusive: true,
            notActivatedAnimation: null,
            start: 0,
            startInclusive: true,
        }, {
            activatedAnimation: Animations.solidColor("FFFF00"),
            end: 90,
            endInclusive: true,
            notActivatedAnimation: null,
            start: 80,
            startInclusive: false,
        }, {
            activatedAnimation: Animations.solidColor("FF0000"),
            end: 99,
            endInclusive: true,
            notActivatedAnimation: null,
            start: 90,
            startInclusive: false,
        }, {
            activatedAnimation: Animations.solidColorFlashing("FF0000"),
            end: 100,
            endInclusive: true,
            notActivatedAnimation: null,
            start: 99,
            startInclusive: false,
        }],
        signal: "cpu_utilization_max",
    }, {
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
        max: 100,
        min: 0,
        ranges: [{
            activatedAnimation: Animations.solidColor("00FF00"),
            end: 80,
            endInclusive: true,
            notActivatedAnimation: null,
            start: 0,
            startInclusive: true,
        }, {
            activatedAnimation: Animations.solidColor("FFFF00"),
            end: 90,
            endInclusive: true,
            notActivatedAnimation: null,
            start: 80,
            startInclusive: false,
        }, {
            activatedAnimation: Animations.solidColor("FF0000"),
            end: 100,
            endInclusive: true,
            notActivatedAnimation: null,
            start: 90,
            startInclusive: false,
        }],
        signal: "memory_utilization",
    }];

    public constructor(
        private keyboardEvents: KeyboardEvents) {
    }

    public init() {
        this.keyboardEvents.addListener("onSignalValueUpdated", this.onSignalValueUpdated);
        this.keyboardEvents.addListener("onSettingsChanged", this.onSettingsChanged);
        this.keyboardEvents.addListener("onSignalTickRequest", this.onSignalTickRequest);
    }

    public deinit() {
        this.keyboardEvents.removeListener("onSignalValueUpdated", this.onSignalValueUpdated);
        this.keyboardEvents.removeListener("onSettingsChanged", this.onSettingsChanged);
        this.keyboardEvents.removeListener("onSignalTickRequest", this.onSignalTickRequest);
    }

    public onSignalTickRequest = () => {
        const stateChagnes: IStateChangeRequest[] = [];
        for (const key of Object.keys(this.changes)) {
            stateChagnes.push({
                data: this.changes[key],
                key,
            });
        }
        this.keyboardEvents.emit("onStateChangeRequested", stateChagnes, false);

    }

    public onSettingsChanged = (settings: any) => {
        this.layout = settings.layout;
    }

    public getInfo() {
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
                if (lay.mode === "all") {
                    // determine the animation for all keys
                    let data: IStateInfo | null = null;
                    for (const range of sig.ranges) {
                        if (((range.start <= val && range.startInclusive) || (range.start < val && !range.startInclusive)) &&
                            ((val <= range.end && range.endInclusive) || (val < range.end && !range.endInclusive))) {
                            if (range.activatedAnimation != null) {
                                data = Animations.signalAnimation(range.activatedAnimation, val);
                            }
                        }
                    }
                    if (data == null) { throw new Error("ranges invalid"); }

                    // send them to the keys
                    for (const group of lay.keyGroups) {
                        for (const key of group) {
                            this.changes[key] = data;
                        }
                    }
                } else if (lay.mode === "multi") {
                    // determine the animation for all activated keys
                    let data: IStateInfo | null = null;
                    for (const range of sig.ranges) {
                        if (((range.start <= val && range.startInclusive) || (range.start < val && !range.startInclusive)) &&
                            ((val <= range.end && range.endInclusive) || (val < range.end && !range.endInclusive))) {
                            if (range.activatedAnimation != null) {
                                data = Animations.signalAnimation(range.activatedAnimation, val);
                            }
                        }
                    }
                    if (data == null) { throw new Error("ranges invalid"); }

                    const changes: IStateChangeRequest[] = [];

                    // get colors for activated keys
                    const numKeysActivated = Math.floor(lay.keyGroups.length * val / sig.max);
                    for (let i = 0; i < numKeysActivated; i++) {
                        for (const key of lay.keyGroups[i]) {
                            this.changes[key] = data;
                        }
                    }

                } else if (lay.mode === "multiSingle") {
                    throw new Error("not implemented");
                } else if (lay.mode === "multiSplit") {
                    throw new Error("not implemented");
                } else {
                    assertNever(lay.mode);
                }
            }
        }
    }
}
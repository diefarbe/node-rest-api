
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

    // TODO ensure no gaps in ranges and they fall between min and max
    // TODO remove this hardcoded stuff
    private readonly indicators: ISignalMapping[] = [{
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
        uuid: "0ae6d89e-89f1-4906-aa16-a76c17270859",
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
        uuid: "5dca1f2d-7386-48a8-b2b3-b74931dd36f3",
    }];

    private layout: string = "unknown";
    private changes: { [key: string]: { [key: string]: IStateInfo } } = {};

    public constructor(
        private keyboardEvents: KeyboardEvents) {
    }

    public init() {
        this.keyboardEvents.addSignalValueUpdateListener(this.onSignalValueUpdated);
        this.keyboardEvents.addSignalDisableListener(this.onSignalDisabled);

        this.keyboardEvents.addSettingsListener(this.onSettingsChanged);
        this.keyboardEvents.addRedrawListener(this.onSignalTickRequest, 1);
    }

    public deinit() {
        this.keyboardEvents.removeSignalValueUpdateListener(this.onSignalValueUpdated);
        this.keyboardEvents.removeSignalDisableListener(this.onSignalDisabled);

        this.keyboardEvents.removeSettingsListener(this.onSettingsChanged);
        this.keyboardEvents.removeRedrawListener(1);

    }

    public getInfo(id?: string) {
        if (typeof id !== "undefined") {
            for (const indicator of this.indicators) {
                if (indicator.uuid === id) {
                    return indicator;
                }
            }
        }
        return this.indicators;
    }

    private onSignalTickRequest = () => {
        const stateChanges: IStateChangeRequest[] = [];
        for (const signalName of Object.keys(this.changes)) {
            for (const key of Object.keys(this.changes[signalName])) {
                stateChanges.push({
                    data: this.changes[signalName][key],
                    key,
                });
            }
        }
        this.keyboardEvents.requestStateChange(stateChanges);
    }

    private onSignalDisabled = (signal: string) => {
        this.logger.info("Disabled:" + signal);
        delete this.changes[signal];
    }

    private onSettingsChanged = (settings: any) => {
        this.layout = settings.layout;
    }

    /**
     * Called when the signal has a different value than before.
     * @param {string} signal
     * @param {Signal} value
     */
    private onSignalValueUpdated = (signal: string, value: Signal) => {
        this.logger.info("Signal Value updated: " + signal + ":" + value);
        // reset the changes for this signal since we're about to reset them
        this.changes[signal] = {};
        for (const sig of this.indicators) {
            if (sig.signal === signal) {
                const lay = sig.layouts[this.layout];

                // if no signal, inherit the profile animation
                if (value === "nosignal") {
                    continue;
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
                            this.changes[signal][key] = data;
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

                    // get colors for activated keys
                    const numKeysActivated = Math.floor(lay.keyGroups.length * val / sig.max);
                    for (let i = 0; i < numKeysActivated; i++) {
                        for (const key of lay.keyGroups[i]) {
                            this.changes[signal][key] = data;
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
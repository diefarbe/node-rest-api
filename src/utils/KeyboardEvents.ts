import EventEmitter from "events";
import { Settings } from "modules/settings";
import { IStateChangeRequest, Signal } from "types";

const ON_SETTINGS_CHANGED = "onSettingsChanged";
const ON_STATE_CHANGE_REQUESTED = "onStateChangeRequested";
const ON_SIGNAL_VALUE_UPDATED = "onSignalValueUpdated";
const ON_SIGNAL_DISABLED = "onSignalDisabled";

export class KeyboardEvents {

    private readonly emitter = new EventEmitter();
    private readonly redrawListeners: VoidFunction[] = [];

    // add
    public addSettingsListener(callback: (settings: Settings) => void) {
        this.emitter.addListener(ON_SETTINGS_CHANGED, callback);
    }

    public addStateChangeListener(callback: (changes: IStateChangeRequest[], sync: boolean) => void) {
        this.emitter.addListener(ON_STATE_CHANGE_REQUESTED, callback);
    }

    public addSignalValueUpdateListener(callback: (signal: string, value: Signal) => void) {
        this.emitter.addListener(ON_SIGNAL_VALUE_UPDATED, callback);
    }

    public addSignalDisableListener(callback: (signal: string) => void) {
        this.emitter.addListener(ON_SIGNAL_DISABLED, callback);
    }

    public addRedrawListener(callback: VoidFunction, priority: number) {
        this.redrawListeners[priority] = callback;
    }

    // remove
    public removeSettingsListener(callback: (settings: Settings) => void) {
        this.emitter.removeListener(ON_SETTINGS_CHANGED, callback);
    }

    public removeStateChangeListener(callback: (changes: IStateChangeRequest[], sync: boolean) => void) {
        this.emitter.removeListener(ON_STATE_CHANGE_REQUESTED, callback);
    }

    public removeSignalValueUpdateListener(callback: (signal: string, value: Signal) => void) {
        this.emitter.removeListener(ON_SIGNAL_VALUE_UPDATED, callback);
    }

    public removeSignalDisableListener(callback: (signal: string) => void) {
        this.emitter.removeListener(ON_SIGNAL_DISABLED, callback);
    }

    public removeRedrawListener(priority: number) {
        this.redrawListeners.splice(priority, 1);
    }

    // emit
    public settingsUpdated(settings: Settings) {
        this.emitter.emit(ON_SETTINGS_CHANGED, settings);
    }

    public updateSignalValue(signal: string, value: Signal) {
        this.emitter.emit(ON_SIGNAL_VALUE_UPDATED, signal, value);
    }

    public disableSignal(signal: string) {
        this.emitter.emit(ON_SIGNAL_DISABLED, signal);
    }

    public requestStateChange(changes: IStateChangeRequest[]) {
        this.emitter.emit(ON_STATE_CHANGE_REQUESTED, changes, false);
    }

    public requestDraw() {
        for (const callback of this.redrawListeners) {
            callback();
        }
    }

}
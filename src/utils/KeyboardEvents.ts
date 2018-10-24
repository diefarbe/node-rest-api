import EventEmitter from "events";
import { Settings } from "modules/settings";
import { IStateChangeRequest, Signal } from "types";
export class KeyboardEvents {

    private readonly emitter = new EventEmitter();
    private readonly redrawListeners: VoidFunction[] = [];

    // add
    public addSettingsListener(callback: (settings: Settings) => void) {
        this.emitter.addListener("onSettingsChanged", callback);
    }

    public addStateChangeListener(callback: (changes: IStateChangeRequest[], sync: boolean) => void) {
        this.emitter.addListener("onStateChangeRequested", callback);
    }

    public addSignalValueUpdateListener(callback: (signal: string, value: Signal) => void) {
        this.emitter.addListener("onSignalValueUpdated", callback);
    }

    public addSignalDisableListener(callback: (signal: string) => void) {
        this.emitter.addListener("onSignalDisabled", callback);
    }

    public addRedrawListener(callback: VoidFunction, priority: number) {
        this.redrawListeners[priority] = callback;
    }

    // remove
    public removeSettingsListener(callback: (settings: Settings) => void) {
        this.emitter.removeListener("onSettingsChanged", callback);
    }

    public removeStateChangeListener(callback: (changes: IStateChangeRequest[], sync: boolean) => void) {
        this.emitter.removeListener("onStateChangeRequested", callback);
    }

    public removeSignalValueUpdateListener(callback: (signal: string, value: Signal) => void) {
        this.emitter.removeListener("onSignalValueUpdated", callback);
    }

    public removeSignalDisableListener(callback: (signal: string) => void) {
        this.emitter.removeListener("onSignalDisabled", callback);
    }

    public removeRedrawListener(priority: number) {
        this.redrawListeners.splice(priority, 1);
    }

    // emit
    public settingsUpdated(settings: Settings) {
        this.emitter.emit("onSettingsChanged", settings);
    }

    public updateSignalValue(signal: string, value: Signal) {
        this.emitter.emit("onSignalValueUpdated", signal, value);
    }

    public disableSignal(signal: string) {
        this.emitter.emit("onSignalDisabled", signal);
    }

    public requestStateChange(changes: IStateChangeRequest[]) {
        this.emitter.emit("onStateChangeRequested", changes, false);
    }

    public requestDraw() {
        for (const callback of this.redrawListeners) {
            callback();
        }
    }

}
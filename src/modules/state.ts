import { KeyInfo } from "das/dist/key-info";
import { StateChangeRequest, StateInfo } from "types";
import { KeyboardModule } from "./keyboard";
import { SettingsModule } from "./settings";

/**
 * This module acts as a proxy between everything and the keyboard. Its job being to ensure that the keyboard always has the wanted state and to dedup any requests.
 */
export class StateModule {

    private readonly settings: SettingsModule;
    private readonly keyboard: KeyboardModule;

    private currentState = new State();
    private wantedState = new State();

    private needsSync = false;

    constructor(settings: SettingsModule, keyboard: KeyboardModule) {
        this.settings = settings;
        this.keyboard = keyboard;
        this.keyboard.connectionChanged = (connected: boolean) => {
            if (connected) {
                this.sync();
            } else {
                this.currentState = new State();
            }
        };
    }

    /**
     * Given a single key, return the wanted state of that key.
     * @param key a key to return
     */
    public getKeyData(key: string): StateInfo {
        let goal = this.wantedState[key];
        if (goal !== undefined) {
            return goal;
        } else {
            return this.currentState[key];
        }
    }

    /**
     * Returns the wanted states of all keys.
     */
    public getAllKeyData() {
        const keys: StateChangeRequest[] = [];

        const ks = Object.keys(KeyInfo[this.settings.getLayout()]);
        for (const k of ks) {
            keys.push({
                key: k,
                data: this.getKeyData(k)
            });
        }
        return keys;
    }

    /**
     * Updates the wanted state with the provided key changes.
     * @param data an array of state changes
     */
    public processKeyChanges(data: StateChangeRequest[]) {
        for (const change of data) {
            this.wantedState[change.key] = change.data;
        }

        this.needsSync = true;
        this.sync();
    }

    /**
     * Syncs any pending changes, if necessary.
     */
    public sync() {
        // only sync if it needs it, and there is actually a keyboard
        if (this.needsSync && this.keyboard.hasKeyboard()) {
            try {
                for (let key in this.wantedState) {
                    let currentState = this.currentState[key];
                    let wantedState = this.wantedState[key];

                    // if current state and wanted state differs
                    // comparison is not perfect, see: https://stackoverflow.com/questions/1068834/object-comparison-in-javascript#1144249
                    if (JSON.stringify(currentState) !== JSON.stringify(wantedState)) {
                        // write the wanted state to the keyboard
                        this.keyboard.processKeyChanges([{
                            key: key,
                            data: this.wantedState[key]
                        }]);
                        // and update the current state
                        this.currentState[key] = wantedState;
                    }
                }
                
                this.keyboard.hardwareKeyboard.freezeEffects();
                this.keyboard.hardwareKeyboard.apply();

                // we've successfully synced everything!
                this.needsSync = false;
            } catch (e) {
                // TODO remove this logging
                console.log("Error while attempting to sync change", e);
            }
        }
    }

}

class State {
    [key: string]: StateInfo;
}
import { ChannelState, Keyboard, KeyInfo, KeyModel } from "das";
import { ChannelInfo, StateChangeRequest, StateInfo } from "../types";
import { SettingsModule } from "./settings";

const usbDetect = require("usb-detection");

export class KeyboardModule {

    private readonly hardwareKeyboard: Keyboard;
    private readonly settings: SettingsModule;
    private firmwareVersionString: string = "0.0.0";
    private isInitalized: boolean = false;
    
    private needsSync = false;
    private currentState = new State();
    private wantedState = new State();
    private syncTimer: NodeJS.Timer | null = null;

    constructor(settings: SettingsModule) {
        this.settings = settings;
        this.hardwareKeyboard = new Keyboard();
    }

    public init() {
        usbDetect.startMonitoring();

        // There's a filtered search, but it seems broken...
        usbDetect.find((error: any, devices: any) => {
            for (const device of devices) {
                if (device.vendorId === 9456) {
                    console.log("Keyboard: Found a das keyboard, initializing");
                    setTimeout(() => {
                        this.internalSetupKeyboard();
                    }, 2000);
                }
            }
        });

        usbDetect.on("remove:9456", (device: any) => {
            console.log("Keyboard: Removed a das keyboard");
            this.cleanupKeyboardDisconnect();
        });

        usbDetect.on("add:9456", (device: any) => {
            console.log("Keyboard: Added a das keyboard");

            console.log("Keyboard: Found a das keyboard, initializing");
            setTimeout(() => {
                this.internalSetupKeyboard();
            }, 2000);
        });

        this.syncTimer = setInterval(() => this.sync(), 1000);
    }

    public close() {
        this.hardwareKeyboard.close();
        if (this.syncTimer != null) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        } 
    }

    public hasKeyboard() {
        return this.isInitalized;
    }

    /**
     * Returns basic information about the keyboard.
     */
    public getBasicInfo(): { firmware: string | null } {
        if (this.isInitalized) {
            return {
                firmware: this.firmwareVersionString,
            };
        }
        return {
            firmware: null,
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
        if (this.needsSync && this.isInitalized) {
            try {
                for (let key in this.wantedState) {
                    let currentState = this.currentState[key];
                    let wantedState = this.wantedState[key];

                    // if current state and wanted state differs
                    // comparison is not perfect, see: https://stackoverflow.com/questions/1068834/object-comparison-in-javascript#1144249
                    if (JSON.stringify(currentState) !== JSON.stringify(wantedState)) {
                        // write the wanted state to the keyboard
                        const data = this.wantedState[key];
                        const keyModel = KeyInfo[this.settings.getLayout()][key];
                        this.internalSendKeyData(keyModel, "red", data.red);
                        this.internalSendKeyData(keyModel, "green", data.green);
                        this.internalSendKeyData(keyModel, "blue", data.blue);

                        // and update the current state
                        this.currentState[key] = wantedState;
                    }
                }

                this.hardwareKeyboard.freezeEffects();
                this.hardwareKeyboard.apply();

                // we've successfully synced everything!
                this.needsSync = false;
            } catch (e) {
                // TODO remove this logging
                console.log("Error while attempting to sync change", e);
            }
        }
    }

    private internalSetupKeyboard() {
        try {
            this.hardwareKeyboard.find();

            // we found a keyboard, let's go ahead and handle taking over it
            this.hardwareKeyboard.initialize();
            this.firmwareVersionString = this.hardwareKeyboard.getKeyboardData().firmware;

            console.log("Got keyboard");

            this.isInitalized = true;
            this.sync();
        } catch {
            console.log("Failed to take over keyboard");
            this.isInitalized = false;
        }
    }

    private cleanupKeyboardDisconnect() {
        this.isInitalized = false;
        this.currentState = new State();
        this.hardwareKeyboard.close();

    }

    private internalSendKeyData(key: KeyModel, channel: "red" | "green" | "blue", data: ChannelInfo) {

        let aState = new ChannelState(key, channel)
            .setUpHoldLevel(data.upHoldLevel) //
            .setDownHoldLevel(data.downHoldLevel)
            .setUpIncrementDelay(data.upIncrementDelay)
            .setDownDecrementDelay(data.downDecrementDelay)
            .setUpMaximumLevel(data.upMaximumLevel)
            .setDownMinimumLevel(data.downMinimumLevel)
            .setUpIncrement(data.upIncrement)
            .setDownDecrement(data.downDecrement)
            .setUpHoldDelay(data.upHoldDelay)
            .setDownHoldDelay(data.downHoldDelay)
            .setStartDelay(data.startDelay)
            .setApplyDelayed();

        if (data.direction === "dec") {
            aState = aState.setMoveDown();
        }

        if (data.direction === "inc") {
            aState = aState.setMoveUp();
        }

        if (data.direction === "incDec") {
            aState = aState.setIncrementDecrement();
        }

        if (data.direction === "decInc") {
            aState = aState.setDecrementIncrement();
        }

        aState = aState.setTransition(!!data.transition);

        this.hardwareKeyboard.setKeyColorChannel(
            aState,
        );
    }

}

class State {
    [key: string]: StateInfo;
}
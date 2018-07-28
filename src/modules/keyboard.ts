import { ChannelState, Keyboard, KeyInfo, KeyModel, KeyState } from "@diefarbe/lib";
import { ChannelInfo, StateChangeRequest, StateInfo } from "../types";
import { SettingsModule } from "./settings";
import { Logger } from "../log";
import { IKeyMapCulture } from "@diefarbe/lib/src/internal/models/index";

const usbDetect = require("usb-detection");

export class KeyboardModule {
    private readonly logger = new Logger("KeyboardModule");

    private readonly hardwareKeyboard: Keyboard;
    private readonly layout: string;
    private readonly keysInLayout: IKeyMapCulture;
    private firmwareVersionString: string = "0.0.0";
    private isInitalized: boolean = false;

    private needsSync = false;
    private currentState = new State();
    private wantedState = new State();
    private syncTimer: NodeJS.Timer | null = null;

    constructor(layout: string) {
        this.layout = layout;
        this.keysInLayout = KeyInfo[this.layout];
        this.hardwareKeyboard = new Keyboard();
    }

    public init() {
        usbDetect.startMonitoring();

        // There's a filtered search, but it seems broken...
        usbDetect.find((error: any, devices: any) => {
            for (const device of devices) {
                if (device.vendorId === 9456) {
                    this.logger.info("Found a keyboard.");
                    setTimeout(() => {
                        this.internalSetupKeyboard();
                    }, 2000);
                }
            }
        });

        usbDetect.on("remove:9456", (device: any) => {
            this.logger.info("Removed a keyboard.");
            this.cleanupKeyboardDisconnect();
        });

        usbDetect.on("add:9456", (device: any) => {
            this.logger.info("Added a keyboard.");
            setTimeout(() => {
                this.internalSetupKeyboard();
            }, 2000);
        });

        this.syncTimer = setInterval(() => this.sync(), 1000);
    }

    public close() {
        if (this.syncTimer != null) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }
        this.restoreHardwareProfile();
        this.hardwareKeyboard.close();
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

        const ks = Object.keys(this.keysInLayout);
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
     * @param sync whether or not to immediately sync the changes
     */
    public processKeyChanges(data: StateChangeRequest[], sync = true) {
        for (const change of data) {
            this.wantedState[change.key] = change.data;
        }

        this.needsSync = true;
        if (sync) {
            this.sync();
        }
    }

    /**
     * Syncs any pending changes, if necessary.
     */
    public sync() {
        // only sync if it needs it, and there is actually a keyboard
        if (this.needsSync && this.isInitalized) {
            try {
                let changed = false;
                for (let key in this.wantedState) {
                    let currentState = this.currentState[key];
                    let wantedState = this.wantedState[key];
                    const keyModel = this.keysInLayout[key];

                    // if current state and wanted state differs
                    // comparison is not perfect, see: https://stackoverflow.com/questions/1068834/object-comparison-in-javascript#1144249

                    // write the wanted state to the keyboard
                    if (currentState === undefined || JSON.stringify(currentState.red) !== JSON.stringify(wantedState.red)) {
                        this.internalSendKeyData(keyModel, "red", wantedState.red);
                        changed = true;
                    }
                    if (currentState === undefined || JSON.stringify(currentState.green) !== JSON.stringify(wantedState.green)) {
                        this.internalSendKeyData(keyModel, "green", wantedState.green);
                        changed = true;
                    }
                    if (currentState === undefined || JSON.stringify(currentState.blue) !== JSON.stringify(wantedState.blue)) {
                        this.internalSendKeyData(keyModel, "blue", wantedState.blue);
                        changed = true;
                    }

                    // and update the current state
                    this.currentState[key] = wantedState;
                }

                if (changed) {
                    this.hardwareKeyboard.freezeEffects();
                    this.hardwareKeyboard.apply();
                }

                // we've successfully synced everything!
                this.needsSync = false;
            } catch (e) {
                this.logger.warn(e);
            }
        }
    }

    private internalSetupKeyboard() {
        try {
            this.logger.info("Initializing keyboard...");
            this.hardwareKeyboard.find();

            // we found a keyboard, let's go ahead and handle taking over it
            this.hardwareKeyboard.initialize();
            this.firmwareVersionString = this.hardwareKeyboard.getKeyboardData().firmware;

            this.sync();

            this.isInitalized = true;
            this.logger.info("Keyboard initialization complete.");
        } catch (e) {
            this.logger.warn("Keyboard initialization failed.", e);
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

    private restoreHardwareProfile() {
        for (const keyName in this.keysInLayout) {
            const key = this.keysInLayout[keyName];
            this.hardwareKeyboard.setKeyState(new KeyState(key).setToHardwareProfile());
        }
        this.hardwareKeyboard.apply();
    }

}

class State {
    [key: string]: StateInfo;
}
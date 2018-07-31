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

    private needsSync = false; // true when wantedState differs from currentState
    private currentState = new State();
    private wantedState = new State();
    private syncTimer: NodeJS.Timer | null = null;
    private setupTimer: NodeJS.Timer | null = null;

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
                    // wait for the keyboard to boot
                    this.setupTimer = setTimeout(() => {
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
            // wait for the keyboard to boot
            this.setupTimer = setTimeout(() => {
                this.internalSetupKeyboard();
            }, 2000);
        });

        /*
        Catches any unsynced changes. Although, most of the time the sync should happen immediately.
         */
        this.syncTimer = setInterval(() => this.sync(), 1000);
    }

    public close() {
        // stop the syncing
        if (this.syncTimer != null) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }
        
        // stop any delayed initializations
        if (this.setupTimer != null) {
            clearTimeout(this.setupTimer);
            this.setupTimer = null;
        }

        if (this.isInitalized) {
            // restore the default rainbow pattern
            this.restoreHardwareProfile();
        }

        // disconnect from the keyboard
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
     * @param keyName a key to return
     */
    public getWantedStateForKey(keyName: string): StateInfo {
        let goal = this.wantedState[keyName];
        if (goal !== undefined) {
            return goal;
        } else {
            return this.currentState[keyName];
        }
    }

    /**
     * Returns the wanted states of all keys.
     */
    public getWantedStatesForAllKeys() {
        const keys: StateChangeRequest[] = [];

        for (const keyName in this.keysInLayout) {
            keys.push({
                key: keyName,
                data: this.getWantedStateForKey(keyName)
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
            // check if we already have this state wanted
            if (JSON.stringify(this.wantedState[change.key]) !== JSON.stringify(change.data)) {
                // wanted state differs, set it and require a sync
                this.wantedState[change.key] = change.data;
                this.needsSync = true;
            }
        }

        if (sync) {
            // instead of waiting for the next sync, sync the changes now
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
                for (const keyName in this.wantedState) {
                    const wantedKeyState = this.wantedState[keyName];
                    const currentKeyState = this.currentState[keyName];
                    const key = this.keysInLayout[keyName];

                    // if current state and wanted state differs
                    // comparison is not perfect, see: https://stackoverflow.com/questions/1068834/object-comparison-in-javascript#1144249

                    // write the wanted state to the keyboard
                    if (currentKeyState === undefined || JSON.stringify(currentKeyState.red) !== JSON.stringify(wantedKeyState.red)) {
                        this.internalSendKeyData(key, "red", wantedKeyState.red);
                        changed = true;
                    }
                    if (currentKeyState === undefined || JSON.stringify(currentKeyState.green) !== JSON.stringify(wantedKeyState.green)) {
                        this.internalSendKeyData(key, "green", wantedKeyState.green);
                        changed = true;
                    }
                    if (currentKeyState === undefined || JSON.stringify(currentKeyState.blue) !== JSON.stringify(wantedKeyState.blue)) {
                        this.internalSendKeyData(key, "blue", wantedKeyState.blue);
                        changed = true;
                    }

                    // and update the current state
                    this.currentState[keyName] = wantedKeyState;
                }

                // only apply if we've sent some data
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

            this.currentState = new State();
            this.needsSync = true;
            this.sync();

            this.isInitalized = true;
            this.logger.info("Keyboard initialization complete.");
        } catch (e) {
            this.isInitalized = false;
            this.logger.warn("Keyboard initialization failed.", e);
        }
    }

    private cleanupKeyboardDisconnect() {
        this.isInitalized = false;
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

        aState = aState.setTransition(data.transition || false);

        this.hardwareKeyboard.setKeyColorChannel(aState);
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
    [keyName: string]: StateInfo;
}
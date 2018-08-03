import { KeyInfo, IKeyMapCulture, Keyboard, ChannelState, KeyModel, KeyState } from "@diefarbe/lib";
import { Logger } from "../utils/Logger";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { ChannelInfo, StateChangeRequest, StateInfo } from "../types";
const usbDetect = require("usb-detection");

class State {
    [keyName: string]: StateInfo;
}

/**
 * The Keyboard Module
 * 
 * This module is in charge of holding, reporting, and changing the keyboard state.
 * 
 * The keyboard listens to three different events from our keyboard events. These are:
 * 
 * onSettingsChanged - Since the keyboard does not hold the layout, we need to know when the user
 * changes the keyboard layout so we can adjust our states. 
 * 
 * onStateChangeRequested - When a signal or profile needs to alter the current state. They emit
 * a onStateChangeREqueste event. This event is then added to the wanted state and will sync to the 
 * keyboard once 1000ms passes, or the user has requested an immediate sync.
 * 
 */
export class KeyboardModule {

    private readonly logger = new Logger("KeyboardModule");
    private readonly hardwareKeyboard: Keyboard;
    private readonly currentState = new State();
    private readonly wantedState = new State();

    private syncTimer: NodeJS.Timer | null = null;
    private keyboardConnected: boolean = false;

    private keysInLayout: IKeyMapCulture;

    private keyboardInfo: { firmware: string } = { firmware: "unknown" }

    private needsSync = false; // true when wantedState differs from currentState

    constructor(private keyboardEvents: KeyboardEvents) {
        this.hardwareKeyboard = new Keyboard();
        this.keysInLayout = KeyInfo["en-US"];
    }

    /**
     * Initializes this module
     * 
     * We start monitoring the USB ports for the keyboard.
     */
    async init(): Promise<void> {
        this.keyboardEvents.addListener("onSettingsChanged", this.onSettingsChanged);
        this.keyboardEvents.addListener("onStateChangeRequested", this.onStateChangeRequested);

        usbDetect.startMonitoring();

        // There's a filtered search, but it seems broken...
        usbDetect.find((error: any, devices: any) => {
            for (const device of devices) {
                if (device.vendorId === 9456) {
                    this.logger.info("Found a keyboard.");
                    this.setupKeyboard()
                }
            }
        });

        usbDetect.on("remove:9456", (device: any) => {
            this.logger.info("Removed a keyboard.");
            this.disconnectKeyboard();
        });

        usbDetect.on("add:9456", (device: any) => {
            this.logger.info("Added a keyboard.");
            this.setupKeyboard()
        });

        this.syncTimer = setInterval(() => this.sync(), 1000);
    }

    async deinit(): Promise<void> {
        this.keyboardEvents.removeListener("onSettingsChanged", this.onSettingsChanged);
        this.keyboardEvents.removeListener("onStateChangeRequested", this.onStateChangeRequested);

        // stop the syncing
        if (this.syncTimer != null) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }

        // restore the default rainbow pattern
        this.restoreHardwareProfile();

        // stop monitoring the usbs
        usbDetect.stopMonitoring();

        // disconnect from any current keyboard
        this.disconnectKeyboard();
    }

    /**
     * returns the current keyboard info including firmware version and key states
     */
    getInfo() {
        return {
            info: this.keyboardInfo,
            state: this.getWantedStatesForAllKeys(),
        }
    }

    /**
     * Given a single key, return the wanted state of that key.
     * @param keyName a key to return
     */
    private getWantedStateForKey(keyName: string): StateInfo {
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

    private onSettingsChanged = (settings: any) => {
        this.keysInLayout = KeyInfo[settings.layout];
    }

    private onStateApplyRequested(): void {
        this.hardwareKeyboard.freezeEffects();
        this.hardwareKeyboard.apply();
    }

    /**
     * Updates the wanted state with the provided key changes.
     * @param data an array of state changes
     * @param sync whether or not to immediately sync the changes
     */
    public onStateChangeRequested = (data: StateChangeRequest[], sync = true) => {
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
     * Sets up a keyboard after waiting 2000ms
     */
    private setupKeyboard() {
        setTimeout(() => {
            try {
                this.logger.info("Initializing keyboard...");
                this.hardwareKeyboard.find();

                // we found a keyboard, let's go ahead and handle taking over it
                this.hardwareKeyboard.initialize();
                this.keyboardInfo.firmware = this.hardwareKeyboard.getKeyboardData().firmware;
                this.keyboardConnected = true;


                this.logger.info("Keyboard initialization complete.");
                this.keyboardEvents.emit("onKeyboardConnected");

            } catch (e) {
                this.disconnectKeyboard();
                this.logger.warn("Keyboard initialization failed.", e);
            }
        }, 2000);
    }

    /**
     * Cleans up the keyboard connection from the node-lib
     */
    private disconnectKeyboard() {
        this.keyboardConnected = false;
        this.keyboardInfo.firmware = "unknown";
        this.hardwareKeyboard.close();
    }

    /**
     * Syncs any pending changes, if necessary.
     */
    private sync() {
        // only sync if it needs it, and there is actually a keyboard
        this.logger.info("Tick");
        if (this.needsSync && this.keyboardConnected) {
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
                    this.onStateApplyRequested();
                }

                // we've successfully synced everything!
                this.needsSync = false;
            } catch (e) {
                this.logger.warn(e);
            }
        }
        this.keyboardEvents.emit("onProfileTickRequest");
        this.keyboardEvents.emit("onSignalTickRequest");

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
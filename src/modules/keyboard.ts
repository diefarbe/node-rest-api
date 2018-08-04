import { ChannelState, IKeyMapCulture, Keyboard, KeyInfo, KeyModel, KeyState } from "@diefarbe/lib";
import usbDetect from "usb-detection";
import { IChannelInfo, IStateChangeRequest, IStateInfo } from "../types";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { Logger } from "../utils/Logger";
import { State } from "../utils/State";
import { DefaultSettings } from "./settings";

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
 * a onStateChangeRequested event. This event is then added to the wanted state and will sync to the 
 * keyboard once 1000ms passes, or the user has requested an immediate sync.
 * 
 */
export class KeyboardModule {

    private readonly logger = new Logger("KeyboardModule");
    private readonly hardwareKeyboard: Keyboard;
    private readonly currentState = new State();
    private readonly wantedState = new State();

    private redrawTimer: NodeJS.Timer | null = null;
    private setupKeyboardTimeout: NodeJS.Timer | null = null;
    private keyboardConnected: boolean = false;

    private keysInLayout: IKeyMapCulture;

    private keyboardInfo: { firmware: string } = { firmware: "unknown" };

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
    public init() {
        this.keyboardEvents.addListener("onSettingsChanged", this.onSettingsChanged);
        this.keyboardEvents.addListener("onStateChangeRequested", this.onStateChangeRequested);

        usbDetect.startMonitoring();

        // There's a filtered search, but it seems broken...
        usbDetect.find((error: any, devices: any) => {
            for (const device of devices) {
                if (device.vendorId === 9456) {
                    this.logger.info("Found a keyboard.");
                    this.setupKeyboard();
                }
            }
        });

        usbDetect.on("remove:9456", (device: any) => {
            this.logger.info("Removed a keyboard.");
            this.disconnectKeyboard();
        });

        usbDetect.on("add:9456", (device: any) => {
            this.logger.info("Added a keyboard.");
            this.setupKeyboard();
        });

        this.redrawTimer = setInterval(() => this.redrawKeyboard(), 1000);
    }

    public deinit() {
        this.keyboardEvents.removeListener("onSettingsChanged", this.onSettingsChanged);
        this.keyboardEvents.removeListener("onStateChangeRequested", this.onStateChangeRequested);

        // stop the redrawTimer
        if (this.redrawTimer != null) {
            clearTimeout(this.redrawTimer);
            this.redrawTimer = null;
        }

        // restore the default rainbow pattern
        this.restoreHardwareProfile();

        // stop monitoring the usbs
        usbDetect.stopMonitoring();

        // disconnect from any current keyboard
        this.disconnectKeyboard();
    }

    public redrawKeyboard() {
        this.logger.info("Tick");
        this.keyboardEvents.emit("onProfileTickRequest");
        this.keyboardEvents.emit("onSignalTickRequest");

        this.sync();
    }

    /**
     * returns the current keyboard info including firmware version and key states
     */
    public getInfo() {
        return {
            info: this.keyboardInfo,
            state: this.getWantedStatesForAllKeys(),
        };
    }

    /**
     * Returns the wanted states of all keys.
     */
    public getWantedStatesForAllKeys() {
        const keys: IStateChangeRequest[] = [];

        for (const keyName in this.keysInLayout) {
            if (this.keysInLayout.hasOwnProperty(keyName)) {
                keys.push({
                    data: this.getWantedStateForKey(keyName),
                    key: keyName,
                });
            }
        }

        return keys;
    }

    /**
     * Updates the wanted state with the provided key changes.
     * @param data an array of state changes
     * @param sync whether or not to immediately sync the changes
     */
    public onStateChangeRequested = (data: IStateChangeRequest[], sync = true) => {
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
     * Given a single key, return the wanted state of that key.
     * @param keyName a key to return
     */
    private getWantedStateForKey(keyName: string): IStateInfo {
        const goal = this.wantedState[keyName];
        if (goal !== undefined) {
            return goal;
        } else {
            return this.currentState[keyName];
        }
    }

    private onSettingsChanged = (settings: DefaultSettings) => {
        this.keysInLayout = KeyInfo[settings.layout];
    }

    private onStateApplyRequested(): void {
        this.hardwareKeyboard.freezeEffects();
        this.hardwareKeyboard.apply();
    }

    /**
     * Sets up a keyboard after waiting 2000ms
     */
    private setupKeyboard() {
        if (this.setupKeyboardTimeout != null) {
            clearTimeout(this.setupKeyboardTimeout);
            this.setupKeyboardTimeout = null;
        }
        this.setupKeyboardTimeout = setTimeout(() => {
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
        if (this.needsSync && this.keyboardConnected) {
            try {
                let changed = false;
                for (const keyName in this.wantedState) {
                    if (this.wantedState.hasOwnProperty(keyName)) {

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

    }

    private internalSendKeyData(key: KeyModel, channel: "red" | "green" | "blue", data: IChannelInfo) {
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

        this.logger.info("Sending data to keys");
        this.hardwareKeyboard.setKeyColorChannel(aState);
    }

    private restoreHardwareProfile() {
        for (const keyName in this.keysInLayout) {
            if (this.keysInLayout.hasOwnProperty(keyName)) {
                const key = this.keysInLayout[keyName];
                this.hardwareKeyboard.setKeyState(new KeyState(key).setApplyDelayed().setToHardwareProfile());
            }
        }
        this.hardwareKeyboard.apply();
    }
}
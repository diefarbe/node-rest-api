import { ChannelState, Keyboard, KeyInfo, KeyModel } from "das";
import { ChannelInfo, StateChangeRequest } from "../types";
import { SettingsModule } from "./settings";

const usbDetect = require("usb-detection");

export class KeyboardModule {

    public readonly hardwareKeyboard: Keyboard;
    private readonly settings: SettingsModule;
    private _connectionChanged: ((connected: boolean) => void) | null = null;
    private firmwareVersionString: string = "0.0.0";
    private isInitalized: boolean = false;

    constructor(settings: SettingsModule) {
        this.settings = settings;
        this.hardwareKeyboard = new Keyboard();
    }

    public set connectionChanged(connectionChanged: (connected: boolean) => void) {
        this._connectionChanged = connectionChanged;
    }

    public init() {
        usbDetect.startMonitoring();

        // There's a filtered search, but it seems broken...
        usbDetect.find((error: any, devices: any) => {
            for (const device of devices) {
                if (device.vendorId === 9456) {
                    console.log("Keyboard: Found a das keyboard, initalizing");
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

            console.log("Keyboard: Found a das keyboard, initalizing");
            setTimeout(() => {
                this.internalSetupKeyboard();
            }, 2000);
        });
    }

    public close() {
        this.hardwareKeyboard.close();
    }

    public hasKeyboard() {
        return this.isInitalized;
    }

    public processKeyChanges(changes: StateChangeRequest[]): void {
        if (!this.isInitalized) {
            throw new Error("keyboard is not initialized");
        }
        this.applyKeyboardChanges(changes);
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

    private internalSetupKeyboard() {
        try {
            this.hardwareKeyboard.find();

            // we found a keyboard, let's go ahead and handle taking over it
            this.hardwareKeyboard.initialize();
            this.firmwareVersionString = this.hardwareKeyboard.getKeyboardData().firmware;

            console.log("Got keyboard");

            this.isInitalized = true;
            if (this._connectionChanged != null) {
                this._connectionChanged(true);
            }
        } catch {
            console.log("Failed to take over keyboard");
            this.isInitalized = false;
        }
    }

    private cleanupKeyboardDisconnect() {
        this.isInitalized = false;
        if (this._connectionChanged != null) {
            this._connectionChanged(false);
        }
        this.hardwareKeyboard.close();

    }

    private applyKeyboardChanges(changes: StateChangeRequest[]) {
        for (const change of changes) {

            const key = KeyInfo[this.settings.getLayout()][change.key];

            this.internalSendKeyData(key, "red", change.data.red);
            this.internalSendKeyData(key, "green", change.data.green);
            this.internalSendKeyData(key, "blue", change.data.blue);
        }
        // NOTE: not calling freezeEffects() or apply() here as StateModule does that now
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

import { Keyboard, KeyInfo, KeyState } from "das";
var usbDetect = require('usb-detection');
import { StateInfo, ChannelInfo, StateChangeRequest } from "./state";
import { KeyModel } from "../node_modules/das/dist/internal/models/key-model";
import { ChannelState } from "../node_modules/das/dist/channel-state";

export class APIKeyboard {

    keyboard: Keyboard;

    isInitalized: boolean = false;

    firmwareVersionString: string = "0.0.0";

    red: { [key in string ]: ChannelInfo } = {}
    green: { [key in string ]: ChannelInfo } = {}
    blue: { [key in string ]: ChannelInfo } = {}

    constructor() {
        this.keyboard = new Keyboard();
        usbDetect.startMonitoring();
        usbDetect.on("remove:9456", (device: any) => {
            if (this.isInitalized) {
                console.log("Removed a das keyboard");
                this.isInitalized = false;
            }

        })
    }

    hasKeyboard() {
        if (this.isInitalized) {
            // we've already setup a keyboard
            // TODO what do we do if we unplug? should we reset this
            return true;
        }

        try {
            this.keyboard.find();

            // we found a keyboard, let's go ahead and handle taking over it
            this.initalizeKeyboard()

            return true;
        } catch {
            this.isInitalized = false;
            return false;
        }
    }

    initalizeKeyboard() {
        this.keyboard.initialize();

        this.firmwareVersionString = this.keyboard.getKeyboardData().firmware;

        this.isInitalized = true;
    }

    getBasicInfo() {
        if (this.isInitalized) {
            return {
                firmware: this.firmwareVersionString,
                layout: "en_US"
            }
        }
        return null;
    }

    getKeyData(key: string): StateInfo {
        return {
            red: this.getKeyChannelData(key, "red"),
            green: this.getKeyChannelData(key, "green"),
            blue: this.getKeyChannelData(key, "blue"),
        }
    }

    getAllKeyData() {

        const keys: StateChangeRequest[] = [];

        const keysDescriptions = Object.keys(KeyInfo["en-US"])
        for (const keyDesc of keysDescriptions) {
            keys.push({
                key: keyDesc,
                data: this.getKeyData(keyDesc),
            });
        }
        return keys;
    }

    getKeyChannelData(key: string, type?: "red" | "green" | "blue"): ChannelInfo {
        if (type === "red") {
            return this.handleChannelData(key, this.red);
        }
        if (type === "green") {
            return this.handleChannelData(key, this.green);
        }
        if (type === "blue") {
            return this.handleChannelData(key, this.blue);
        }
        throw new Error("unknown channel");
    }

    handleChannelData(key: string, channel: any): ChannelInfo {
        if (channel.hasOwnProperty(key)) {
            return channel[key];
        }
        return this.getDummyData();
    }

    getDummyData() {
        return {}
    }

    processKeyChanges(changes: StateChangeRequest[]): any {
        for (const change of changes) {
            this.red[change.key] = change.data.red;
            this.green[change.key] = change.data.green;
            this.blue[change.key] = change.data.blue;
        }
        this.applyKeyboardChanges(changes);
        return {
            ok: true,
        }
    }

    applyKeyboardChanges(changes: StateChangeRequest[]) {
        for (const change of changes) {

            const key = KeyInfo["en-US"][change.key];

            this.internalSendKeyData(key, "red", change.data.red);
            this.internalSendKeyData(key, "green", change.data.green);
            this.internalSendKeyData(key, "blue", change.data.blue);
        }
    }

    private internalSendKeyData(key: KeyModel, channel: "red" | "green" | "blue" , data: ChannelInfo) {
        this.keyboard.setKeyColorChannel(
            new ChannelState(key, channel)

                .setUpMaximumLevel(data.upMaximumLevel)
                .setUpIncrement(data.upIncrement)
                .setUpIncrementDelay(data.upIncrementDelay)
                .setUpHoldDelay(data.upHoldDelay)
                .setUpHoldLevel(data.upHoldLevel)

                .setDownMinimumLevel(data.downMinimumLevel)
                .setDownDecrement(data.downDecrement)
                .setDownDecrementDelay(data.downDecrementDelay)
                .setDownHoldLevel(data.downHoldLevel)
                .setDownHoldDelay(data.downHoldDelay)
                
                .setStartDelay(0)
        )
    }

}
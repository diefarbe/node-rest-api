import {Keyboard, KeyInfo, KeyState} from "das/dist";

var usbDetect = require('usb-detection');
import {StateInfo, ChannelInfo, StateChangeRequest} from "./state";
import {KeyModel} from "das/dist/internal/models";
import {ChannelState} from "das/dist/channel-state";

export class APIKeyboard {

    keyboard: Keyboard;

    isInitalized: boolean = false;

    firmwareVersionString: string = "0.0.0";

    red: { [key in string]: ChannelInfo } = {}
    green: { [key in string]: ChannelInfo } = {}
    blue: { [key in string]: ChannelInfo } = {}

    constructor() {
        this.keyboard = new Keyboard();
        usbDetect.startMonitoring();

        usbDetect.find(9456, (error: any, device: any) => {
            console.log("Found a das keyboard, initalizing");
            this.internalSetupKeyboard();
        })

        usbDetect.on("remove:9456", (device: any) => {
            console.log("Removed a das keyboard");
            this.cleanupKeyboardDisconnect();
        })

        usbDetect.on("add:9456", (device: any) => {
            console.log("Added a das keyboard");

            console.log("Waiting 2 seconds to take over while keyboard boots");
            setTimeout(() => {
                this.internalSetupKeyboard();
            }, 2000);
        })
    }

    internalSetupKeyboard() {
        try {
            this.keyboard.find();

            // we found a keyboard, let's go ahead and handle taking over it
            this.initalizeKeyboard()

            console.log("Got that keyboard");

            this.isInitalized = true;
        } catch {
            console.log("Failed to take over keyboard");
            this.isInitalized = false;
        }
    }

    cleanupKeyboardDisconnect() {
        this.isInitalized = false;
    }

    hasKeyboard() {
        return this.isInitalized
    }

    initalizeKeyboard() {
        this.keyboard.initialize();

        this.firmwareVersionString = this.keyboard.getKeyboardData().firmware;
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
        let data: { [key: string]: any } = {};
        if (type === "red") {
            data = this.handleChannelData(key, this.red);
        }
        if (type === "green") {
            data = this.handleChannelData(key, this.green);
        }
        if (type === "blue") {
            data = this.handleChannelData(key, this.blue);
        }

        const ordered: { [key: string]: any } = {};
        Object.keys(data).sort().forEach(function (key) {
            ordered[key] = data[key];
        });
        return ordered;

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
        this.keyboard.freezeEffects();
        this.keyboard.apply();
    }

    private internalSendKeyData(key: KeyModel, channel: "red" | "green" | "blue", data: ChannelInfo) {

        //console.log("Parsing a " + channel + " channel:");
        //console.log(JSON.stringify(data, null, 4));

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

        this.keyboard.setKeyColorChannel(
            aState,
        )
    }

}
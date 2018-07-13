import { ChannelInfo, StateInfo, StateChangeRequest } from "types";
import { KeyInfo } from "das/dist/key-info";
import { KeyboardModule } from "./keyboard";
import { SettingsModule } from "./settings";

/**
 * The Module in charge of holding the current state of every switch
 */
export class StateModule {

    red: { [key in string]: ChannelInfo } = {}
    green: { [key in string]: ChannelInfo } = {}
    blue: { [key in string]: ChannelInfo } = {}

    private readonly settings: SettingsModule;

    constructor(settings: SettingsModule) {
        this.settings = settings;
    }

    /**
     * Given a single key, return the current state of that key
     * @param key a key to return
     */
    getKeyData(key: string): StateInfo {
        return {
            red:  this.getKeyChannelData(key, "red"),
            green:  this.getKeyChannelData(key, "green"),
            blue:  this.getKeyChannelData(key, "blue"),
        }
    }

    /**
     * Given ALL the key data, 
     */
    getAllKeyData() {
        const keys: StateChangeRequest[] = [];

        const keysDescriptions = Object.keys(KeyInfo[this.settings.getLayout()])
        for (const keyDesc of keysDescriptions) {
            keys.push({
                key: keyDesc,
                data: this.getKeyData(keyDesc),
            });
        }
        return keys;
    }

    /**
     * 
     * @param data an array of state changes
     */
    processKeyChanges(data: StateChangeRequest[]) {
        for (const change of data) {
            this.red[change.key] = change.data.red;
            this.green[change.key] = change.data.green;
            this.blue[change.key] = change.data.blue;
        }
    }

    private handleChannelData(key: string, channel: any): ChannelInfo {
        if (channel.hasOwnProperty(key)) {
            return channel[key];
        }
        return {};
    }

    private getKeyChannelData(key: string, type?: "red" | "green" | "blue"): ChannelInfo {
        let data: { [key: string]: any } = {};
        if (type === "red") {
            data = this.handleChannelData(key,  this.red);
        }
        if (type === "green") {
            data = this.handleChannelData(key,  this.green);
        }
        if (type === "blue") {
            data = this.handleChannelData(key,  this.blue);
        }

        const ordered: { [key: string]: any } = {};
        Object.keys(data).sort().forEach(function (key) {
            ordered[key] = data[key];
        });
        return ordered;
    }

}
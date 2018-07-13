import { KeyInfo } from "das/dist/key-info";
import { ChannelInfo, StateChangeRequest, StateInfo } from "types";
import { KeyboardModule } from "./keyboard";
import { SettingsModule } from "./settings";

/**
 * The Module in charge of holding the current state of every switch
 */
export class StateModule {

    public red: { [key in string]: ChannelInfo } = {};
    public green: { [key in string]: ChannelInfo } = {};
    public blue: { [key in string]: ChannelInfo } = {};

    private readonly settings: SettingsModule;

    constructor(settings: SettingsModule) {
        this.settings = settings;
    }

    /**
     * Given a single key, return the current state of that key
     * @param key a key to return
     */
    public getKeyData(key: string): StateInfo {
        return {
            red:  this.getKeyChannelData(key, "red"),
            green:  this.getKeyChannelData(key, "green"),
            blue:  this.getKeyChannelData(key, "blue"),
        };
    }

    /**
     * Given ALL the key data, 
     */
    public getAllKeyData() {
        const keys: StateChangeRequest[] = [];

        const keysDescriptions = Object.keys(KeyInfo[this.settings.getLayout()]);
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
    public processKeyChanges(data: StateChangeRequest[]) {
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
        Object.keys(data).sort().forEach(function(key) {
            ordered[key] = data[key];
        });
        return ordered;
    }

}
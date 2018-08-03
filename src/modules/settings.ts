import * as fs from "fs";
import { Logger } from "../utils/Logger";
import { KeyboardEvents } from "../utils/KeyboardEvents";

export const DefaultSettings = {
    profile: "default",
    signals: ["cpu_utilization_max"],
    layout: "en-US",
};

export type DefaultSettings = typeof DefaultSettings;

export class SettingsModule {
    private readonly logger = new Logger("SettingsModule");

    private readonly settingsJSON: string;

    constructor(private configPath: string, private events: KeyboardEvents) {
        this.logger.info("Config directory: " + configPath);
        this.settingsJSON = this.configPath + "/settings.json";
    }

    private settings: DefaultSettings = DefaultSettings;

    public init() {
        this.logger.info("Loading settings...");
        const shouldSetup = this.shouldDoInitialSetup();
        if (shouldSetup) {
            this.initialSetup();
        }
        this.readSettings();
        this.logger.info("Settings load complete.");
    }

    public getSettings() {
        return this.settings;
    }

    public pushSetting(data: DefaultSettings) {
        const keys: Array<keyof DefaultSettings> = Object.keys(data) as Array<keyof DefaultSettings>;
        for (const key of keys) {
            this.settings[key] = data[key];
        }
        this.writeJsonToFile(this.settings);
    }

    private shouldDoInitialSetup() {
        return new Promise<boolean>((resolve, reject) => {
            fs.access(this.configPath, fs.constants.F_OK, (err) => {
                if (err) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }

    private initialSetup() {
        return new Promise<void>((resolve, reject) => {
            fs.mkdirSync(this.configPath);
            this.writeJsonToFile(DefaultSettings);
            resolve();
        });
    }

    private readSettings() {
        return new Promise<void>((resolve, reject) => {
            fs.readFile(this.settingsJSON, (err, data) => {
                if (data === undefined) throw new Error(this.settingsJSON + " is corrupted");
                const savedSettings = JSON.parse(data.toString("utf8"));

                this.settings = {
                    ...DefaultSettings,
                    ...savedSettings,
                }
                this.writeJsonToFile(this.settings);
                this.events.emit("onSettingsChanged", this.settings);
                resolve();
            });
        });
    }

    private writeJsonToFile(data: DefaultSettings) {
        fs.writeFile(this.settingsJSON, JSON.stringify(data), (err) => {
            if (err) {
                throw err;
            }
            this.events.emit("onSettingsChanged", this.settings);
        });
    }
}
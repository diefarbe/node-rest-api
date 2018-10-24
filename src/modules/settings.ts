import * as fs from "fs";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { Logger } from "../utils/Logger";
import { Module } from "../types";

export const DEFAULT_SETTINGS = {
    layout: "en-US",
    profile: "default",
    signals: ["cpu_utilization_max"],
};

export type Settings = typeof DEFAULT_SETTINGS;

export class SettingsModule implements Module {
    private readonly logger = new Logger("SettingsModule");

    private readonly settingsJSON: string;

    private settings: Settings = DEFAULT_SETTINGS;

    constructor(private configPath: string, private events: KeyboardEvents) {
        this.logger.info("Config directory: " + configPath);
        this.settingsJSON = this.configPath + "/settings.json";
    }

    public init(): void {
        this.logger.info("Loading settings...");

        // check if we need to setup in the first place
        const configExists = fs.existsSync(this.configPath);
        if (!configExists) {
            fs.mkdirSync(this.configPath);
        }

        // read our current settings
        let savedSettings = {};
        try {
            const data = fs.readFileSync(this.settingsJSON);
            if (data !== undefined) {
                savedSettings = JSON.parse(data.toString("utf8"));
            }
        } catch (e) {
            this.logger.warn("Failed to load settings. Assuming empty/non-existent settings.");
        }

        // overwrite the defaults
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...savedSettings,
        };
        this.writeSettings(this.settings);

        this.logger.info("Settings load complete.");
    }

    public deinit(): void {
    }

    public getSettings() {
        return this.settings;
    }

    public pushSetting(data: Settings) {
        for (const key of <(keyof Settings)[]>Object.keys(data)) {
            this.settings[key] = data[key];
        }
        this.writeSettings(this.settings);
    }

    private writeSettings(data: Settings) {
        // remove all the default settings from it
        let diff = <Settings>JSON.parse(JSON.stringify(data));
        for (const key of <(keyof Settings)[]>Object.keys(data)) {
            let setting = diff[key];
            let def = DEFAULT_SETTINGS[key];
            if (JSON.stringify(setting) == JSON.stringify(def)) {
                delete diff[key];
            }
        }

        // write the diffs
        fs.writeFileSync(this.settingsJSON, JSON.stringify(diff));

        this.events.settingsUpdated(this.settings);
    }
}
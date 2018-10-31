import * as fs from "fs";
import { IModule } from "../types";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { Logger } from "../utils/Logger";

export const DEFAULT_SETTINGS = {
    layout: "en-US",
    profile: "bc7f63d06f675130ca6e722c6cd056c588272b2966d6e2952702925aa2bd44ee",
    signals: [] as string[],
};

export type Settings = typeof DEFAULT_SETTINGS;

export class SettingsModule implements IModule {
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
        // no-op
    }

    public getSettings() {
        return this.settings;
    }

    public pushSetting(data: Settings) {
        for (const key of Object.keys(data) as Array<keyof Settings>) {
            this.settings[key] = data[key];
        }
        this.writeSettings(this.settings);
    }

    private writeSettings(data: Settings) {
        // remove all the default settings from it
        const diff = JSON.parse(JSON.stringify(data)) as Settings;
        for (const key of Object.keys(data) as Array<keyof Settings>) {
            const setting = diff[key];
            const def = DEFAULT_SETTINGS[key];
            if (JSON.stringify(setting) === JSON.stringify(def)) {
                delete diff[key];
            }
        }

        // write the diffs
        fs.writeFileSync(this.settingsJSON, JSON.stringify(diff, null, 4));

        this.events.settingsUpdated(this.settings);
    }
}
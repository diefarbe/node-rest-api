import * as fs from "fs";
import { Profile, StateChangeRequest } from "types";
import { Logger } from "../log";

export class SettingsModule {
    private readonly logger = new Logger("SettingsModule");

    private static readonly homedir = require("os").homedir();
    private static readonly configDirectory = SettingsModule.homedir + "/.config";
    private static readonly ourDirectory = SettingsModule.configDirectory + "/diefarbe";

    private static readonly profileDirectory = SettingsModule.ourDirectory + "/profiles";
    private static readonly settingsJSON = SettingsModule.ourDirectory + "/settings.json";

    private static readonly DefaultSettings = {
        profile: "default",
        layout: "en-US",
    };

    private settings: { [key: string]: string } = {};
    private profiles: { [key: string]: Profile } = {};

    public async init() {
        this.logger.info("Loading settings...");
        const shouldSetup = await this.shouldDoInitialSetup();
        if (shouldSetup) {
            await this.initialSetup();
        }
        await this.readSettings();
        this.logger.info("Settings load complete.");
    }

    public getProfiles(): { [key: string]: Profile } {
        return this.profiles;
    }

    public getSettings() {
        return this.settings;
    }

    public getLayout() {
        return this.settings.layout;
    }

    public pushSetting(data: any) {
        for (const key of Object.keys(data)) {
            this.settings[key] = data[key];
        }
        fs.writeFile(SettingsModule.settingsJSON, JSON.stringify(this.settings), (err) => {
            if (err) {
                throw err;
            }
        });
    }

    public saveProfile(data: any, keys: StateChangeRequest[]) {
        return new Promise<any>((resolve, reject) => {
            const uuidv4 = require("uuid/v4");
            const uuid = uuidv4();
            const profile = {
                name: data.name,
                uuid,
                enabledSignals: "all",
                defaultAnimations: {
                    "en-US": keys
                },
            };
            this.profiles[uuid] = profile;
            fs.writeFile(SettingsModule.profileDirectory + "/" + uuid + ".json", JSON.stringify(profile), (err) => {
                if (err) {
                    reject();
                }
                resolve(profile);
            });
        });
    }

    public deleteProfile(id: string) {
        delete this.profiles[id];
        fs.unlinkSync(SettingsModule.profileDirectory + "/" + id + ".json");
        return { id };
    }

    private shouldDoInitialSetup() {
        return new Promise<boolean>((resolve, reject) => {
            fs.access(SettingsModule.configDirectory, fs.constants.F_OK, (err) => {
                if (err) {
                    fs.mkdirSync(SettingsModule.configDirectory);
                }

                fs.access(SettingsModule.ourDirectory, fs.constants.F_OK, (err) => {
                    if (err) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            });
        });
    }

    private initialSetup() {
        return new Promise<void>((resolve, reject) => {
            fs.mkdirSync(SettingsModule.ourDirectory);
            fs.mkdirSync(SettingsModule.profileDirectory);
            fs.writeFile(SettingsModule.settingsJSON,
                JSON.stringify(SettingsModule.DefaultSettings), (err) => {
                    if (err) {
                        reject(err);
                    }
                    this.logger.info("Initial setup complete.");
                    resolve();
                });
        });
    }

    private readSettings() {
        return new Promise<void>((resolve, reject) => {
            fs.readFile(SettingsModule.settingsJSON, (err, data) => {
                this.settings = JSON.parse(data.toString("utf8"));

                const paths = fs.readdirSync(SettingsModule.profileDirectory);
                for (const path of paths) {
                    if (path.endsWith(".json")) {
                        this.logger.info("Found profile:", SettingsModule.profileDirectory + "/" + path);
                        this.loadProfileIntoMemory(SettingsModule.profileDirectory + "/" + path);
                    }
                }
                this.profiles.default = require("../../assets/profiles/dim.json");

                resolve();
            });
        });
    }

    private loadProfileIntoMemory(path: string) {
        fs.readFile(path, (err, data) => {
            const profile = JSON.parse(data.toString("utf8"));
            if (profile.hasOwnProperty("uuid")) {
                this.profiles[profile.uuid] = profile;
            }
        });
    }
}
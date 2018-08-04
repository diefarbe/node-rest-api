import * as fs from "fs";
import { IProfile, IStateChangeRequest } from "../types";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { Logger } from "../utils/Logger";
import { DefaultSettings } from "./settings";

/**
 * The Profile module, in charge of keeping the profile set on an attached keyboard
 * 
 * Events we listen to include:
 * 
 * onSettingsChanged: We load a list of profiles into memory
 * onInitialSetupComplete: We create a profile directory
 * onProfileTickRequest: We set the desired profile
 */
export class ProfileModule {

    private readonly logger = new Logger("ProfileModule");

    private profiles: { [key: string]: IProfile } = {};
    private readonly profileDirectory: string;
    private currentProfileUUID: string = "default";
    private currentLayout: string = "en-US";

    constructor(configPath: string, private keyboardEvents: KeyboardEvents) {
        this.profileDirectory = configPath + "/profiles";
    }

    public init(): void {
        this.keyboardEvents.addListener("onSettingsChanged", this.onSettingsChanged);
        this.keyboardEvents.addListener("onInitialSetupComplete", this.onInitialSetupComplete);
        this.keyboardEvents.addListener("onProfileTickRequest", this.onProfileTickRequest);
    }

    public deinit(): void {
        this.keyboardEvents.removeListener("onSettingsChanged", this.onSettingsChanged);
        this.keyboardEvents.removeListener("onInitialSetupComplete", this.onInitialSetupComplete);
        this.keyboardEvents.removeListener("onProfileTickRequest", this.onProfileTickRequest);
    }

    public getInfo(profileUUID?: string) {
        if (typeof profileUUID !== "undefined") {
            return this.profiles[profileUUID];
        }
        return this.profiles;
    }

    public saveProfile(data: any, keys: IStateChangeRequest[]) {
        return new Promise<any>((resolve, reject) => {
            const uuidv4 = require("uuid/v4");
            const uuid = uuidv4();
            const profile = {
                defaultAnimations: {
                    "en-US": keys
                },
                name: data.name,
                uuid,
            };
            this.profiles[uuid] = profile;
            fs.writeFile(this.profileDirectory + "/" + uuid + ".json", JSON.stringify(profile), (err) => {
                if (err) {
                    reject();
                }
                resolve(profile);
            });
        });
    }

    public deleteProfile(id: string) {
        delete this.profiles[id];
        fs.unlinkSync(this.profileDirectory + "/" + id + ".json");
        return { id };
    }

    public onSettingsChanged = (settings: DefaultSettings) => {
        this.currentProfileUUID = settings.profile;
        this.currentLayout = settings.layout;
        this.profiles = {};
        this.loadProfilesFromPath(this.profileDirectory);

        this.profiles.default = require("../../assets/profiles/dim.json");
    }

    public onProfileTickRequest = () => {
        const ourProfile = this.profiles[this.currentProfileUUID];
        const changes = ourProfile.defaultAnimations[this.currentLayout];
        this.keyboardEvents.emit("onStateChangeRequested", changes, false);
    }

    private onInitialSetupComplete = () => {
        fs.mkdirSync(this.profileDirectory);
    }

    private loadProfilesFromPath(configDir: string) {
        const paths = fs.readdirSync(configDir);
        for (const path of paths) {
            if (path.endsWith(".json")) {
                this.logger.info("Found profile:", this.profileDirectory + "/" + path);
                this.loadProfileIntoMemory(this.profileDirectory + "/" + path);
            }
        }
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
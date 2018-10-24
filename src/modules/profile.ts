import * as fs from "fs";
import { IModule, IProfile, IStateChangeRequest } from "../types";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { Logger } from "../utils/Logger";
import { Settings } from "./settings";

/**
 * The Profile module, in charge of keeping the profile set on an attached keyboard
 *
 * Events we listen to include:
 *
 * onSettingsChanged: We load a list of profiles into memory
 * onInitialSetupComplete: We create a profile directory
 * onProfileTickRequest: We set the desired profile
 */
export class ProfileModule implements IModule {

    private readonly logger = new Logger("ProfileModule");

    private profiles: { [key: string]: IProfile } = {};
    private readonly profileDirectory: string;
    private currentProfileUUID: string = "default";
    private currentLayout: string = "en-US";

    constructor(configPath: string, private keyboardEvents: KeyboardEvents) {
        this.profileDirectory = configPath + "/profiles";
    }

    public init(): void {
        this.keyboardEvents.addSettingsListener(this.onSettingsChanged);
        this.keyboardEvents.addRedrawListener(this.onRedrawRequested, 0);
    }

    public deinit(): void {
        this.keyboardEvents.removeSettingsListener(this.onSettingsChanged);
        this.keyboardEvents.removeRedrawListener(0);
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

    private onSettingsChanged = (settings: Settings) => {
        this.currentProfileUUID = settings.profile;
        this.currentLayout = settings.layout;
        this.profiles = {};
        this.loadProfiles();

        this.profiles.default = require("../../profiles/dim.json");
    };

    private onRedrawRequested = () => {
        const ourProfile = this.profiles[this.currentProfileUUID];
        const changes = ourProfile.defaultAnimations[this.currentLayout];
        this.keyboardEvents.requestStateChange(changes);
    };

    private loadProfiles() {
        // check if we need to setup in the first place
        const configExists = fs.existsSync(this.profileDirectory);
        if (!configExists) {
            fs.mkdirSync(this.profileDirectory);
        }
        
        const paths = fs.readdirSync(this.profileDirectory);
        for (const file of paths) {
            if (file.endsWith(".json")) {
                const path = this.profileDirectory + "/" + file; 
                this.logger.info("Found profile:", path);

                const data = fs.readFileSync(path);
                const profile = JSON.parse(data.toString("utf8"));
                if (profile.hasOwnProperty("uuid")) {
                    this.profiles[profile.uuid] = profile;
                }
            }
        }
    }
}
import { KeyboardModule } from "../modules/keyboard";
import { SettingsModule } from "../modules/settings";

export function init(keyboard: KeyboardModule, settings: SettingsModule) {

    return {
        async find() {
            const profiles = settings.getProfiles();
            return profiles;
        },
        async get(key: string) {
            const profiles = settings.getProfiles();
            return profiles[key];
        },
        async create(data: any) {
            const profile = settings.saveProfile(data, keyboard.getWantedStatesForAllKeys());
            return Promise.resolve(profile);
        },
        async remove(id: string) {
            const profile = settings.deleteProfile(id);
            return Promise.resolve(profile);
        }
    };

}

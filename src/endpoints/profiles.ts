import { KeyboardModule } from "../modules/keyboard";
import { SettingsModule } from "../modules/settings";
import { StateModule } from "../modules/state";

export function init(apiKeyboard: KeyboardModule, settings: SettingsModule, state: StateModule) {

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
            const profile = settings.saveProfile(data, state.getAllKeyData());
            return Promise.resolve(profile);
        },
        async remove(id: string) {
            const profile = settings.deleteProfile(id);
            return Promise.resolve(profile);
        }
    };

}

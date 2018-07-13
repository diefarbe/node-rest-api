import { APIKeyboard } from "keyboard";
import { Settings } from "settings";


export function init(apiKeyboard: APIKeyboard, settings: Settings) {

    return {
        async find() {
            let profiles = settings.getProfiles();
            return profiles;
        },
        async get(key: string) {
            let profiles = settings.getProfiles();
            return profiles[key];
        },
        async create(data: any) {
            const profile = await settings.saveProfile(data, apiKeyboard.getAllKeyData());
            return Promise.resolve(profile);
        },
        async remove(id: string) {
            const profile = await settings.deleteProfile(id);
            return Promise.resolve(profile);
        }
    }

};

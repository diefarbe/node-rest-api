import { KeyboardModule } from "../modules/keyboard";
import { ProfileModule } from "../modules/profile";

/**
 * The /profile endpoint
 * 
 * find() = GET /profile - displays a list of current profiles
 * get() - GET /profile/%uuid - displays a single profile
 * create() - POST /profile - creates a new profile given the current keystate and a name
 * remove() - DELETE /profile/%uuid - deletes a profile
 * 
 * @param keyboard 
 * @param settings 
 */
export function init(profile: ProfileModule, keyboard: KeyboardModule) {

    return {
        async find() {
            return profile.getInfo();
        },
        async get(id: string) {
            return profile.getInfo(id);
        },
        async update(id: string, data: any) {
            const currentData = this.get(id);
            this.remove(id);
            return this.create({
                ...currentData,
                ...data,
            });
        },
        async create(data: any) {
            const newProfile = profile.saveProfile(data, keyboard.getInfo().state);
            return Promise.resolve(newProfile);
        },
        async remove(id: string) {
            const oldProfile = profile.deleteProfile(id);
            return Promise.resolve(oldProfile);
        }
    };

}

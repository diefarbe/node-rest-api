import { SettingsModule } from "../modules/settings";


/**
 * The /settings endpoint
 * 
 * find() - GET /settings displays all the information about a keyboard's current settings
 * update() - PUT /settings changes a setting for the keyboard
 * 
 * @param apiKeyboard 
 * @param settings 
 */
export function init(settings: SettingsModule) {

    return {
        async find() {
            return {
                settings: settings.getSettings(),
                serverInfo: {
                    uptime: process.uptime(),
                }
            };
        },
        async update(id: string, data: any) {
            await settings.pushSetting(data);
            return this.find();
        }
    };

}

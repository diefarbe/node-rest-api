import { KeyboardModule } from "../modules/keyboard";
import { SettingsModule } from "../modules/settings";

export function init(apiKeyboard: KeyboardModule, settings: SettingsModule) {

    const hasKeyboard = apiKeyboard.hasKeyboard();

    return {
        async find() {
            return {
                keyboardInfo: {
                    hasKeyboard,
                    ...apiKeyboard.getBasicInfo(),
                },
                profileSettings: settings.getSettings(),
                serverInfo: {
                    uptime: process.uptime(),
                }
            };
        },
        async update(id: string, data: any) {
            await settings.pushSetting(data);
            return {
                hasKeyboard,
                keyboardInfo: apiKeyboard.getBasicInfo(),
                profileSettings: settings.getSettings(),
                serverInfo: {
                    uptime: process.uptime(),
                }
            };
        }
    };

}

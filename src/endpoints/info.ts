import { APIKeyboard } from "keyboard";
import { Settings } from "settings";

export function init(apiKeyboard: APIKeyboard, settings: Settings) {

    let hasKeyboard = apiKeyboard.hasKeyboard();

    return {
        async find() {
            return {
                keyboardInfo: {
                    hasKeyboard: hasKeyboard,
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
                hasKeyboard: hasKeyboard,
                keyboardInfo: apiKeyboard.getBasicInfo(),
                profileSettings: settings.getSettings(),
                serverInfo: {
                    uptime: process.uptime(),
                }
            };
        }
    }

};

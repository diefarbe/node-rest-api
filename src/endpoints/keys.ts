import { KeyboardModule } from "../modules/keyboard";
import { SettingsModule } from "../modules/settings";
import { StateChangeRequest } from "../types";

export function init(keyboard: KeyboardModule, settings: SettingsModule) {

    return {
        async find() {
            return keyboard.getAllKeyData();
        },
        async get(key: string) {
            return {
                key,
                data: keyboard.getKeyData(key),
            };
        },
        async update(item: any, data: StateChangeRequest[]) {
            keyboard.processKeyChanges(data);
            return {
                ok: true,
            };
        }
    };

}

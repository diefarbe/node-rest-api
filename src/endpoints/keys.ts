import { KeyboardModule } from "../modules/keyboard";
import { SettingsModule } from "../modules/settings";
import { StateChangeRequest } from "../types";
import { StateModule } from "../modules/state";


export function init(keyboard: KeyboardModule, settings: SettingsModule, state: StateModule) {

    return {
        async find() {
            return state.getAllKeyData();
        },
        async get(key: string) {
            return {
                key: key,
                data: state.getKeyData(key),
            };
        },
        async update(item: any, data: StateChangeRequest[]) {
            state.processKeyChanges(data);
            keyboard.processKeyChanges(data);
            return {
                ok: true,
            }
        }
    }

};

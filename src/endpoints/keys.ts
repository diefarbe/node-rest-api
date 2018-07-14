import { KeyboardModule } from "../modules/keyboard";
import { SettingsModule } from "../modules/settings";
import { StateModule } from "../modules/state";
import { StateChangeRequest } from "../types";

export function init(keyboard: KeyboardModule, settings: SettingsModule, state: StateModule) {

    return {
        async find() {
            return state.getAllKeyData();
        },
        async get(key: string) {
            return {
                key,
                data: state.getKeyData(key),
            };
        },
        async update(item: any, data: StateChangeRequest[]) {
            state.processKeyChanges(data);
            return {
                ok: true,
            };
        }
    };

}

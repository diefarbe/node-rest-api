import { APIKeyboard } from "keyboard";
import { Settings } from "settings";
import { StateChangeRequest } from "../state";


export function init(apiKeyboard: APIKeyboard, settings: Settings) {

    return {
        async find() {
            return apiKeyboard.getAllKeyData();
        },
        async get(key: string) {
            return {
                key: key,
                data: apiKeyboard.getKeyData(key),
            };
        },
        async update(item: any, data: StateChangeRequest[]) {
            console.log("DATA:" + JSON.stringify(data));
            return apiKeyboard.processKeyChanges(data);
        }
    }

};

import { KeyboardModule } from "../modules/keyboard";
import { IStateChangeRequest } from "../types";

/**
 * the state endpoint
 * 
 * find() - GET /keyboard displays the state the keyboard, including each key
 * update() - PUT /keyboard - sets the state of the keyboard keys
 * 
 * @param keyboard 
 * @param settings 
 */
export function init(keyboard: KeyboardModule) {

    return {
        async find() {
            return keyboard.getInfo();
        },
        async update(item: any, data: IStateChangeRequest[]) {
            keyboard.onStateChangeRequested(data, false);
            return {
                ok: true,
            };
        }
    };

}

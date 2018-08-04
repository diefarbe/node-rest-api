import { KeyboardModule } from "../modules/keyboard";
import { IStateChangeRequest } from "../types";

/**
 * the state endpoint
 * 
 * find() - GET /keyboard displays the state the keyboard, including each key
 * 
 * @param keyboard 
 * @param settings 
 */
export function init(keyboard: KeyboardModule) {

    return {
        async find() {
            return keyboard.getInfo();
        },
    };

}

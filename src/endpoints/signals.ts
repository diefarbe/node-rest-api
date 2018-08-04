import { IndicatorModule } from "../modules/indicators";
import { SignalsModule } from "../modules/signals";

/**
 * 
 * The Signals endpoint
 * 
 * find(): GET /signals - Displays all available signals and their values
 * update(): PUT /signals/%name - updates the signal's value, if updatable
 * 
 * @param apiKeyboard 
 * @param settings 
 * @param signals 
 */
export function init(indicator: IndicatorModule, signals: SignalsModule) {
    return {
        async find() {
            return indicator.getInfo();
        },
        async update(id: string, data: any) {
            return {};
        }
    };

}

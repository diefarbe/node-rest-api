import * as fs from "fs";
import {
    IModule,
    IPluginSignal,
    ISignalProviderPlugin,
    Signal,
} from "../types";
import { assertNever } from "../utils/Asserts";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { Logger } from "../utils/Logger";
import { Settings } from "./settings";

interface IEnabledSignal {
    pluginSignal: IPluginSignal;
    timer: NodeJS.Timer | null;
    hook: { unhook: () => void } | null;
    name: string;
}

export class SignalsModule implements IModule {
    private readonly logger = new Logger("SignalsModule");

    private signalPlugins: ISignalProviderPlugin[] = [];
    private enabledSignalPlugins: IEnabledSignal[] = [];

    private signals = new Map<string, Signal>();

    public constructor(
        private keyboardEvents: KeyboardEvents) {
    }

    public init() {
        this.logger.info("Initializing signals.");

        const pluginPaths = fs.readdirSync("plugins");
        for (const pluginPath of pluginPaths) {
            const pluginSource = fs.readFileSync("plugins/" + pluginPath).toString("utf8");
            // tslint:disable-next-line:no-eval
            const plugin = eval(pluginSource) as ISignalProviderPlugin;
            this.loadPlugin(plugin);
        }

        this.keyboardEvents.addSettingsListener(this.onSettingsChanged);
    }

    public deinit() {
        // disable everyone
        this.setEnabledSignals([]);
        this.keyboardEvents.removeSettingsListener(this.onSettingsChanged);

    }

    private setEnabledSignals(signalsToEnable: string[]) {

        for (const enabledSignal of this.enabledSignalPlugins) {
            const enableIndex = signalsToEnable.indexOf(enabledSignal.name);
            const alreadyEnabled = enableIndex > -1;
            if (alreadyEnabled) {
                // remove from array of signals to enable so we don't double enable it
                signalsToEnable.splice(enableIndex, 1);
            } else {
                // this signal is not part of the enabled list, disable it
                this.disableSignal(enabledSignal.pluginSignal);
            }
        }

        // we have a list of signals
        for (const enabledSignal of signalsToEnable) {
            for (const plugin of this.signalPlugins) {
                for (const signal of plugin.signals) {
                    if (signal.name === enabledSignal) {
                        this.enableSignal(signal);
                    }
                }
            }
        }
    }

    private loadPlugin(plugin: ISignalProviderPlugin) {
        // TODO ensure that there are no conflicting signals or duplicate tags, possibly a conflicting signal results in the most recent plugin load taking precedence
        this.signalPlugins.push(plugin);
    }

    private onSettingsChanged = (settings: Settings) => {
        this.setEnabledSignals(settings.signals);
    };

    private disableSignal(signal: IPluginSignal) {
        for (let i = 0; i < this.enabledSignalPlugins.length; i++) {
            const enabled = this.enabledSignalPlugins[i];
            if (enabled.pluginSignal === signal) {
                if (enabled.timer != null) {
                    clearTimeout(enabled.timer);
                }
                if (enabled.hook != null) {
                    enabled.hook.unhook();
                }
                this.enabledSignalPlugins.splice(i, 1);
                this.keyboardEvents.disableSignal(signal.name);
                return;
            }
        }
    }

    private enableSignal(signal: IPluginSignal) {
        const enabledSignal: IEnabledSignal = {
            hook: null,
            name: signal.name,
            pluginSignal: signal,
            timer: null,
        };

        const source = signal.source; // type checking wants this for some reason
        switch (source.type) {
            case "polling":
                enabledSignal.timer = setInterval(() => {
                    this.signalValueUpdate(signal.name, source.poll());
                }, source.interval * 1000);
                break;
            case "pollingCallback":
                enabledSignal.timer = setInterval(() => {
                    source.poll((signal1) => {
                        this.signalValueUpdate(signal.name, signal1);
                    });
                }, source.interval * 1000);
                break;
            case "hook":
                enabledSignal.hook = source.attach((signal1) => {
                    this.signalValueUpdate(signal.name, signal1);
                });
                break;
            case "endpoint":
                // TODO add a /signal/$name API endpoint to modify this
                break;
            default:
                assertNever(source);
        }

        this.enabledSignalPlugins.push(enabledSignal);
    }

    /**
     * Called when the signal plugin returns a value update (via polling or a hook). Not necessarily different from last time.
     * @param {string} signal
     * @param {Signal} value
     */
    private signalValueUpdate(signal: string, value: Signal) {
        const currentValue = this.signals.get(signal);
        if (currentValue !== value) {
            this.signals.set(signal, value);
            this.keyboardEvents.updateSignalValue(signal, value);
        }
    }
}
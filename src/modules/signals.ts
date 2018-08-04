import {
    IPluginSignal,
    ISignalProviderPlugin,
    Signal,
} from "../types";
import { assertNever } from "../utils/Asserts";
import { KeyboardEvents } from "../utils/KeyboardEvents";
import { Logger } from "../utils/Logger";
import { DefaultSettings } from "./settings";

interface IEnabledSignal {
    pluginSignal: IPluginSignal;
    timer: NodeJS.Timer | null;
    hook: { unhook: () => void } | null;
}

export class SignalsModule {
    private readonly logger = new Logger("SignalsModule");

    private signalPlugins: ISignalProviderPlugin[] = [];
    private enabledSignalPlugins: IEnabledSignal[] = [];

    private signals = new Map<string, Signal>();

    public constructor(
        private keyboardEvents: KeyboardEvents) {
    }

    public init() {
        this.logger.info("Initializing signals.");
        const requirePath = require("require-path");

        requirePath({
            include: ["*.js", "*/index.js"],
            path: "plugins",
        })
            .then((modules: { [key: string]: ISignalProviderPlugin }) => {
                for (const key in modules) {
                    if (modules.hasOwnProperty(key)) {
                        this.logger.info("Found signal provider plugin:", key);
                        const plugin = modules[key];
                        this.loadPlugin(plugin);
                    }
                }

            })
            .catch((errors: any) => {
                throw errors;
            });

        this.keyboardEvents.addListener("onSettingsChanged", this.onSettingsChanged);
    }

    public deinit() {
        // disable everyone
        this.setEnabledSignals([]);
        this.keyboardEvents.removeListener("onSettingsChanged", this.onSettingsChanged);

    }

    public setEnabledSignals(signalsToEnable: string[]) {
        // TODO don't disable everything like this, detect the differences and do that
        for (const signal of Object.assign([], this.enabledSignalPlugins)) {
            this.disableSignal(signal.pluginSignal);
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

    private onSettingsChanged = (settings: DefaultSettings) => {
        this.setEnabledSignals(settings.signals);
    }

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
                return;
            }
        }
    }

    private enableSignal(signal: IPluginSignal) {
        const enabledSignal: IEnabledSignal = {
            hook: null,
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
            this.keyboardEvents.emit("onSignalValueUpdated", signal, value);
        }
    }
}
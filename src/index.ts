import * as InitEndpoint from "./endpoints/info";
import * as KeysEndpoint from "./endpoints/keys";
import * as ProfileEndpoint from "./endpoints/profiles";
import { KeyboardModule } from "./modules/keyboard";
import { SettingsModule } from "./modules/settings";
import { StateModule } from "./modules/state";
import { setProfile, signalsInit } from "./signals";
import {
    HookSource,
    PollingCallbackSource,
    PollingSource,
    Signal,
    SignalProviderPlugin,
    SignalSource,
    StateChangeRequest
} from "./types";

const feathers = require("@feathersjs/feathers");
const express = require("@feathersjs/express");

function configureFeathers() {
    const app = express(feathers());

    // Turn on JSON body parsing for REST services
    app.use(express.json());

    // Turn on URL-encoded body parsing for REST services
    app.use(express.urlencoded({ extended: true }));

    // Set up REST transport using Express
    app.configure(express.rest());

    // Set up an error handler that gives us nicer errors
    app.use(express.errorHandler());

    return app;
}

async function startProgram() {
    // setup the main part of the api
    const app = configureFeathers();

    // create a settings object
    const settings = new SettingsModule();

    // load or create our settings for the first time
    await settings.init();

    // create our state store
    const state = new StateModule(settings);

    // setup a keyboard object
    const apiKeyboard = new KeyboardModule(settings, (connected: boolean) => {
        if (connected) {
            try {
                apiKeyboard.processKeyChanges(state.getAllKeyData());
            } catch (e) {
                console.error("Error while attempting to re-sync the keyboard: ", e);
            }
        }
    });

    // Start connecting to the keyboard (if one exists)
    // If not, wait for one to connect from here on out.
    apiKeyboard.init();

    signalsInit(apiKeyboard, settings, state);

    app.use("info", InitEndpoint.init(apiKeyboard, settings));
    app.use("profiles", ProfileEndpoint.init(apiKeyboard, settings, state));
    app.use("keys", KeysEndpoint.init(apiKeyboard, settings, state));

    const server = app.listen(3030);

    server.on("listening", () => console.log("Feathers REST API started at http://localhost:3030"));

    function cleanupProgram() {
        server.close();
        apiKeyboard.close();
        setProfile(null); // detaches from signal handlers
    }

    process.on("SIGINT", () => {
        cleanupProgram();
    });

    process.on("exit", () => {
        cleanupProgram();
    });

}

startProgram();

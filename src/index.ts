import {
    HookSource,
    PollingCallbackSource,
    PollingSource,
    Signal,
    SignalProviderPlugin,
    SignalSource,
    StateChangeRequest
} from "./state";
import { setProfile, signalsInit } from "./signals";
import { APIKeyboard } from "./keyboard";
import { Settings } from "./settings";
import * as InitEndpoint from "./endpoints/info";
import * as ProfileEndpoint from "./endpoints/profiles";
import * as KeysEndpoint from "./endpoints/keys";

const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');

const app = express(feathers());

// Turn on JSON body parsing for REST services
app.use(express.json())

// Turn on URL-encoded body parsing for REST services
app.use(express.urlencoded({ extended: true }));

// Set up REST transport using Express
app.configure(express.rest());

// Set up an error handler that gives us nicer errors
app.use(express.errorHandler());

async function startProgram() {
    const settings = new Settings();
    await settings.init();

    const apiKeyboard = new APIKeyboard(settings);

    signalsInit(apiKeyboard, settings);

    app.use('info', InitEndpoint.init(apiKeyboard, settings));
    app.use('profiles', ProfileEndpoint.init(apiKeyboard, settings));
    app.use('keys', KeysEndpoint.init(apiKeyboard, settings));

    const server = app.listen(3030);

    server.on('listening', () => console.log('Feathers REST API started at http://localhost:3030'));


    function cleanupProgram() {
        server.close();
        apiKeyboard.close();
        setProfile(null);
    }

    process.on('SIGINT', () => {
        console.log("SIGINT");
        cleanupProgram();
    });

    process.on('exit', () => {
        console.log("exit");
        cleanupProgram();
    });

}

startProgram();


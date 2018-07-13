import {APIKeyboard} from "./keyboard";
import {
    HookSource,
    PollingCallbackSource,
    PollingSource,
    Signal,
    SignalProviderPlugin,
    SignalSource,
    StateChangeRequest
} from "./state";
import {setProfile, signalsInit} from "./signals";

const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');

const app = express(feathers());

// Turn on JSON body parsing for REST services
app.use(express.json())

// Turn on URL-encoded body parsing for REST services
app.use(express.urlencoded({extended: true}));

// Set up REST transport using Express
app.configure(express.rest());

// Set up an error handler that gives us nicer errors
app.use(express.errorHandler());

const apiKeyboard = new APIKeyboard();

app.use('info', {
    async find() {
        let hasKeyboard = apiKeyboard.hasKeyboard();
        return {
            hasKeyboard: hasKeyboard,
            data: apiKeyboard.getBasicInfo(),
        };
    }
});

app.use('keys', {
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
});

const server = app.listen(3030);

server.on('listening', () => console.log('Feathers REST API started at http://localhost:3030'));

process.on('SIGINT', () => {
    console.log("SIGINT");
    server.close();
    apiKeyboard.keyboard.close();
    setProfile(null);
});

setTimeout(() => {
    // calling this before the keyboard is connected will trigger errors
    signalsInit(apiKeyboard);
}, 1000);
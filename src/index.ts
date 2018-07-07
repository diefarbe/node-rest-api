import {APIKeyboard} from "./keyboard";
import {SignalProviderPlugin, StateChangeRequest} from "./state";

const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const requirePath = require("require-path");

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

requirePath({
  path: "plugins",
  include: ["*.js", "*/index.js"]
})
  .then((modules: { [key: string]: SignalProviderPlugin }) => {
    for (let key of Object.keys(modules)) {
      let plugin = modules[key];
      console.log(plugin.signalName);
      console.log(plugin.signalValue());
    }
  })
  .catch((errors: any) => {
    throw errors;
  });
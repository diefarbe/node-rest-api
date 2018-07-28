import * as InitEndpoint from "./endpoints/info";
import * as KeysEndpoint from "./endpoints/keys";
import * as ProfileEndpoint from "./endpoints/profiles";
import { KeyboardModule } from "./modules/keyboard";
import { SettingsModule } from "./modules/settings";
import { SignalsModule } from "./modules/signals";
import { Logger } from "./log";
import { homedir } from "os";

const feathers = require("@feathersjs/feathers");
const express = require("@feathersjs/express");
const program = require("commander");
const pack = require("../package.json");

let logger = new Logger("index.ts");

program
    .version(pack.version, '-v, --version')
    .option("--config <path>", "specify the config directory", homedir() + "/.config/diefarbe")
    .parse(process.argv);

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
    logger.info("Hello.");

    // setup the main part of the api
    const app = configureFeathers();

    // create a settings object
    const settings = new SettingsModule(program.config);

    // load or create our settings for the first time
    await settings.init();

    // setup a keyboard object
    const keyboard = new KeyboardModule(settings);

    // Start connecting to the keyboard (if one exists)
    // If not, wait for one to connect from here on out.
    keyboard.init();

    const signals = new SignalsModule(settings, keyboard);

    signals.signalsInit();

    app.use("info", InitEndpoint.init(keyboard, settings));
    app.use("profiles", ProfileEndpoint.init(keyboard, settings));
    app.use("keys", KeysEndpoint.init(keyboard, settings));

    const server = app.listen(3030);

    server.on("listening", () => logger.info("Feathers REST API started at http://localhost:3030"));

    let cleanedUp = false;

    function cleanupProgram() {
        if (cleanedUp) {
            return;
        }
        logger.info("Cleaning up...");
        server.close();
        signals.setSignalProfile(null); // detaches from signal handlers
        keyboard.close();
        cleanedUp = true;
        logger.info("Cleanup complete.");
    }

    // ctrl+c
    process.on("SIGINT", () => {
        logger.info("SIGINT");
        cleanupProgram();
    });

    // terminate
    process.on("SIGTERM", () => {
        logger.info("SIGTERM");
        cleanupProgram();
    });

    // parent process (probably npm) dies
    process.on("SIGHUP", () => {
        logger.info("SIGHUP");
        cleanupProgram();
    });

    process.on("exit", () => {
        cleanupProgram();
        logger.info("Goodbye.");
    });

}

startProgram();
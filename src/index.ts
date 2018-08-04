import * as StateEndpoint from "./endpoints/keyboard";
import * as ProfileEndpoint from "./endpoints/profile";
import * as SettingsEndpoint from "./endpoints/settings";
import * as SignalsEndpoint from "./endpoints/signals";
import { IndicatorModule } from "./modules/indicators";
import { KeyboardModule } from "./modules/keyboard";
import { ProfileModule } from "./modules/profile";
import { SettingsModule } from "./modules/settings";
import { SignalsModule } from "./modules/signals";
import { KeyboardEvents } from "./utils/KeyboardEvents";
import { Logger } from "./utils/Logger";

import { homedir } from "os";

// tslint:disable-next-line:no-var-requires
const program = require("commander");

// tslint:disable-next-line:no-var-requires
const pack = require("../package.json");

program
    .version(pack.version, "-v, --version")
    .option("--config <path>", "specify the config directory", homedir() + "/.config/diefarbe")
    .parse(process.argv);

function configureFeathers() {

    const feathers = require("@feathersjs/feathers");
    const express = require("@feathersjs/express");

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
    const logger = new Logger("index.ts");

    logger.info("Hello.");

    // setup the main part of the api
    const app = configureFeathers();

    const events = new KeyboardEvents();
    const settings = new SettingsModule(program.config, events);

    const keyboard = new KeyboardModule(events);
    const signals = new SignalsModule(events);
    const indicator = new IndicatorModule(events);
    const profile = new ProfileModule(program.config, events);

    for (const module of [keyboard, signals, indicator, profile]) {
        module.init();
    }

    // Now that all our modules are up and ready to go, startup settings
    await settings.init();

    app.use("settings", SettingsEndpoint.init(settings));
    app.use("profiles", ProfileEndpoint.init(profile, keyboard));
    app.use("keyboard", StateEndpoint.init(keyboard));
    app.use("signals", SignalsEndpoint.init(indicator, signals));

    const server = app.listen(3030);

    server.on("listening", () => logger.info("Feathers REST API started at http://localhost:3030"));

    let cleanedUp = false;

    function cleanupProgram() {
        if (cleanedUp) {
            return;
        }
        logger.info("Cleaning up...");
        server.close();

        for (const module of [keyboard, signals, indicator, profile]) {
            module.deinit();
        }

        cleanedUp = true;
        logger.info("Cleanup complete.");
    }

    /*
    Note that we catch several kill signals. If we only listened to "exit", the event would never happen because the
    engine doesn't exit until the HTTP server shuts down. As such, we need to hook to various other kill signals to
    shut everything down first.
     */

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
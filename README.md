# Sich Ausruhen

`npm run start`

## Docker (Tested on Linux, should work on Win & macOS also)

`docker run --rm -it --privileged diefarbe/sich-ausruhen`

If you want it to run in the background, use this:

`docker run -d --restart=always --privileged diefarbe/sich-ausruhen`

## Systemd (Linux)

_We reccomend you use the Docker variant as it will ensure you have the correct dependencies installed._

To use systemd, you'll need to put this repository somewhere on your system. This could be your development directory or somewhere under `/usr`.

Next, run `./install.sh`. This will "render" the service file (diefarbe.service.template) to point to this directory (creating a new file: diefarbe.service). It will also install the unit into systemd using `systemctl enable`.

Once you have it installed, run `systemctl start diefarbe`. To uninstall later, run `systemctl disable diefarbe`.

## Configuration
By default, this runs with the black profile and no signals displayed. To make it do something interesting, you should modify the configuration file located at `~/.config/diefarbe/settings.json`. A good starting point would be the following:
```
{
    "profile": "ebf5f085af9e1ce177836f1830c7e7b32bf11b9b21e473999d5b9bb7abf762c8",
    "signals": [
        "cpu_utilization_max",
        "memory_utilization"
    ]
}
```

These settings will use the "dim" profile (all keys are slightly illumated) and will turn on two signals that will monitor your memory and CPU utilization.

Note that only the differences from the default configuration will be persisted.
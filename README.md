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
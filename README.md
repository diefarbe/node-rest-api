# Sich Ausruhen

`npm run start`

## Docker

`docker run --rm -it --privileged -v /dev/bus/usb:/dev/bus/usb diefarbe/sich-ausruhen`

If you want it to run in the background, use this:

`docker run -d --restart=always --privileged -v /dev/bus/usb:/dev/bus/usb diefarbe/sich-ausruhen`
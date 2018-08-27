#!/usr/bin/env bash

# This will install a systemd service unit that points to this repo.
# Tested on Ubuntu 17.10.

set -e

cat ./diefarbe.service.template | sed "s|\$WORKING_DIR|$(pwd)|g" > diefarbe.service
systemctl enable "$PWD/diefarbe.service"

echo "diefarbe.service installed; run \`systemctl start diefarbe.service\` to start it."
echo "To uninstall, run systemctl disable diefarbe.service"
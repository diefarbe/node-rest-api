#!/usr/bin/env bash

echo "script started"
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
echo $?
echo "logged in"
docker push diefarbe/sich-ausruhen
echo $?
echo "done"
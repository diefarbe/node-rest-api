FROM ubuntu:xenial

COPY . /diefarbe

WORKDIR /diefarbe

RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs
RUN npm install

# If the container runs in the background (`-d`), using this array notation (as a CMD or ENTRYPOINT) is
# the only way that seems to allow the container to shutdown gracefully on a `docker stop` request. Otherwise
# it will be killed after the timeout.
ENTRYPOINT ["node", "/diefarbe/dist/index.js"]
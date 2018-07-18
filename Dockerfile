FROM ubuntu:xenial

COPY . /diefarbe

WORKDIR /diefarbe

RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs
RUN npm install

ENTRYPOINT ["node", "/diefarbe/dist/index.js"]
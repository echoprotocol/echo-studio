# build environment
FROM node:10.15.3-alpine as builder

ARG NODE_APP_INSTANCE="production"

ENV NODE_ENV="production"
ENV NODE_APP_INSTANCE=$NODE_APP_INSTANCE

WORKDIR /app/remix-ide/

RUN apk update && apk add bash && apk add --virtual build-dependencies
RUN apk add build-base
RUN apk add git python
RUN git config --global http.sslverify "false"

COPY ./ /app/remix-ide/
RUN npm config set unsafe-perm true
RUN NODE_ENV=development npm install

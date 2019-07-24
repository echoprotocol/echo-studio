# build environment
FROM node:10.15.3-alpine as builder

ARG NODE_APP_INSTANCE="production"

ENV NODE_ENV="production"
ENV NODE_APP_INSTANCE=$NODE_APP_INSTANCE

WORKDIR /app/echo-studio/

RUN apk update && apk add bash && apk add --virtual build-dependencies
RUN apk add build-base
RUN apk add git python
RUN git config --global http.sslverify "false"

COPY . /app/echo-studio/
RUN npm config set unsafe-perm true
RUN NODE_ENV=development npm install
#RUN npm run setupremix && npm run build
#RUN npm install remix-ide -g && \
#npm i remix-lib
#RUN npm run setupremix && \
#          npm run build

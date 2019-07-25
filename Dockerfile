FROM node:10.16-alpine as build-env

ARG NODE_APP_INSTANCE="production"

ENV NODE_ENV="production"
ENV NODE_APP_INSTANCE=$NODE_APP_INSTANCE

WORKDIR /app/remix
RUN apk update && apk add bash && apk add --virtual build-dependencies
RUN apk add build-base
RUN apk add git python
RUN git config --global http.sslverify "false"
COPY ./tools/package*.json ./tools/
RUN cd /app/remix/tools && npm config set unsafe-perm true
COPY . .
RUN cd /app/remix/tools &&  NODE_ENV=development npm install && npm run bootstrap

FROM node:10.16-alpine
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
COPY --from=build-env /app/remix/tools  /app/remix/
RUN npm run setupremix
RUN npm run build
CMD ["npm", "start"]

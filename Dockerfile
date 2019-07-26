FROM node:10.16-alpine

ARG NODE_APP_INSTANCE="production"
# set as development for install all dev dependencies
ENV NODE_ENV="development"
ENV NODE_APP_INSTANCE=$NODE_APP_INSTANCE

WORKDIR /app/

RUN apk update
RUN apk add build-base git python bash

# allow install packages with prepare scrypt by root user
#RUN git config --global http.sslverify "false"
RUN npm config set unsafe-perm true

COPY . .

# instal dependencies and build tools
RUN cd tools && npm install && npm run bootstrap

# install dependecies and build sources
RUN NODE_ENV=development npm install
RUN npm run setupremix
RUN npm run build

CMD ["npm", "start"]

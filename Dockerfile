FROM node:8-alpine
LABEL maintainer="atoepfer87@gmail.com"

WORKDIR /fitjunction
ADD package.json package-lock.json ./
RUN npm install
ADD . ./

CMD node main.js notinteractive
EXPOSE 80

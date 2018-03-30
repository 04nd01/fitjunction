FROM node:8
LABEL maintainer="atoepfer87@gmail.com"

WORKDIR /fitjunction
ADD package.json package-lock.json ./
RUN npm install
ADD . ./
CMD node main.js
EXPOSE 80

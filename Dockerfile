FROM node:22-alpine

WORKDIR /src

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 8080

CMD ["npm","start"]

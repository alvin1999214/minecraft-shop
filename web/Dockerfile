FROM node:18-alpine
WORKDIR /app

# install deps
COPY package*.json ./
RUN npm install

# copy sources and build
COPY . .
RUN npm run build

EXPOSE 8880
CMD ["npm", "run", "preview"]

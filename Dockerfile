# Use an official Node.js runtime as the base image
FROM node:14

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

# ENV MONGODB_USERNAME=yashdaga7019   
# ENV MONGODB_PASSWORD=KhHVuE9vk9xy5Zwu
CMD ["node", "index.js"]

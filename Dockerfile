FROM node:16

WORKDIR /app

COPY . .

RUN if [ -f package.json ]; then npm install; fi

EXPOSE 3000

CMD ["node", "server.js"] || ["npm", "start"] || ["echo", "No start script found"]
FROM node:alpine as builder

WORKDIR /usr/app/client

COPY ./package.json .

RUN npm install

COPY . .

CMD ["npm", "run", "build"]



FROM nginx:alpine

EXPOSE 80

COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /usr/app/client/build /usr/share/nginx/html

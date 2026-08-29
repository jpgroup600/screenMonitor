FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_BACKEND_URL
ARG VITE_IMAGE_URL
ARG VITE_HUB_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_IMAGE_URL=$VITE_IMAGE_URL
ENV VITE_HUB_URL=$VITE_HUB_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

# Etapa de build
FROM node:23.11-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etapa de producción
FROM nginx:alpine

# Copiar el resultado del build
COPY --from=build /app/dist /usr/share/nginx/html

# Configurar Nginx para SPAs (soporte para rutas dinámicas)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

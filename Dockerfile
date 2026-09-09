# ---------- STAGE 1: build del frontend ----------
FROM node:22 AS frontend
WORKDIR /usr/src/app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---------- STAGE 2: immagine finale ----------
FROM node:22-slim
# Le regole di dominio sugli orari ragionano in ora locale dell'ateneo
ENV TZ=Europe/Rome
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY src/ ./src/
COPY seed/ ./seed/
COPY --from=frontend /usr/src/app/client/build ./client/build
EXPOSE 3000
CMD ["node", "server.js"]

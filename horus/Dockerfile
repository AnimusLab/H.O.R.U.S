FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_TELEMETRY_WS_URL
ENV NEXT_PUBLIC_TELEMETRY_WS_URL=$NEXT_PUBLIC_TELEMETRY_WS_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
EXPOSE 3000
CMD ["npm", "run", "start"]

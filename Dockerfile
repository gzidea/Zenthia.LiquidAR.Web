FROM node:24-alpine AS build
WORKDIR /workspace
COPY deploy/packages/*.tgz ./Zenthia.Frontend.Shared/artifacts/
COPY package*.json ./Zenthia.LiquidAR.Web/
WORKDIR /workspace/Zenthia.LiquidAR.Web
RUN npm ci --no-audit --no-fund
COPY . ./
ARG SECURITY_APPLICATION_ID
ENV VITE_SECURITY_APPLICATION_ID=$SECURITY_APPLICATION_ID
ENV VITE_SECURITY_BASE_URL=/api
ENV VITE_LIQUIDAR_BASE_URL=/liquidar-api
RUN node -e 'const raw = process.env.VITE_SECURITY_APPLICATION_ID || ""; if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 2147483647) { console.error("Configurar SECURITY_APPLICATION_ID con el identificador real de LiquidAR."); process.exit(1); }' \
    && npm run build

FROM nginx:stable-alpine
COPY --from=build /workspace/Zenthia.LiquidAR.Web/dist/ /usr/share/nginx/html/
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 deploy/15-validate-api-origins.sh /docker-entrypoint.d/15-validate-api-origins.sh
ENV NGINX_ENVSUBST_FILTER="^(SECURITY_API_ORIGIN|LIQUIDAR_API_ORIGIN)$"
RUN SECURITY_API_ORIGIN=http://127.0.0.1 LIQUIDAR_API_ORIGIN=http://127.0.0.1 /docker-entrypoint.sh nginx -t \
    && rm /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

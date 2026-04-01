# ===== 1. 前端构建 =====
FROM node:24-alpine AS frontend-build

WORKDIR /app

# 安装依赖（CI 更快、锁版本）
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ===== 2. 最终运行镜像 =====
FROM nginx:alpine

WORKDIR /app

EXPOSE 80

VOLUME /app/data

# 拷贝前端构建产物
COPY --from=frontend-build /app/build/client /usr/share/nginx/html

# Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]

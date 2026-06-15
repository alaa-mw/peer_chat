# Dockerfile
FROM node:18-alpine

WORKDIR /app

# نسخ ملفات package.json
COPY package*.json ./

# تثبيت dependencies
RUN npm ci --only=production

# نسخ باقي الملفات
COPY . .

# فتح المنفذ
EXPOSE 3000

# تشغيل التطبيق
CMD ["node", "server.js"]
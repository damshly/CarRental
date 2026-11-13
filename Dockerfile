FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

COPY --chown=node:node server.js ./server.js
COPY --chown=node:node home.html Cars.html AboutUs.html style.css myFunctions.js jquery-3.7.1.min.js ./public/
COPY --chown=node:node images ./public/images

# The source HTML/CSS/JS files may be owner-only on the host.
# Make static assets readable by the non-root runtime UID from Compose.
RUN chmod -R a=rX /app/public

USER node

EXPOSE 3000

CMD ["node", "server.js"]

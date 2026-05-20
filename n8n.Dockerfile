# n8n para Render
# Usa la imagen oficial + persiste data en /home/node/.n8n (disk montado)
FROM docker.n8n.io/n8nio/n8n:latest

USER root
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node/.n8n
USER node

EXPOSE 5678

# Camera Proxy (Hikvision RTSP -> MJPEG)

Este servico local em Python conecta na camera Hikvision via RTSP e disponibiliza um stream continuo para o front-end em:

- http://127.0.0.1:8090/stream.mjpg

## Como usar

1. Copie `camera-proxy/.env.example` para `camera-proxy/.env` e ajuste os dados se necessario.
2. Instale dependencias:
   - `npm run camera:install`
3. Inicie o proxy:
   - `npm run camera:proxy`
4. No front-end, configure a URL do proxy:
   - copie `.env.local.example` para `.env.local`
   - confirme `NEXT_PUBLIC_CAMERA_PROXY_URL=http://127.0.0.1:8090`
5. Rode o app e acesse:
   - `/painel/camera`

## Endpoint de status

- http://127.0.0.1:8090/health
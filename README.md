# PWA — Teste Vocacional On‑device (WebLLM)

Roda 100% no dispositivo (navegador com WebGPU). Funciona offline após baixar o modelo.

## Estrutura
```
index.html
main.js
manifest.webmanifest
service-worker.js
icons/
  ├─ icon-192.png
  └─ icon-512.png
```

## Como rodar local
```bash
# servir arquivos estáticos
python -m http.server 8080
# ou
npx serve .
```
Abra no navegador: `http://localhost:8080`.

## Publicar no GitHub Pages
1. Crie repo (ex.: vocational-pwa) e suba **estes arquivos na raiz**.
2. Em *Settings → Pages*: Source = Deploy from a branch; Branch = `main`; Folder = `/ (root)`.

URL final: `https://SEU_USUARIO.github.io/vocational-pwa/`

## Dicas
- WebGPU é necessário (Chrome/Edge modernos; iOS 17+ tem suporte limitado).
- A primeira execução baixa o modelo (pode levar minutos e 2–4 GB). Depois roda offline (PWA).
- Se uma atualização não aparecer, force reload (Ctrl+F5) ou troque o nome do cache no `service-worker.js`.

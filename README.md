# joaohenriquecosta.dev

Cartão de visitas e portfólio de **João Henrique Costa**: trajetória, projetos e um formulário de contato que entrega em `contato@joaohenriquecosta.dev`.

**No ar:** https://joaohenriquecosta.dev

## Stack

- HTML, CSS e JavaScript sem framework, empacotados com [Vite](https://vite.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) com static assets e o CLI [`cf`](https://developers.cloudflare.com/cf/)
- Formulário → `POST /api/contact` → binding `send_email` do Email Routing
- Fontes auto-hospedadas (Instrument Serif, Geist, Geist Mono) via Fontsource, sem chamadas a terceiros
- PT-BR / EN com troca instantânea, respeitando `prefers-reduced-motion`

## Rodar localmente

```sh
npm install
echo "MAIL_DEST=voce@example.com" > .dev.vars   # secret exigido pelo Worker
npm run dev
```

Em desenvolvimento, os e-mails do formulário não são enviados: viram arquivos `.eml` em `.cloudflare/tmp/email/`.

## Checagem e deploy

```sh
npm run check    # build + varredura de dados privados
npm run deploy   # cf deploy
```

O destino real do formulário (`MAIL_DEST`) é um secret do Worker e nunca entra no repositório.

## Estrutura

```
index.html            página única (conteúdo em PT-BR)
src/main.js           interações: cartão 3D, revelações, idioma, formulário
src/i18n.js           textos em inglês
src/styles.css        design system e layout
src/worker.ts         Worker: /api/contact + assets + redirect www
public/               imagens, favicon, 404, robots, sitemap
cloudflare.config.ts  configuração do Worker (cf)
```

## Licença

Código sob MIT. Textos, fotos e marcas pertencem aos respectivos donos.

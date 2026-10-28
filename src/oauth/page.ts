const LOGO = `<svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 200 200"
    aria-hidden="true"
  >
    <path
      fill="#5C08AB"
      d="M170.546 151.255c3.567 2.591 5.35 3.887 6.225 5.779.708 1.533.908 3.67.495 5.309-.509 2.021-1.849 3.441-4.529 6.282a100.006 100.006 0 0 1-85.038 30.616c-3.876-.481-5.815-.721-7.495-1.954-1.362-.999-2.57-2.773-3.002-4.406-.532-2.015.016-4.15 1.112-8.421l1.095-4.261c1.101-4.292 1.652-6.438 2.699-7.765 1.046-1.327 1.966-1.992 3.554-2.568 1.59-.576 4.242-.394 9.55-.03a70.002 70.002 0 0 0 52.993-19.079c3.857-3.663 5.785-5.494 7.377-6.063 1.591-.569 2.723-.643 4.375-.288 1.652.356 3.445 1.658 7.03 4.263l3.559 2.586Z"
    />
    <path
      fill="#7F0BEB"
      d="M56.4 24.483c-2.204-3.819-3.307-5.728-3.336-7.811-.023-1.69.664-3.723 1.707-5.052 1.287-1.639 3.089-2.392 6.693-3.897a100 100 0 0 1 135.947 114.884c-.883 3.805-1.324 5.708-2.726 7.25-1.136 1.25-3.027 2.266-4.696 2.525-2.06.319-4.126-.45-8.258-1.987l-4.124-1.533c-4.153-1.545-6.23-2.317-7.44-3.497-1.21-1.179-1.775-2.163-2.182-3.803-.407-1.64.051-4.26.968-9.499a70.003 70.003 0 0 0-62.73-81.786c-10.076-.9-20.175.4-29.616 3.747-5.013 1.778-7.52 2.667-9.205 2.539-1.685-.128-2.75-.52-4.114-1.517-1.365-.997-2.472-2.915-4.688-6.753l-2.2-3.81Z"
    />
    <path
      fill="#A855F7"
      d="M56.4 175.517c-2.204 3.818-3.307 5.728-5.096 6.795-1.452.865-3.556 1.286-5.229 1.047-2.063-.294-3.615-1.479-6.72-3.848a100.003 100.003 0 0 1-38.43-65.939 100.002 100.002 0 0 1 19.28-73.846c2.355-3.116 3.532-4.675 5.44-5.513 1.546-.68 3.687-.84 5.317-.397 2.011.546 3.586 2.089 6.736 5.173l3.144 3.079c3.166 3.1 4.749 4.65 5.375 6.22.626 1.57.741 2.699.446 4.362-.296 1.664-1.78 3.87-4.748 8.285a69.997 69.997 0 0 0 12.645 92.312c4.046 3.452 6.069 5.179 6.8 6.702.733 1.523.925 2.641.744 4.321-.18 1.681-1.288 3.599-3.504 7.437l-2.2 3.81Z"
    />
  </svg>`

const pages = {
  received: {
    heading: 'Authorization received',
    message: 'Return to your terminal to finish signing in to Inalia.',
    hint: 'You can safely close this tab.',
  },
  denied: {
    heading: 'Authorization denied',
    message: 'Access was not granted. Return to your terminal and try signing in again when you are ready.',
    hint: 'You can safely close this tab.',
  },
  invalid: {
    heading: 'Invalid authorization request',
    message: 'This sign-in link is invalid. Return to your terminal and use the original sign-in link, or start again.',
    hint: 'No authorization was accepted.',
  },
  missing: {
    heading: 'Missing authorization code',
    message: 'Inalia did not receive an authorization code. Return to your terminal and try signing in again.',
    hint: 'No authorization was accepted.',
  },
} as const

// All content is static: never include callback parameters or credentials.
export function oauthPage(status: keyof typeof pages): string {
  const { heading, message, hint } = pages[status]
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${heading} · Inalia</title>
  <link rel="preconnect" href="https://fonts.bunny.net">
  <link rel="stylesheet" href="https://fonts.bunny.net/css?family=noto-sans:300,400,500,600,700|noto-serif:400,500,600,700&display=swap">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: 32px 24px;
      background: #fff;
      color: #44403c;
      font-family: "Noto Sans", sans-serif;
      font-size: 16px;
      line-height: 1.5;
      text-align: center;
    }
    main { width: 100%; max-width: 384px; }
    .logo { width: 48px; height: 48px; margin: 0 auto 8px; }
    .logo svg { display: block; width: 100%; height: 100%; }
    .brand { margin: 0 0 32px; color: #a855f7; font-size: 14px; line-height: 20px; font-weight: 600; }
    h1 { margin: 0 0 16px; color: #1c1917; font-family: "Noto Serif", serif; font-size: 24px; line-height: 32px; font-weight: 600; }
    p { margin: 0; color: #57534e; font-size: 16px; line-height: 24px; }
    .divider { width: 64px; height: 1px; margin: 32px auto; background: #e7e5e4; }
    .hint { color: #78716c; font-size: 14px; line-height: 20px; }
  </style>
</head>
<body>
  <main aria-labelledby="heading">
    <div class="logo">${LOGO}</div>
    <p class="brand">Inalia</p>
    <h1 id="heading">${heading}</h1>
    <p>${message}</p>
    <div class="divider" aria-hidden="true"></div>
    <p class="hint">${hint}</p>
  </main>
</body>
</html>`
}

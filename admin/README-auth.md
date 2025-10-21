Налаштування авторизації Decap CMS (GitHub Pages)

Сайт працює на GitHub Pages, тому для входу в Decap CMS потрібен окремий OAuth‑сервер, який зберігатиме Client Secret і виконуватиме обмін кодів на токени (браузер цього зробити не може).

Кроки налаштування

1) Створіть GitHub OAuth App
- Відкрийте GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
- Application name: будь‑яка назва (наприклад, UGCC CMS).
- Homepage URL: https://ugcclausanne.github.io/ugcc-site
- Authorization callback URL: https://YOUR-OAUTH-SERVER/auth/callback
- Збережіть і скопіюйте Client ID та Client Secret.

2) Задеплойте OAuth‑сервер
- Використайте будь‑який з офіційних/популярних провайдерів для Decap (наприклад, «decap-cms-github-oauth»). Його можна розгорнути на Netlify, Render, Fly.io, Cloudflare Workers тощо.
- У змінних середовища сервера вкажіть Client ID і Client Secret GitHub OAuth App (точні назви змінних див. у README обраного провайдера; зазвичай це GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET або OAUTH_CLIENT_ID/OAUTH_CLIENT_SECRET).
- Після деплою сервер матиме URL, наприклад: https://your-oauth-app.onrender.com
- Переконайтесь, що на сервері існують маршрути /auth і /auth/callback (це стандарт для більшості провайдерів).

3) Пропишіть URL сервера в CMS‑конфігурації
- Відкрийте файл admin/config.yml і замініть:
  base_url: https://YOUR-OAUTH-SERVER
  на фактичний URL вашого сервера (без /auth в кінці), наприклад:
  base_url: https://your-oauth-app.onrender.com
- auth_endpoint залиште /auth (типовий шлях у провайдерах).

4) Дозволені редіректи
- У налаштуваннях вашого GitHub OAuth App додайте той самий callback URL, що і на сервері:
  https://YOUR-OAUTH-SERVER/auth/callback
- Якщо змінюєте домен сервера — не забудьте оновити callback URL у GitHub OAuth App.

5) Перевірка входу
- Відкрийте: https://ugcclausanne.github.io/ugcc-site/admin/
- Натисніть «Login with GitHub». Має з’явитись запит доступу GitHub та повернення назад в адмінку.

Примітки
- Netlify Identity/Git Gateway вам не потрібні, якщо сайт на GitHub Pages.
- Значення app_id та auth_type з попередньої конфігурації видалені (implicit більше не підтримується GitHub; тепер використовується стандартний OAuth через сервер).
- Колекцію прикладу змінено на «Новини» (папка news). За потреби додайте інші колекції під ваш контент.

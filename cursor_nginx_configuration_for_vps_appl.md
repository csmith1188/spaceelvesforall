# Nginx configuration for VPS application
_Exported on 5/1/2026 at 13:25:31 EDT from Cursor (2.6.20)_

---

**User**

I have a vps that uses pm2 and nginx reverse proxies that runs @index_master.js on port 3440. My domain directs to https://spaceelves.yorktechapps.com. this causes it to go to https://spaceelves.yorktechapps.com:3440/login?formbar=true. I also realized that games being spawned will have a port of 10000+, and my nginix reverse proxy does not account for this. What changes should I make to this application, my nginix configuration, and my DNS records to get this to worK? Here is my nginix conf:

server {
    server_name spaceelves.yorktechapps.com;

    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/formbar.yorktechapps.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/formbar.yorktechapps.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

    # Proxy for normal HTTP traffic
    location / {
        proxy_pass http://localhost:3440;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_buffer_size          16k;
        proxy_buffers              8 16k;
        proxy_busy_buffers_size    64k;

        # CORS headers (covers HTML + Socket.IO polling requests)
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;

        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Credentials true always;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header Access-Control-Allow-Headers "*" always;
            return 204;
        }
    }

    # Explicit WebSocket handling for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3440;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;

        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Credentials true always;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header Access-Control-Allow-Headers "*" always;
            return 204;
        }
    }
}

server {
    if ($host = spaceelves.yorktechapps.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name spaceelves.yorktechapps.com;
    return 404; # managed by Certbot
}


---

**Cursor**

I’ll quickly inspect how `index_master.js` and game spawn routing build URLs/ports so I can give you concrete app + Nginx + DNS changes that match your code instead of generic proxy advice.

I found the core issue in `index_game.js`: it explicitly appends `:${masterPort}` when redirecting unauthenticated users, which explains the `:3440/login` behavior behind Nginx. I’ll inspect `index_master.js` and the client views next to map the full fix.

You’re very close; the main issue is that the app currently **hardcodes backend ports into public URLs**, which bypasses your reverse proxy design.

## What’s going wrong

- Your master/game code builds external URLs like `https://host:3440` and `https://host:10000` instead of using the public origin.
- The game list also links users directly to `:gamePort`.
- The game client opens WS to `hostname:PORT`, forcing browser access to internal ports.

You can see that behavior here:

```204:241:index_game.js
const masterHost = process.env.THIS_URL || 'localhost';
const masterPort = process.env.PORT || 3000;
// ...
redirectUrl = `${protocol}://${hostname}:${masterPort}`;
res.redirect(redirectUrl);
```

```49:61:modules/gameServer.js
const protocol = host.startsWith('https://') ? 'https' : 'http';
redirectUrl = `${protocol}://${hostname}:${child.PORT}/`;
res.redirect(redirectUrl);
```

```66:72:modules/gameStatusHub.js
const host = normalizeHost(process.env.THIS_URL);
const protocol = process.env.THIS_URL && process.env.THIS_URL.startsWith('https://') ? 'https' : 'http';
url: `${protocol}://${host}:${message.port}/`,
```

```39:43:views/partials/gameslist.ejs
function serverUrl(game) {
  if (game.url) return game.url;
  const protocol = window.location.protocol;
  return `${protocol}//${window.location.hostname}:${game.port}/`;
}
```

```23:25:public/engine/socket_client.js
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const gameWSS = new WebSocket(`${wsProtocol}//${window.location.hostname}:${PORT}/game`);
```

---

## Recommended architecture (best fit for your current code)

Use one public domain/443 and route game instances by path:

- Master app public: `https://spaceelves.yorktechapps.com/`
- Game instance public: `https://spaceelves.yorktechapps.com/game/10023/`
- Game WS public: `wss://spaceelves.yorktechapps.com/game/10023/game`
- Internal only: `127.0.0.1:3440`, `127.0.0.1:10000+`

No public `:3440` or `:10000+` URLs.

---

## App changes to make

- In `modules/gameServer.js`, redirect to `/game/${port}/` (relative path), not `host:port`.
- In `modules/gameStatusHub.js`, store `url` as `/game/${port}/` or full public base URL + that path.
- In `views/partials/gameslist.ejs`, build links as `/game/${game.port}/`.
- In `public/engine/socket_client.js`, connect WS to current path prefix (not `:${PORT}`), e.g. `/game/<port>/game`.
- In `index_game.js`, stop generating `masterUrl` with `:${masterPort}` for browser redirects; use public origin or relative `/login`.
- Add `app.set('trust proxy', 1)` in Express apps so proto/host behave behind Nginx.
- Split env vars:
  - `PUBLIC_BASE_URL=https://spaceelves.yorktechapps.com`
  - `MASTER_INTERNAL_URL=ws://127.0.0.1:3440` (for game server heartbeats)

---

## Nginx changes to make

Keep master proxy as-is for `/`, and add dynamic game proxy by path + WebSocket support.

Use a config pattern like:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    server_name spaceelves.yorktechapps.com;
    listen 443 ssl http2;

    # Use cert that includes spaceelves.yorktechapps.com
    ssl_certificate     /etc/letsencrypt/live/spaceelves.yorktechapps.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spaceelves.yorktechapps.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Master app
    location / {
        proxy_pass http://127.0.0.1:3440;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }

    # Game instances: /game/10000/... -> 127.0.0.1:10000/...
    location ~ ^/game/(10[0-9]{3})(/.*)?$ {
        set $game_port $1;
        rewrite ^/game/10[0-9]{3}(.*)$ $1 break;
        proxy_pass http://127.0.0.1:$game_port;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}

server {
    listen 80;
    server_name spaceelves.yorktechapps.com;
    return 301 https://$host$request_uri;
}
```

Also:
- Keep game ports bound to localhost (`127.0.0.1`) only if possible.
- Don’t open `10000+` in cloud firewall/security group.

---

## DNS changes

Minimal DNS required:

- `A` (and/or `AAAA`) record for `spaceelves.yorktechapps.com` -> VPS IP.
- No DNS records for ports.
- No wildcard needed unless you switch to subdomain-per-game routing.

---

## Important TLS note

Your current config uses cert files for `formbar.yorktechapps.com`.  
If that cert does not include `spaceelves.yorktechapps.com` as SAN, users will get TLS warnings/failures. Issue a cert for `spaceelves.yorktechapps.com` (or a SAN cert covering both).

---

If you want, I can next give you an exact patch plan file-by-file for this repo (what to change in each of the 5 relevant files) so you can implement quickly.


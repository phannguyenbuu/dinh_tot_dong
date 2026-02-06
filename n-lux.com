server {
    listen 80;

    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name n-lux.com www.n-lux.com;

    client_max_body_size 100M;

    ssl_certificate /etc/letsencrypt/live/n-lux.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/n-lux.com/privkey.pem;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=15768000" always;

    # ssl_stapling on;
    # ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/n-lux.com/chain.pem;

    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    location /.well-known/acme-challenge/ {
        root /var/www/n-lux.com/html;
        allow all;
    }

    location /court/ {
        alias /var/www/court/;
        index index.html index.htm;
        try_files $uri $uri/ /court/index.html;  # SPA fallback
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        add_header Cache-Control "no-cache" always;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /gmk {
        proxy_pass http://127.0.0.1:5000/gmk;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /sa {
        proxy_pass http://127.0.0.1:5000/sa;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /pac-api/ {
        proxy_pass http://127.0.0.1:5030/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /pac/ {
        alias /var/www/pacdora/;
        index index.html index.htm;
        try_files $uri $uri/ /pac/index.html;
    }

    location /ring/ {
        alias /var/www/ring/;
        index index.html index.htm;
        try_files $uri $uri/ /ring/index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|glb|hdr)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        add_header Cache-Control "no-cache" always;
    }


    location /admin/ {
        proxy_pass http://31.97.76.62:5000;  # ✅ Dùng IP public thay 127.0.0.1
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
    
    location /view360/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /creative/json/ {
        alias /var/www/creative/json/;
        try_files $uri $uri/ =404;
        
        # ✅ MIME JS - KHÔNG dùng nested/regex phức tạp
        types { }
        default_type application/javascript;
        add_header Access-Control-Allow-Origin "*";
    }

    location / {
        alias /var/www/nlux/;  # ✅ alias cho root
        index index.html index.htm;
        try_files $uri $uri/ /index.html;  # SPA fallback
        
        # Cache headers
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        add_header Cache-Control "no-cache" always;
    }

    location /creative/ {
        alias /var/www/creative/;
        index index.html;
        
        # ✅ try_files ĐÚNG với alias
        try_files $uri $uri/ /index.html;
        
        # ✅ Headers cho Vite/React
        add_header Cache-Control "no-cache" always;
    }

    location /keysim/ {
        alias /var/www/keysim/;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }


    location /models/ { alias /var/www/creative/models/; }
    location /images/ { alias /var/www/creative/images/; }
    location /preview/ { alias /var/www/creative/preview/; }
    
}


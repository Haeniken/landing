# haeniken.com

Исходный код инженерного профиля [haeniken.com](https://haeniken.com/) и интерактивной лаборатории «Орбитальный кластер».

## Состав

- статический двуязычный профиль и технические публикации;
- отдельные индексируемые русская и английская версии;
- пасхальный тренажёр реагирования на инциденты в `/lab/`;
- небольшая служба таблицы игроков на Go;
- конфигурация Nginx с TLS, сжатием, кешированием статики и защитными заголовками.

## Сборка интерфейса

Для публикации используются минифицированные CSS и JavaScript. Исходники остаются рядом в читаемом виде.

```bash
npx terser script.js --compress passes=2 --mangle --format comments=false -o script.min.js
npx terser telemetry.js --compress passes=2 --mangle --format comments=false -o telemetry.min.js
npx terser lab/lab.js --compress passes=2 --mangle --format comments=false -o lab/lab.min.js
npx clean-css-cli -O2 -o styles.min.css styles.css
npx clean-css-cli -O2 -o articles.min.css articles.css
npx clean-css-cli -O2 -o rocket.min.css rocket.css
npx clean-css-cli -O2 -o lab/lab.min.css lab/lab.css
```

Перед публикацией служебная панель получает фактические номер выпуска и время развёртывания:

```bash
tools/write-release-info.sh /path/to/site/release.json "$(git rev-parse --short=7 HEAD)"
```

Загрузка самой страницы служит признаком доступности, поэтому панель не делает отдельный
запрос к `/healthz`. Исходный `release.json` содержит безопасные значения для локальной разработки.

## Проверки

```bash
node --check script.js
node --check lab/lab.js
npx @biomejs/biome lint script.js lab/lab.js
npx html-validate index.html lab/index.html articles/index.html articles/astrosferum/index.html articles/astrodome/index.html articles/network-ha/index.html articles/rabbithole-vpn/index.html articles/incident-504/index.html errors/*.html

cd leaderboard-api
go test -race ./...
go vet ./...
go run honnef.co/go/tools/cmd/staticcheck@latest ./...
go run golang.org/x/vuln/cmd/govulncheck@latest ./...
```

Производственные данные таблицы игроков в репозиторий не входят.

Файловые журналы Nginx ротируются правилом
`deploy/alice-bg-haeniken.logrotate`: ежедневно или при достижении 25 МБ,
с хранением 14 поколений и сжатием архивов.

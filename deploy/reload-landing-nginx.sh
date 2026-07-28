#!/bin/sh
set -eu

/usr/bin/docker exec landing-nginx nginx -t >/dev/null 2>&1
/usr/bin/docker exec landing-nginx nginx -s reload >/dev/null 2>&1

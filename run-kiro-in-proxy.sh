#!/bin/bash
NODE_EXTRA_CA_CERTS=~/.mitmproxy/mitmproxy-ca-cert.pem
#sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem
mitmweb --listen-port 8777 &
export HTTP_PROXY=http://127.0.0.1:8777
export HTTPS_PROXY=http://127.0.0.1:8777
open /Applications/Kiro.app

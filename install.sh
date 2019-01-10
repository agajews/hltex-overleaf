#!/bin/sh
curl https://raw.githubusercontent.com/agajews/hltex-overleaf/master/overleaf_translator > /tmp/overleaf_translator
curl https://raw.githubusercontent.com/agajews/hltex-overleaf/master/com.hltex.overleaf.json > /tmp/com.hltex.overleaf.json
sudo mkdir -p /Library/Google/Chrome/NativeMessagingHosts
sudo cp -f /tmp/com.hltex.overleaf.json /Library/Google/Chrome/NativeMessagingHosts/
sudo mkdir -p /usr/local/bin
sudo cp -f /tmp/overleaf_translator /usr/local/bin/


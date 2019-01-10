# Overleaf Integration for HLTeX

### Usage
1. Install the HLTeX compiler with `pip3 install hltex`.
1. Install our [Chrome extension](https://chrome.google.com/webstore/detail/hltex-overleaf/lnkcgiecknmlaohkgeajflfcfnajpbec/related).
1. Run the following:
```
sudo wget https://raw.githubusercontent.com/agajews/hltex-chrome/master/overleaf_translator -P /usr/local/bin/
sudo chmod +x /usr/local/bin/overleaf_translator
sudo wget https://raw.githubusercontent.com/agajews/hltex-chrome/master/com.hltex.overleaf.json -P /Library/Google/Chrome/NativeMessagingHosts/
```

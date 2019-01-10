require 'fileutils'


class HLTeXOverleaf < Formula
  desc "Extras for a Chrome extension integrating HLTeX with Overleaf"
  homepage "https://github.com/agajews/hltex-chrome"
  url "https://github.com/agajews/hltex-chrome/raw/master/extras.tar.gz"
  sha256 "422ccf5e0ef6aad32a86a2a5616f11992193104a8a7a13c31daba30d995844f2"
  version "0.0.1"

  depends_on "curl"

  bottle :unneeded

  def install
      FileUtils.mkdir_p  "/Library/Google/Chrome/NativeMessagingHosts/com.hltex.overleaf.json"
      FileUtils.cp "com.hltex.overleaf.json", "/Library/Google/Chrome/NativeMessagingHosts/com.hltex.overleaf.json"
      FileUtils.mkdir_p  "/usr/local/bin"
      FileUtils.cp "overleaf_translator", "/usr/local/bin/"
  end
end

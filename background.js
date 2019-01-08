'use strict';

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.sync.set({color: '#3aa757'}, function() {
    console.log("The color is green.");
  });
});

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    console.log(details.url);
    if( details.url == "https://cdn.sharelatex.com/minjs/ide/pdf/controllers/PdfController.js" )
      console.log("replacing");
      return {redirectUrl: "https://raw.githubusercontent.com/agajews/hltex-chrome/master/PdfController.js" };
  },
  // {urls: ["*://cdn.sharelatex.com/*.js"]},
  {urls: ["<all_urls>"]},
  ["blocking"]);

// chrome.webRequest.onBeforeRequest.addListener(
//   function(details) { return {cancel: true}; },
//   {urls: ["*://www.evil.com/*"]},
//   ["blocking"]);

// Register Service Worker EARLY (before React hydration)
// Chrome evaluates PWA installability on page load — SW must be registered ASAP
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}

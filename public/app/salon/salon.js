// Lien https://huntited.com/app/salon#<chasse>.<clé> ouvert dans un navigateur
// (app absente, ou lien d'application pas encore vérifié) : bouton qui ouvre
// l'app par un lien « intent:// ». La clé reste dans ce navigateur.
(function () {
  var m = /^#([0-9a-f]{24})\.([0-9a-f]{64})$/.exec(location.hash);
  var open = document.getElementById("open");
  if (!m || !open) return;
  open.href =
    "intent://salon/" +
    m[1] +
    "/" +
    m[2] +
    "#Intent;scheme=huntited;package=com.huntited.chat;" +
    "S.browser_fallback_url=" +
    encodeURIComponent("https://huntited.com/app/") +
    ";end";
})();

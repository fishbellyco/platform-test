// Fishbelly embed loader. A brand adds:
//   <script src="https://<fishbelly-host>/embed.js"></script>
//   Fishbelly.open({ brand: "demo", product: "vase_001", onApproved: (design) => { ... } });
// `design` is { designId, previewUrl }. The brand attaches designId to its own cart line.
(function () {
  var origin = new URL(document.currentScript.src).origin;

  function open(options) {
    var overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center";
    var frame = document.createElement("iframe");
    frame.src =
      origin + "/embed/" + encodeURIComponent(options.brand) + "?product=" + encodeURIComponent(options.product);
    frame.title = "Customise with AI";
    frame.style.cssText =
      "width:min(640px,94vw);height:min(860px,92vh);border:0;border-radius:16px;background:#faf8f4";
    overlay.appendChild(frame);

    function close() {
      window.removeEventListener("message", onMessage);
      overlay.remove();
    }
    function onMessage(event) {
      // Only trust messages from the Fishbelly iframe we opened.
      if (event.origin !== origin || event.source !== frame.contentWindow) return;
      if (!event.data || event.data.type !== "fishbelly:design-approved") return;
      if (typeof options.onApproved === "function") {
        options.onApproved({ designId: event.data.designId, previewUrl: origin + event.data.previewUrl });
      }
    }
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
    window.addEventListener("message", onMessage);
    document.body.appendChild(overlay);
    return { close: close };
  }

  window.Fishbelly = { open: open };
})();

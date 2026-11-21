(() => {
  dashhq.network.canonicalize();
  const bar = document.querySelector('dashhq-bar');
  const query = new URLSearchParams(location.search);
  const network = query.has('network') ? dashhq.network.fromUrl() : bar.getAttribute('network');
  bar.setAttribute('network', network);
  const home = new URL('/', location.href);
  home.search = location.search;
  document.querySelector('main a[href="/"]').href = dashhq.network.withNetwork(home.href, network);
})();

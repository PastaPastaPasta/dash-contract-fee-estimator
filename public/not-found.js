(() => {
  dashhq.network.canonicalize();
  const network = dashhq.network.fromUrl();
  document.querySelector('dashhq-bar').setAttribute('network', network);
  const destination = dashhq.href('explorer', '/tools/fees/' + location.search);
  document.querySelector('#fee-destination').href = destination;
  window.setTimeout(() => location.replace(destination), 4500);
})();

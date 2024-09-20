const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});

document.getElementById("chat").src =
  `https://chzzk.naver.com/live/${params.name}/chat`;

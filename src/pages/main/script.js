const { ipcRenderer } = require("electron");
const Store = require("electron-store");
const store = new Store();

const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});

function docId(element) {
  return document.getElementById(element);
}

function docQuery(element) {
  return document.querySelector(element);
}

function beautyFollows(follows) {
  const first = `${(follows + "").substring(0, (follows + "").length - 4)}`;
  const second = `${(follows + "").substring(
    (follows + "").length - 4,
    (follows + "").length - 3,
  )}`;
  if (second * 1) return `${first}.${second}만명`;
  else return `${first}만명`;
}

if (params.platform === "darwin") {
  docQuery(".nav_mac").style.display = "flex";
} else {
  docQuery(".nav_window").style.display = "flex";
}

docQuery(".detail_background").addEventListener("click", (evt) => {
  if (evt.target.className === "detail_background") {
    docQuery(".detail_background").style.display = "none";
    docQuery(".detail_info_points span").innerText = "";
    docQuery(".detail_info_button").removeEventListener(
      "click",
      detailInfoEvent,
    );
  }
});
docQuery(".setting_background").addEventListener("click", (evt) => {
  if (evt.target.className === "setting_background") {
    docQuery(".setting_background").style.display = "none";
  }
});

docQuery(".header_refresh").addEventListener("click", () => {
  location.reload();
});

docQuery(".close").addEventListener("click", () => {
  ipcRenderer.send("closeMainWin", params.name);
});

docQuery(".minimize").addEventListener("click", () => {
  ipcRenderer.send("minimizeMainWin", params.name);
});

const container = docId("panel");
let tempArr = [];

store.get("pip_order").forEach((e, i) => {
  const div = document.createElement("div");
  div.id = e;
  div.className = "panel_item";
  div.draggable = true;
  tempArr.push(div);
  if (!((i + 1) % 2)) {
    const panel_column = document.createElement("div");
    panel_column.className = "panel_column";
    tempArr.forEach((e) => {
      panel_column.append(e);
    });
    container.append(panel_column);
    tempArr = [];
  }
});

docQuery(".header_setting").addEventListener("click", () => {
  docQuery(".setting_background").style.display = "block";
});
const twitterCsrfTokenInput = docQuery("#twitter_csrf_token");
if (store.get("twitter_csrf_token"))
  twitterCsrfTokenInput.value = store.get("twitter_csrf_token");
twitterCsrfTokenInput.addEventListener("change", (evt) => {
  store.set("twitter_csrf_token", evt.target.value);
});
const twitterAuthTokenInput = docQuery("#twitter_auth_token");
if (store.get("twitter_auth_token"))
  twitterAuthTokenInput.value = store.get("twitter_auth_token");
twitterAuthTokenInput.addEventListener("change", (evt) => {
  store.set("twitter_auth_token", evt.target.value);
});
docQuery("#setting_guide").addEventListener("click", () => {
  ipcRenderer.send("openGuide");
});

docQuery("#setting_reset").addEventListener("click", () => {
  ipcRenderer.send("closeAllPIP");
  ipcRenderer.send("resetPIPSetting");
});

const user = ipcRenderer.sendSync("getUserProfile");
if (user.profile) {
  docQuery(".header_profile img").src = user.profile;
  docQuery(".username").href = `https://www.twitch.tv/${user.name}`;
  docQuery(".username p").innerText = user.name;
  docQuery(".user_sign").addEventListener("click", () => {
    ipcRenderer.send("logout");
  });
  docQuery(".user_sign p").innerText = "로그아웃";
} else {
  docQuery(".header_profile img").src = "../../assets/guest.svg";
  docQuery(".username p").innerText = "게스트";
  docQuery(".username img").src = "../../assets/question_mark.svg";
  docQuery(".user_sign").href = "https://www.twitch.tv/login";
  docQuery(".user_sign p").innerText = "로그인";
  docQuery(".user_sign img").src = "../../assets/login.svg";
}

ipcRenderer.once("update_downloaded", () => {
  docQuery(".header_update").style.display = "flex";
  if (params.platform === "darwin")
    docQuery(".header_update").addEventListener("click", () => {
      ipcRenderer.send("mac_update");
    });
  else
    docQuery(".header_update").addEventListener("click", () => {
      ipcRenderer.send("restart_app");
    });
});

let columns = document.querySelectorAll(".panel_item");
let draggingClass = "dragging";
let dragSource;

Array.prototype.forEach.call(columns, (col) => {
  col.addEventListener("dragstart", handleDragStart, false);
  col.addEventListener("dragenter", handleDragEnter, false);
  col.addEventListener("dragover", handleDragOver, false);
  col.addEventListener("dragleave", handleDragLeave, false);
  col.addEventListener("drop", handleDrop, false);
  col.addEventListener("dragend", handleDragEnd, false);
});

function handleDragStart(evt) {
  dragSource = this;
  evt.target.classList.add(draggingClass);
  evt.dataTransfer.effectAllowed = "move";
  evt.dataTransfer.setData("text/html", this.innerHTML);
  evt.dataTransfer.setData("id", this.id);
}

function handleDragOver(evt) {
  evt.dataTransfer.dropEffect = "move";
  evt.preventDefault();
}

function handleDragEnter(evt) {
  this.classList.add("over");
}

function handleDragLeave(evt) {
  this.classList.remove("over");
}

function handleDrop(evt) {
  evt.stopPropagation();

  if (dragSource !== this) {
    dragSource.innerHTML = this.innerHTML;
    this.innerHTML = evt.dataTransfer.getData("text/html");
    dragSource.id = this.id;
    this.id = evt.dataTransfer.getData("id");
    info.forEach((e) => {
      if (e.name === dragSource.id) {
        docQuery(`#${dragSource.id} .panel_item_more`).addEventListener(
          "click",
          () => {
            moreInfoEvent(e);
          },
        );
      } else if (e.name === this.id) {
        docQuery(`#${this.id} .panel_item_more`).addEventListener(
          "click",
          () => {
            moreInfoEvent(e);
          },
        );
      }
    });
  }

  evt.preventDefault();
}

function handleDragEnd(evt) {
  Array.prototype.forEach.call(columns, function (col) {
    ["over", "dragging"].forEach(function (className) {
      col.classList.remove(className);
    });
  });
  store.set(
    "pip_order",
    Array.from(document.querySelectorAll(".panel_item")).map((e) => e.id),
  );
}

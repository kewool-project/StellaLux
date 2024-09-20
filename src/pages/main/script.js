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

let tempArr = [];

store.get("pip_order").forEach((e, i) => {
  const container = docId("panel");
  if (!((i + 1) % 6) || (i === store.get("pip_order").length - 1 && i % 6)) {
    const tab = document.createElement("div");
    tab.classList.add("panel_tab");
    tab.classList.add(`panel_tab${Math.floor(i / 6)}`);
    tab.id = `panel_tab:${Math.floor(i / 6)}`;
    if (Math.floor(i / 6)) tab.style.display = "none";
    container.append(tab);

    const tabButton = document.createElement("button");
    tabButton.classList.add("panel_tab_button");
    tabButton.id = `panel_tab_button:${Math.floor(i / 6)}`;
    tabButton.innerText = `${Math.floor(i / 6) + 1}`;
    if (!Math.floor(i / 6)) tabButton.classList.add("active");
    tabButton.addEventListener("click", () => {
      const tabs = document.querySelectorAll(".panel_tab");
      tabs.forEach((e) => {
        e.style.display = "none";
      });
      tab.style.display = "flex";
      const tabButtons = document.querySelectorAll(".panel_tab_button");
      tabButtons.forEach((e) => {
        e.classList.remove("active");
      });
      tabButton.classList.add("active");
    });
    docQuery(".panel_tab-header").append(tabButton);
  }
});

store.get("pip_order").forEach((e, i) => {
  const tab = docQuery(`.panel_tab${Math.floor(i / 6)}`);
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
    tab.append(panel_column);
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
  docQuery(".username").href = `https://chzzk.naver.com/`;
  docQuery(".username p").innerText = user.name;
  docQuery(".user_sign").addEventListener("click", () => {
    ipcRenderer.send("logout");
  });
  docQuery(".user_sign p").innerText = "로그아웃";
} else {
  docQuery(".header_profile img").src = "../../assets/guest.svg";
  docQuery(".username p").innerText = "게스트";
  docQuery(".username img").src = "../../assets/question_mark.svg";
  docQuery(".user_sign").addEventListener("click", () => {
    ipcRenderer.send("login");
  });
  docQuery(".user_sign p").innerText = "로그인";
  docQuery(".user_sign img").src = "../../assets/login.svg";
}

const info = ipcRenderer.sendSync("getChannelInfo");
let diffTimeTemp = {};
let nameTemp = "";
let typeTemp = "";
function detailInfoEvent() {
  if (typeTemp === "stream")
    ipcRenderer.send(
      "openNewWindow",
      `https://chzzk.naver.com/live/${nameTemp}`,
    );
  else if (typeTemp === "space")
    ipcRenderer.send("openNewWindow", `https://x.com/i/spaces/${nameTemp}`);
}
function moreInfoEvent(element) {
  // const detail = ipcRenderer.sendSync("getChannelInfoDetail", e);
  const detail_background = docQuery(".detail_background");
  detail_background.style.display = "block";
  if (element.isStream && !element.isSpace) {
    docQuery(".detail_thumnail").src = element.thumbnail.replace(
      "{type}",
      "480",
    );
    docQuery(".detail_info_button p").innerText = diffTimeTemp[element.name];
    nameTemp = element.name;
    typeTemp = "stream";
    docQuery(".detail_info_button").addEventListener("click", detailInfoEvent);
    docQuery(".detail_info_button").className = "detail_info_button is_stream";
  } else if (!element.isStream && element.isSpace) {
    docQuery(".detail_thumnail").src =
      "https://static-cdn.jtvnw.net/ttv-static/404_preview-380x213.jpg";
    docQuery(".detail_info_button p").innerText = "스페이스 진행 중!";
    docQuery(".detail_info_button").className = "detail_info_button is_space";
    nameTemp = element.isSpace;
    typeTemp = "space";
    docQuery(".detail_info_button").addEventListener("click", detailInfoEvent);
  } else {
    docQuery(".detail_thumnail").src =
      "https://static-cdn.jtvnw.net/ttv-static/404_preview-380x213.jpg";
    docQuery(".detail_info_button p").innerText =
      "최근 방송 " + diffTimeTemp[element.name];
    nameTemp = element.name;
    docQuery(".detail_info_button").className =
      "detail_info_button is_not_stream";
  }
  docQuery(".detail_info_name").innerText = element.displayName;
  docQuery(".detail_info_follows span").innerText = beautyFollows(
    element.follows,
  );
  docId("detail_info_auto_toggle_checkbox").checked =
    store.get("auto_start")[element.name].enabled;
  docId("detail_info_auto_toggle_checkbox").addEventListener(
    "change",
    (evt) => {
      store.set(`auto_start.${element.name}.enabled`, evt.target.checked);
    },
  );
  docId("detail_info_space_toggle_checkbox").checked =
    store.get("space_auto_start")[element.name].enabled;
  docId("detail_info_space_toggle_checkbox").addEventListener(
    "change",
    (evt) => {
      store.set(`space_auto_start.${element.name}.enabled`, evt.target.checked);
    },
  );
}

info.forEach((element, i) => {
  const panel_item = docId(element.name);
  let pipDelay = null;
  panel_item.addEventListener("click", (evt) => {
    if (evt.target.className === "panel_item_more") return;
    if (!pipDelay) {
      if (element.isStream && !element.isSpace) {
        ipcRenderer.send("getStream", element.name);
      } else if (!element.isStream && element.isSpace) {
        ipcRenderer.send("getSpace", element.name);
      }
      pipDelay = setTimeout(() => {
        pipDelay = null;
      }, 5000);
    }
  });
  const profile = document.createElement("div");
  profile.className = "panel_item_profile";
  if (element.isStream && !element.isSpace) profile.classList.add("is_stream");
  else if (!element.isStream && element.isSpace)
    profile.classList.add("is_space");

  const profile_img_div = document.createElement("div");
  profile_img_div.className = "panel_item_profile_image";
  profile_img_div.style.backgroundImage = `url(${element.profile})`;
  profile.append(profile_img_div);
  panel_item.append(profile);

  const panel_item_info = document.createElement("div");
  panel_item_info.className = "panel_item_info";

  const name = document.createElement("p");
  name.innerText = element.displayName;
  name.className = "panel_item_name";
  panel_item_info.append(name);

  const panel_item_stream_date = document.createElement("p");
  panel_item_stream_date.className = "panel_item_stream_date";
  const startDate = new Date(element.startDate);
  const nowDate = new Date();
  let diff = nowDate.getTime() - startDate.getTime();
  let diffTimes = Math.floor(diff / (1000 * 60));
  let diffTimeText = "";
  if (element.isStream && !element.isSpace) {
    if (diffTimes >= 60) {
      diffTimes = Math.floor(diffTimes / 60);
      diffTimeText = `${diffTimes}시간 전부터 방송 중!`;
      panel_item_stream_date.innerText = diffTimeText;
    } else {
      panel_item_stream_date.classList.add("is_stream");
      diffTimeText = `${diffTimes}분 전부터 방송 중!`;
      panel_item_stream_date.innerText = diffTimeText;
    }
  } else if (!element.isStream && element.isSpace) {
    panel_item_stream_date.classList.add("is_space");
    panel_item_stream_date.innerText = "스페이스 진행 중!";
  } else {
    diff = nowDate.getTime() - new Date(element.lastStreamDate).getTime();
    diffTimes = Math.floor(diff / (1000 * 60));
    panel_item_stream_date.innerText = "최근 방송";
    if (diffTimes >= 1440) {
      diffTimes = Math.floor(diffTimes / 60 / 24);
      diffTimeText = `${diffTimes}일 전`;
    } else if (diffTimes >= 60) {
      diffTimes = Math.floor(diffTimes / 60);
      diffTimeText = `${diffTimes}시간 전`;
    } else if (diffTimes < 60) {
      diffTimeText = `${diffTimes}분 전`;
    }
    const lastStreamDate = document.createElement("span");
    lastStreamDate.innerText = diffTimeText;
    panel_item_stream_date.append(lastStreamDate);
  }
  diffTimeTemp[element.name] = diffTimeText;
  if (element.isStream && !element.isSpace)
    panel_item_stream_date.classList.add("is_stream");
  else if (!element.isStream && element.isSpace)
    panel_item_stream_date.classList.add("is_space");
  panel_item_info.append(panel_item_stream_date);

  const follows = document.createElement("p");
  follows.className = "panel_item_follows";
  follows.innerText += "팔로워";
  const follows_span = document.createElement("span");
  follows_span.innerText = beautyFollows(element.follows);
  follows.append(follows_span);
  panel_item_info.append(follows);
  panel_item.append(panel_item_info);

  const more_img = document.createElement("img");
  more_img.src = "../../assets/more.svg";
  more_img.className = "panel_item_more";
  more_img.addEventListener("click", () => {
    moreInfoEvent(element);
  });
  docId(element.name).append(more_img);
});

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
let tabButtons = document.querySelectorAll(".panel_tab_button");
columns = Array.from(columns);
tabButtons = Array.from(tabButtons);
columns.push(...tabButtons);
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
    if (this.classList.contains("panel_tab_button")) {
      const dragSourceTabNumber =
        dragSource.parentElement.parentElement.id.split(":")[1];
      const dragOveredTabNumber = this.id.split(":")[1];
      const tab = docQuery(`.panel_tab${dragOveredTabNumber}`);
      if (dragOveredTabNumber < dragSourceTabNumber) {
        const lastItem = tab.lastChild.lastChild;
        const lastColumn = tab.lastChild;
        const dragSourceTab = dragSource.parentElement.parentElement;
        const firstColumn = dragSourceTab.firstChild;
        lastColumn.removeChild(lastItem);
        lastColumn.append(dragSource);
        firstColumn.prepend(lastItem);
        const columns = Array.from(
          dragSourceTab.getElementsByClassName("panel_column"),
        );
        columns.reverse().forEach((e, i) => {
          if (e.childElementCount !== 2) {
            const prevColumn = columns[i + 1];
            const lastItem = prevColumn.lastChild;
            prevColumn.removeChild(lastItem);
            e.prepend(lastItem);
          }
        });
      } else if (dragOveredTabNumber > dragSourceTabNumber) {
        const firstItem = tab.firstChild.firstChild;
        const firstColumn = tab.firstChild;
        firstColumn.removeChild(firstItem);
        const dragSourceTab = dragSource.parentElement.parentElement;
        dragSourceTab.lastChild.append(firstItem);
        firstColumn.prepend(dragSource);
        const columns = Array.from(
          dragSourceTab.getElementsByClassName("panel_column"),
        );
        columns.forEach((e, i) => {
          if (e.childElementCount !== 2) {
            const nextColumn = columns[i + 1];
            const firstItem = nextColumn.firstChild;
            nextColumn.removeChild(firstItem);
            e.append(firstItem);
          }
        });
      }
    } else {
      dragSource.innerHTML = this.innerHTML;
      this.innerHTML = evt.dataTransfer.getData("text/html");
      dragSource.id = this.id;
      this.id = evt.dataTransfer.getData("id");
      info.forEach((e) => {
        if (e.name === dragSource.id) {
          const panelItem = docId(dragSource.id);
          const moreButton = panelItem.querySelector(".panel_item_more");
          moreButton.addEventListener("click", () => {
            moreInfoEvent(e);
          });
        } else if (e.name === this.id) {
          const panelItem = docId(this.id);
          const moreButton = panelItem.querySelector(".panel_item_more");
          moreButton.addEventListener("click", () => {
            moreInfoEvent(e);
          });
        }
      });
    }
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

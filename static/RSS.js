const mainElement = document.getElementsByTagName("main")[0];
const addFeedMenu = document.getElementById("add_feed");
const blocker = document.getElementById("blocker");
const path = document.getElementById("path");

function hideCustomMenu() {
  hideBlocker();
  adaptiveContextMenu.className = "";
}

function load_additional_articles(e, observer) {
  if (e[0].isIntersecting) {
    createArticles(
      localStorage.getItem("rss.values.read"),
      localStorage.getItem("rss.values.category"),
      localStorage.getItem("rss.values.feed"),
      mainElement.lastId
    );
  }
}

function setPath() {
  path.classList.remove("unread");
  const category = localStorage.getItem("rss.values.category");
  const feedId = localStorage.getItem("rss.values.feed");

  if (localStorage.getItem("rss.values.read") == "unread") {
    path.classList.add("unread");
  }

  if (feedId) {
    path.innerHTML = " / " + category + " / " + getFeedName(feedId);
  } else if (category) {
    path.innerHTML = category;
  } else {
    const homeImage = document.createElement("img");
    homeImage.classList.add("img-home");
    path.innerHTML = "";
    path.appendChild(homeImage);
  }
}

let additional_article_trigger = new IntersectionObserver(
  load_additional_articles
);

let articles_end = document.querySelector("#scroll-trigger");

let feeds_array;
localStorage.setItem("rss.values.read", "unread");
localStorage.setItem("rss.values.category", "");
localStorage.setItem("rss.values.feed", "");

//TODO add error handling
async function get_feeds() {
  resp = await fetch("api/feeds");
  feeds_array = await resp.json();

  return feeds_array;
}

async function loadArticlesNow() {
  additional_article_trigger.disconnect();
  mainElement.innerHTML = "";
  result = await createArticles(
    localStorage.getItem("rss.values.read"),
    localStorage.getItem("rss.values.category"),
    localStorage.getItem("rss.values.feed")
  );
  setPath();
}

async function createArticles(status, category, feed_id, id = 0) {
  let articles = await getArticles(status, category, feed_id, id);
  if (id == 0 && articles.length == 0) {
    showNoArticles();
  } else {
    createArticleCards(articles);
  }
}

//TODO add error handling
async function getArticles(status, category, feed_id, id) {
  let url = new URL("api/feeds/articles", window.location.href);
  let params = new URLSearchParams(url.search);

  if (id !== 0) {
    url.searchParams.append("before", id);
  }
  if (status == "read") {
    url.searchParams.append("read", true);
  }
  if (status == "unread") {
    url.searchParams.append("read", false);
  }
  if (category !== "") {
    url.searchParams.append("category", category);
  }
  if (feed_id !== "") {
    url.searchParams.append("feed", feed_id);
  }

  response = await fetch(url);

  result = await response.json();
  return result;
}

function getFeedName(id) {
  return feeds_array.filter(function (data) {
    return data.id == id;
  })[0].title;
}

//Is this a relic of old code?
function htmlDecode(input) {
  var doc = new DOMParser().parseFromString(input, "text/html");
  return doc.documentElement.textContent;
}

//Modify to remove the custom article
function createArticleCards(articles) {
  articles.forEach(
    ({
      title,
      feed_id,
      link,
      image,
      added_epoch,
      read_epoch,
      id,
      feed_category,
    }) => {
      title = title.replace(/&apos/g, "'"); //fix poorly formatted quotes
      const feed = getFeedName(feed_id);
      const time_added = formatTimeSince(added_epoch);
      const article = document.createElement("article");

      const articleImage = document.createElement("img");
      articleImage.src = image;
      articleImage.onerror = function () {
        this.onerror = null;
        this.src = "noImage.png";
      };

      const articleTitle = document.createElement("h2");
      articleTitle.textContent = title;

      const articleLink = document.createElement("a");
      articleLink.target = "_blank";
      articleLink.href = link;
      articleLink.title = title;
      articleLink.appendChild(articleImage);
      articleLink.appendChild(articleTitle);

      const articleFeed = document.createElement("button");
      articleFeed.classList.add("feed-link");
      articleFeed.textContent = feed;

      const articleTime = document.createElement("h3");
      articleTime.textContent = time_added;

      article.setAttribute("article_id", id);
      article.setAttribute("feed_id", feed_id);
      article.setAttribute("category", feed_category);
      //article.setAttribute("image", image)
      //article.setAttribute("link", link)
      //article.setAttribute("time_added", formatTimeSince(added_epoch))
      //article.setAttribute("feed", getFeedName(feed_id))
      article.setAttribute("read", Math.min(1, read_epoch));
      article.append(articleLink);
      article.append(articleFeed);
      article.append(articleTime);
      mainElement.appendChild(article);
      mainElement.lastId = id;
    }
  );
  if (articles.length > 199) {
    additional_article_trigger.observe(articles_end);
  }
}

//This should be streamlined
function showNoArticles() {
  let hr = document.createElement("hr");
  hr.innerHTML = "No Articles Returned - try the context menu";
  mainElement.appendChild(hr);
}

//Check logic, but probably ok
function formatTimeSince(t) {
  let seconds = Date.now() / 1000 - t;
  d = new Date(t * 1000);
  if (seconds < 0) {
    return "now";
  } else if (seconds < 86400) {
    return d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2);
  } else if (seconds < 950400) {
    return Math.floor(seconds / 86400) + "d";
  } else {
    return (
      d.getFullYear() +
      "-" +
      ("0" + (d.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + d.getDate()).slice(-2)
    );
  }
}

//add error handling
async function articleUpdateRead(id, read) {
  document
    .querySelector("article[article_id='" + id + "']")
    .setAttribute("read", read);
  let url = new URL("api/feeds/articles_update_read", window.location.href);
  url.searchParams.append("read", !!+read);
  url.searchParams.append("id", parseInt(id));

  await fetch(url, { method: "PUT" });
}

//add error handling
async function feedRead(feed_id) {
  document
    .querySelectorAll("article[feed_id='" + feed_id + "']")
    .forEach((article) => {
      article.setAttribute("read", 1);
    });
  let url = new URL("api/feeds/articles_update_read", window.location.href);
  url.searchParams.append("read", true);
  url.searchParams.append("feed_id", feed_id);

  await fetch(url, { method: "PUT" });
}

//add error handling
async function categoryRead(category) {
  document
    .querySelectorAll("article[category='" + category + "']")
    .forEach((article) => {
      article.setAttribute("read", 1);
    });
  let url = new URL("api/feeds/articles_update_read", window.location.href);
  url.searchParams.append("read", true);
  url.searchParams.append("category", category);

  await fetch(url, { method: "PUT" });
}

//////////////////////////
let adaptiveContextMenu = document.getElementById("adaptive-context-menu");

function SelectMenuOption(menuItem) {
  hideCustomMenu();
  switch (menuItem.id) {
    case "feed-read":
      feedRead(menuItem.getAttribute("feed_id"));
      break;
    case "category-read":
      categoryRead(menuItem.getAttribute("category"));
      break;
    case "add-feed":
      showFeedPopup();
      break;
    case "undo-read":
      undoRead();
      break;
    case "toggle-read":
      toggleRead();
  }
}

function toggleRead() {
  if (localStorage.getItem("rss.values.read") == "") {
    localStorage.setItem("rss.values.read", "unread");
  } else {
    localStorage.setItem("rss.values.read", "");
  }
  loadArticlesNow();
}

async function addFeed(event) {
  console.log(event);
  document.getElementById("formSubmit").disabled = true;

  document.getElementById("loadingSpinner").classList.add("visible");
  resp = await fetch("api/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: addFeedMenu.title.value,
      link: addFeedMenu.link.value,
      category: addFeedMenu.category.value,
      fallback_image: addFeedMenu.image.value,
      update_frequency: addFeedMenu.frequency.valueAsNumber,
    }),
  });

  document.getElementById("loadingSpinner").classList.remove("visible");
  document.getElementById("formSubmit").disabled = false;

  switch (resp.status) {
    case 201:
      get_feeds();
      hideFeedPopup();
      break;
    case 409:
      alert("Failed to add duplicate Title or Feed link");
      break;
    default:
      alert(resp.status);
      break;
  }
}

async function showFeedPopup() {
  addCategoryList();
  showBlocker();
  addFeedMenu.classList.add("visible");
}

function showBlocker() {
  blocker.classList.add("visible");
  document.body.classList.add("locked");
}

async function hideFeedPopup() {
  hideBlocker();
  addFeedMenu.classList.remove("visible");
}

function hideBlocker() {
  blocker.classList.remove("visible");
  document.body.classList.remove("locked");
}

//Errors?
async function addCategoryList() {
  let categories = await getCategories();
  let feedList = document.getElementById("feed-categories");
  feedList.innerHTML = "";
  categories.forEach((category) => {
    let newOption = document.createElement("option");
    newOption.value = category;
    feedList.appendChild(newOption);
  });
}

//Errors?
async function getCategories() {
  response = await fetch("api/categories");
  result = await response.json();
  return result;
}

function calculateColumnCount() {
  let columnWidth = Math.round(window.innerWidth / 300);
  document.documentElement.style.setProperty("--columnAmount", columnWidth);
}

//Errors?
async function undoRead(event) {
  await fetch("api/feeds/articles_update_read", { method: "PUT" });
}

//TODO rewrite
function showCustomMenu(e) {
  showBlocker();
  if (e.target.closest("article") == null) {
    adaptiveContextMenu.classList.add("background");
  } else {
    adaptiveContextMenu.classList.add("article");
    document
      .getElementById("feed-read")
      .setAttribute(
        "feed_id",
        e.target.closest("article").getAttribute("feed_id")
      );
    document
      .getElementById("category-read")
      .setAttribute(
        "category",
        e.target.closest("article").getAttribute("category")
      );
  }

  (async () => {
    // Re-positioning the Context Menu Element According to cursor position and left/right
    if (e.clientY + adaptiveContextMenu.clientHeight < window.innerHeight) {
      adaptiveContextMenu.style.top = e.clientY + `px`;
      adaptiveContextMenu
        .querySelectorAll(".custom-contextmenu-sub")
        .forEach((el) => {
          if (el.classList.contains("up")) el.classList.remove("up");
        });
    } else {
      adaptiveContextMenu.style.top =
        e.clientY - adaptiveContextMenu.clientHeight + `px`;
      adaptiveContextMenu
        .querySelectorAll(".custom-contextmenu-sub")
        .forEach((el) => {
          if (!el.classList.contains("up")) el.classList.add("up");
        });
    }
    if (e.clientX + adaptiveContextMenu.clientWidth < window.innerWidth) {
      adaptiveContextMenu.style.left = e.clientX + `px`;
      adaptiveContextMenu
        .querySelectorAll(".custom-contextmenu-sub")
        .forEach((el) => {
          if (el.classList.contains("left")) el.classList.remove("left");
        });
    } else {
      adaptiveContextMenu.style.left =
        e.clientX - adaptiveContextMenu.clientWidth + `px`;
      adaptiveContextMenu
        .querySelectorAll(".custom-contextmenu-sub")
        .forEach((el) => {
          if (!el.classList.contains("left")) el.classList.add("left");
        });
    }
  })();
}

function articleClick(event, article) {
  if (event.target.tagName == "BUTTON" && event.button == 0) {
    localStorage.setItem(
      "rss.values.category",
      article.getAttribute("category")
    );
    localStorage.setItem("rss.values.feed", article.getAttribute("feed_id"));
    loadArticlesNow();
  } else if (event.composedPath()[1].tagName == "A") {
    articleUpdateRead(article.getAttribute("article_id"), 1);
  } else if (event.button == 0) {
    articleUpdateRead(
      article.getAttribute("article_id"),
      1 - event.target.getAttribute("read")
    ); //convert numeric to true and inverts it
  }
}

function hijackBackButton() {
  hideFeedPopup();
  hideCustomMenu();
  if (localStorage.getItem("rss.values.feed") != "") {
    localStorage.setItem("rss.values.feed", "");
  } else if (localStorage.getItem("rss.values.category") != "") {
    localStorage.setItem("rss.values.category", "");
  }
  loadArticlesNow();
  history.pushState(null, "");
}

//Startup check logic

get_feeds().then(() => loadArticlesNow());
calculateColumnCount();

history.pushState(null, "");

addFeedMenu.addEventListener("submit", addFeed);

function getClickTarget(event) {
  if (event.target.tagName == "INPUT") {
    return ["input", null];
  }
  if (event.target.id == "blocker") {
    return ["blocker", null];
  }
  article = event.target.closest("article");
  if (event.target.classList.contains("feed-link")) {
    return ["feed-link", article];
  }
  if (article != null) {
    if (event.composedPath()[1].tagName == "A") {
      return ["link", article];
    } else {
      return ["article", article];
    }
  }
  menuItem = event.target.closest("div[role=menu-item]");
  if (menuItem != null) {
    return ["menu-item", menuItem];
  }
  if (event.target.tagName == "MAIN") {
    return "background"
  }
  return [null, null];
}

function clickBlocker(event) {
  hideBlocker();
  hideFeedPopup();
  hideCustomMenu();
}

function clickFeedLink(event, target) {
  localStorage.setItem("rss.values.category", target.getAttribute("category"));
  localStorage.setItem("rss.values.feed", target.getAttribute("feed_id"));
  loadArticlesNow();
}

function clickMenuItem(event, target) {
  event.preventDefault();
  SelectMenuOption(target);
}

function customClick(event) {
  var [type, target] = getClickTarget(event);
  switch (type) {
    case "blocker":
      clickBlocker(event);
      break;
    case "feed-link":
      clickFeedLink(event, target);
      break;
    case "link":
      articleUpdateRead(target.getAttribute("article_id"), 1);
      break;
    case "article":
      articleUpdateRead(
        target.getAttribute("article_id"),
        1 - target.getAttribute("read")
      );
      break;
    case "menu-item":
      clickMenuItem(event, target);
      break;
  }
}

function customRightClick(event) {
  console.log("rightclick");
  var [type, target] = getClickTarget(event);
  if (type != "input") {
    event.preventDefault();
  }
  switch (type) {
    case "blocker":
      clickBlocker(event);
      break;
    case "menu-item":
      clickMenuItem(event, target);
      break;
    case "input":
    case null:
      break
    default:
      showCustomMenu(event);
  }
}

function customMiddleClick(event) {
  if (event.button == 1) {
    var [type, target] = getClickTarget(event);
    switch (type) {
      case "blocker":
        clickBlocker(event);
        break;
      case "link":
        articleUpdateRead(target.getAttribute("article_id"), 1);
        break;
      case "menu-item":
        clickMenuItem(event, target);
        break;
    }
  }
}

addEventListener("popstate", hijackBackButton);
addEventListener("resize", calculateColumnCount);
addEventListener("click", customClick);
addEventListener("auxclick", customMiddleClick);
addEventListener("contextmenu", customRightClick);

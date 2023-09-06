///////////////////////////////////////

let testing = (e, observer) => {
	if (e[0].isIntersecting) {
		createArticles(localStorage.getItem('rss.values.read'),localStorage.getItem('rss.values.category'),localStorage.getItem('rss.values.feed'),document.getElementsByTagName('main')[0].lastId)
	}
}

let observer = new IntersectionObserver(testing);

let target = document.querySelector("#scroll-trigger");

/////////////////////////////////////////////////////////////

let feeds_array
localStorage.setItem('rss.values.read','unread')
localStorage.setItem('rss.values.category','')
localStorage.setItem('rss.values.feed','')
var loading_bar = document.getElementById('loading-bar')

class RssArticle extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {

    const shadow = this.attachShadow({mode: 'open'});

    const image = document.createElement("img")
    image.src = this.getAttribute("image")
		image.onerror = function () {
			this.onerror=null;
			this.src='noImage.png';
		}
		
    const title = document.createElement("h2")		
    title.textContent = this.title
    
    const link = document.createElement("a")
    link.target = "_blank"
    link.href = this.getAttribute("link")
    link.appendChild(image)
    link.appendChild(title)
    
    const feed = document.createElement("button")
    feed.textContent = this.getAttribute("feed")
    
    const time = document.createElement("h3")
    time.textContent = this.getAttribute("time_added")

    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', 'style.css');

    this.shadowRoot.append(linkElem);
    this.shadowRoot.append(link);
    this.shadowRoot.append(feed);
    this.shadowRoot.append(time);

  } 
}

customElements.define('rss-article', RssArticle, { extends: 'article' });

async function get_feeds() {
	loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") + 1)
	resp = await fetch("api/feeds")	
	feeds_array = await resp.json()
	loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") - 1)
	return feeds_array
}

async function loadArticlesNow() {
	observer.disconnect();
	document.getElementsByTagName('main')[0].innerHTML = ''
	//alert(localStorage.getItem('rss.values.category') + " " + localStorage.getItem('rss.values.feed'))
	result = await createArticles(localStorage.getItem('rss.values.read'),localStorage.getItem('rss.values.category'),localStorage.getItem('rss.values.feed'))
}

async function createArticles(status,category,feed_id,id = 0) {
	let articles = await getArticles(status,category,feed_id,id)
	if (id == 0 && articles.length == 0) {
		showNoArticles()
	} else {
		createArticleCards(articles)
	}
}

async function getArticles(status,category,feed_id,id) {
	let url = new URL('api/feeds/articles',window.location.href);
	let params = new URLSearchParams(url.search);

	if (id !== 0) {url.searchParams.append("before",id)}
	if (status == 'read') {url.searchParams.append("read",true)}
	if (status == 'unread') {url.searchParams.append("read",false)}
	if (category !== '') {url.searchParams.append("category_id",category)}
	if (feed_id !== '') {url.searchParams.append("feed",feed_id)}

	loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") + 1)
	response = await fetch(url)
	loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") - 1)
	result = await response.json()
	return result
}

function getFeedName(id) {
	return feeds_array.filter( 
		function(data) {
			return data.id == id 
		}
	)[0].title
}

function htmlDecode(input) {
  var doc = new DOMParser().parseFromString(input, "text/html");
  return doc.documentElement.textContent;
}

function createArticleCards(articles) {
	articles.forEach(({title,feed_id,link,image,added_epoch,read_epoch,id,feed_category_id}) => {
    title = title.replace(/&apos;/g, '\'')
		const article = document.createElement('article',{is: 'rss-article'})
		//article.setAttribute("is","rss-article")
		article.title = title
		article.setAttribute("article_id",id)
		article.setAttribute("feed_id",feed_id)
		article.setAttribute("category_id",feed_category_id)
		article.setAttribute("image",image)
		article.setAttribute("link",link)
		article.setAttribute("time_added",timeSince(added_epoch))
		article.setAttribute("feed",getFeedName(feed_id))
		article.setAttribute("read",Math.min(1,read_epoch))
		document.getElementsByTagName('main')[0].appendChild(article)
		document.getElementsByTagName('main')[0].lastId = id
		})
	if (articles.length>199) {
		observer.observe(target)
	}
}

function showNoArticles() {
	let hr = document.createElement('hr')
	hr.innerHTML = 'No Articles Returned'
	document.getElementsByTagName('main')[0].appendChild(hr)
}

function timeSince(t) {
  let seconds = (Date.now()/1000 - t )
  d = new Date(t * 1000)
  if (seconds < 0) {
    return "now"
  } else if (seconds < 864e2) {
    return d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2)
  } else if (seconds < 9504e2) {
    return Math.floor(seconds/864e2) + "d"
  } else {
    return 1900+d.getYear() + "-" + ("0" + (d.getMonth()+1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2)
  }
}

async function articleUpdateRead(id,read) {
		document.querySelector("article[article_id='" + id + "']").setAttribute('read',read)
  	let url = new URL('api/feeds/articles_update_read',window.location.href);
  	url.searchParams.append("read",!!+read)
    url.searchParams.append("id",parseInt(id))
    loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") + 1)
    await fetch(url, {method: 'PUT'})
    loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") - 1)
}

async function feedRead(feed_id) {
	document.querySelectorAll("article[feed_id='" + feed_id + "']").forEach((article) => {
		article.setAttribute("read",1)
	});
	let url = new URL('api/feeds/articles_update_read',window.location.href);	
	url.searchParams.append("read",true)
	url.searchParams.append("feed_id",feed_id)
	loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") + 1)
	await fetch(url, {method: 'PUT'})
	loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") - 1)
}

async function categoryRead(category_id) {
		document.querySelectorAll("article[category_id='" + category_id + "']").forEach((article) => {
			article.setAttribute("read",1)
		});
	let url = new URL('api/feeds/articles_update_read',window.location.href);	
	url.searchParams.append("read",true)
	url.searchParams.append("category_id",category_id)
	loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") + 1)
	await fetch(url, {method: 'PUT'})
	loading_bar.setAttribute("amount", loading_bar.getAttribute("amount") - 1)
}

//////////////////////////
let adaptiveContextMenu = document.getElementById('adaptive-context-menu')

function initiateMenuOption (event) {
	switch(event.target.id) {
	case 'feed-read':
		feedRead(event.target.getAttribute("feed_id"))
		break
	case 'category-read':
		categoryRead(event.target.getAttribute("category_id"))
		break
	case 'add-feed':
		addFeedPopup()
		break
	case 'undo-read':
		undoRead()
		break
	case 'toggle-read':
		toggleRead()
		break
	}
}

function toggleRead() {
	if (localStorage.getItem('rss.values.read') == "") {
		localStorage.setItem('rss.values.read','unread')
	} else {
		localStorage.setItem('rss.values.read','')
	}
	loadArticlesNow()
}

let loginForm = document.getElementById("add_feed")

loginForm.addEventListener("submit", addFeed)

async function addFeed(event) {
  event.preventDefault();
  //curl -k -H 'Content-Type: application/json' -X POST http://192.168.0.197:8080/api/feeds -d '{"feeds": [{"title":"Weapons of Mass Destruction","category":"Books","link":"https://www.royalroad.com/fiction/syndication/64916","fallback_image":"","update_frequency":300}]}'

  await fetch("api/feeds", {
  	method: 'POST',
  	headers: {"Content-Type": "application/json"},
  	body: JSON.stringify({
    'feeds': [
      {
        'title': loginForm.title.value,        
        'link': loginForm.link.value,
        'category': loginForm.category.value,
        'fallback_image': loginForm.image.value,
        'update_frequency': loginForm.frequency.valueAsNumber
      }
    ]
  })
  })
  await get_feeds()
};

async function addFeedPopup() {
	addCategoryList()
	let addFeedMenu = document.getElementById("add-feed-menu")
	addFeedMenu.classList.add('visible')
}

async function removeFeedPopup() {
	let addFeedMenu = document.getElementById("add-feed-menu")
	addFeedMenu.classList.remove('visible')
}

async function addCategoryList() {
	let categories = await getCategories()
	let feedList = document.getElementById("feed-categories")
	feedList.innerHTML = ''
	categories.forEach(({title}) => {
		let newOption = document.createElement("option");
        newOption.value = title;
        feedList.appendChild(newOption);
	})
}

async function getCategories() {
	response = await fetch('api/categories')
	result = await response.json()
	return result
}

function setColumns() {
	let columnWidth = Math.round(window.innerWidth/300)
	document.documentElement.style.setProperty('--columnAmount', columnWidth);
}

async function undoRead(event) {
	await fetch("api/feeds/articles_update_read", {method: 'PUT'})
}

function customMenu(e) {
	removeFeedPopup()
	e.preventDefault()		
    if (adaptiveContextMenu.classList.length == 0) {
	    if (e.target.closest('article') == null) {
    		adaptiveContextMenu.classList.add('background');
	    } else {
    		adaptiveContextMenu.classList.add('article');
    		document.getElementById('feed-read').setAttribute("feed_id", e.target.closest('article').getAttribute("feed_id"));
    		document.getElementById('category-read').setAttribute("category_id", e.target.closest('article').getAttribute("category_id"));
	    }

    (async ()=>{
        // Re-positioning the Context Menu Element According to cursor position and left/right
        if((e.clientY +  adaptiveContextMenu.clientHeight) < window.innerHeight){
            adaptiveContextMenu.style.top = e.clientY + `px`;
            adaptiveContextMenu.querySelectorAll('.custom-contextmenu-sub').forEach(el=>{
                if(el.classList.contains('up'))
                    el.classList.remove('up');
            })
        }else{
            adaptiveContextMenu.style.top = (e.clientY - adaptiveContextMenu.clientHeight) + `px`;
            adaptiveContextMenu.querySelectorAll('.custom-contextmenu-sub').forEach(el=>{
                if(!el.classList.contains('up'))
                    el.classList.add('up');
            })
        }
        if((e.clientX +  adaptiveContextMenu.clientWidth) < window.innerWidth){
            adaptiveContextMenu.style.left = e.clientX + `px`
            adaptiveContextMenu.querySelectorAll('.custom-contextmenu-sub').forEach(el=>{
                if(el.classList.contains('left'))
                    el.classList.remove('left');
            })
        }else{
            adaptiveContextMenu.style.left = (e.clientX - adaptiveContextMenu.clientWidth) + `px`;
            adaptiveContextMenu.querySelectorAll('.custom-contextmenu-sub').forEach(el=>{
                if(!el.classList.contains('left'))
                    el.classList.add('left');
            })
        }
    })()
    } else {
    	adaptiveContextMenu.className = ''
    }
}

window.addEventListener('contextmenu', customMenu)

/////////////////////////
 
window.addEventListener('auxclick', e => {
    if(adaptiveContextMenu.classList.length > 0 && e.button !== 2) {
    	e.preventDefault()
    	adaptiveContextMenu.className = ''
    } else if (event.target.tagName == 'ARTICLE' && event.composedPath()[1].tagName == 'A' && e.button !== 2) {
				articleUpdateRead(event.target.getAttribute('article_id'),1)
			}
})

adaptiveContextMenu.addEventListener('click', initiateMenuOption)

window.addEventListener('click', articleClick)

function articleClick (event) {
	if(adaptiveContextMenu.classList.length > 0) {
    	event.preventDefault()
      adaptiveContextMenu.className = ''
    }
	else if (event.composedPath()[0].tagName == 'BUTTON' && event.target.tagName == 'ARTICLE') {
		localStorage.setItem('rss.values.category',event.target.getAttribute("category_id"))
		localStorage.setItem('rss.values.feed',event.target.getAttribute("feed_id"))
		loadArticlesNow()
	} else if (event.target.tagName == 'ARTICLE') {
		if (event.composedPath()[1].tagName == 'A') {
			articleUpdateRead(event.target.getAttribute('article_id'),1)
		} else {
			articleUpdateRead(event.target.getAttribute('article_id'),1 - event.target.getAttribute('read')) //This horrible little thing converts numeric to true and inverts it :P
		}
	}
}


/////////////////////////

get_feeds().then(() => loadArticlesNow())
setColumns()

history.pushState(null, "");

window.addEventListener("popstate", () => {
	removeFeedPopup()
	adaptiveContextMenu.className = ''
	if (localStorage.getItem('rss.values.feed') != '') {
		localStorage.setItem('rss.values.feed','')
	} else if (localStorage.getItem('rss.values.category') != '') {
		localStorage.setItem('rss.values.category','')
	}
	loadArticlesNow()
	history.pushState(null,"")
})

addEventListener("resize", (event) => {
	setColumns();
});
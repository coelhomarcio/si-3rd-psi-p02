// VARIABLES ===========================================================================================================

const form = document.querySelector("form")
const formInput = document.querySelector("input")
const formInputBtn = document.querySelector("#input_btn")
const warnings = document.querySelector(".warnings")
const urlCors = "https://enigmatic-sierra-60542.herokuapp.com/"
const urlLocalDateTime = urlCors + "https://time.is/Unix/"
const urlStocks = "http://cotacao.b3.com.br/mds/api/v1/DailyFluctuationHistory/"
const urlNews = urlCors + "https://br.investing.com/news/stock-market-news/"
let dbStocks = ["PETR4", "VALE3", "PETR3", "MGLU3", "AZUL4"]

// =====================================================================================================================

// FETCH DOM ===========================================================================================================

async function fetchDOM(url) {
    const response = await (await fetch(url)).text()
    const dom = await new DOMParser()
    return dom.parseFromString(response, "text/html")
}

// =====================================================================================================================

// FETCH JSON ==========================================================================================================

async function fetchJSON(url) {
    return await (await fetch(url)).json()
}

// =====================================================================================================================

// LOCAL, DATE, TIME ===================================================================================================

function loadLocalDateTime() {
    const localSelector = "#footer div:last-of-type a:last-of-type"
    const dateTimeSelector = "#clock"
    const localDateTimeElement = document.querySelector("#local_date_time")
    const errorMsg = "Localização e hora certa fora do ar! Nova tentativa em 1 minuto..."
    getLocalDateTime(localSelector, dateTimeSelector, localDateTimeElement)
        .catch(error => {
            if (error) {
                localDateTimeElement.textContent = errorMsg
                setTimeout(() => loadLocalDateTime(), 60000)
            }
        })
}

async function getLocalDateTime(localSelector, dateTimeSelector, localDateTimeElement) {
    const doc = await fetchDOM(urlLocalDateTime)
    const local = doc.querySelector(localSelector).textContent
    const dateTime = doc.querySelector(dateTimeSelector).textContent
    await updateLocalDateTime(local, dateTime, localDateTimeElement)
}

function updateLocalDateTime(local, dateTime, localDateTimeElement) {
    if (dateTime.toString().slice(-3) === "000")
        loadLocalDateTime()
    else {
        localDateTimeElement.textContent = local + " | " + new Date(dateTime * 1000)
            .toLocaleDateString("pt-BR") + " | " + new Date(dateTime * 1000)
            .toLocaleTimeString("pt-BR")
        setTimeout(() =>
            updateLocalDateTime(local, ++dateTime, localDateTimeElement), 1000)
    }
}

// =====================================================================================================================

// STOCKS ==============================================================================================================

function loadStocksStorage() {
    if (localStorage.hasOwnProperty("dbStocks"))
        dbStocks = JSON.parse(localStorage.dbStocks)
    else
        localStorage.dbStocks = JSON.stringify(dbStocks)
}

function checkStocks(stock) {
    if (stock === null || stock.length === 0) {
        formInput.classList.add("empty_field")
        setTimeout(() => formInput.classList.remove("empty_field"), 500)
    }
    else if (dbStocks.includes(stock)) {
        warnings.classList.add("stock_repeated")
        setTimeout(() => warnings.classList.remove("stock_repeated"), 2000)
    }
    else if (dbStocks.length >= 10) {
        warnings.classList.add("stock_limit")
        setTimeout(() => warnings.classList.remove("stock_limit"), 2000)
    }
    else {
        updateDb(stock)
        loadStocks(true, true)
    }
    formInput.value = ""
    formInput.focus()
}

function loadStocks(firstTime, warningAdded=false) {
    function promises(firstTime) {
        if (firstTime) {
            return dbStocks
                .filter(stock => {
                    if (! document.getElementById(stock))
                        return stock
                })
                .map(stock => getStocks(stock))
        }
        else {
            return dbStocks.map(stock => getStocks(stock))
        }
    }

    loadStocksStorage()
    Promise.all(promises(firstTime))
        .then(response => {
            const stocksElemDiv = document.querySelector("#stocks_elem_div")
            response.forEach(item => {
                if (warnings.classList.contains("out_of_service")) {
                    warnings.classList.remove("out_of_service")
                    loadStocks(true)
                }
                if (item.length !== 0) {
                    if (firstTime)
                        stocksCreateElem(stocksElemDiv, item)
                    else
                        stocksUpdateElem(stocksElemDiv, item)
                    if (warningAdded) {
                        warnings.classList.add("stock_added")
                        setTimeout(() => warnings.classList.remove("stock_added"), 2000)
                    }
                }
                else if (warningAdded) {
                    updateDb(item[0], false)
                    warnings.classList.add("stock_not_exist")
                    setTimeout(() => warnings.classList.remove("stock_not_exist"), 2000)
                }
            })
        })
        .catch(error => {
            if (error.message === "Failed to fetch") {
                if (! warnings.classList.contains("out_of_service"))
                    warnings.classList.add("out_of_service")
                if (warningAdded)
                    updateDb(dbStocks[dbStocks.length -1], false)
            }
        })
}

async function getStocks(stock) {
    const dataStock = await fetchJSON(urlStocks + await stock)
    const lastIndex = await dataStock.TradgFlr.scty.lstQtn.length - 1
    const arrowUp = "<i class=\"fas fa-long-arrow-alt-up\"></i>"
    const arrowDown = "<i class=\"fas fa-long-arrow-alt-down\"></i>"
    let arrow
    let stockInfo = null
    try {
        if (dataStock.TradgFlr.scty.lstQtn[lastIndex].prcFlcn > 0)
            arrow = arrowUp
        else if (dataStock.TradgFlr.scty.lstQtn[lastIndex].prcFlcn < 0)
            arrow = arrowDown
        else
            arrow = ""
        stockInfo = [
            await dataStock.TradgFlr.scty.symb,
            "Preço",
            await new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
                .format(dataStock.TradgFlr.scty.lstQtn[lastIndex].closPric),
            "Oscilação do dia",
            arrow,
            await dataStock.TradgFlr.scty.lstQtn[lastIndex].prcFlcn
                .toFixed(2).replace(/\./g, ",") + "%",
            "Última atualização",
            await dataStock.TradgFlr.date.split("-").reverse().join("/"),
            await dataStock.TradgFlr.scty.lstQtn[lastIndex].dtTm.slice(0, -3),
            "X"
        ]
    }
    catch(error) {
        stockInfo = []
        updateDb(stock, false)
    }
    return stockInfo
}

function stocksCreateElem(stocksElemDiv, stockInfo) {
    const stockElemDiv = document.createElement("div")
    stockElemDiv.style.opacity = "0"
    stocksElemDiv.appendChild(stockElemDiv)
    setTimeout(() => {
        stockElemDiv.style.opacity = "1"
    }, 0)
    stockElemDiv.id = stockInfo[0]
    stockInfo.forEach(info => {
        stockElemDiv.appendChild(document.createElement("div")).innerHTML = info
        if (info === stockInfo[2] || info === stockInfo[5])
            animationStockElemDiv(stockElemDiv, stockInfo, info)
    })
    stockElemDiv.lastElementChild.onclick = () => {
        stockElemDiv.style.opacity = "0"
        setTimeout(() => {
            stockElemDiv.remove()
        }, 250)
        updateDb(stockInfo[0], false)
    }
}

function stocksUpdateElem(stocksElemDiv, stockInfo) {
    if (stocksElemDiv.childElementCount === 0)
        stocksCreateElem(stocksElemDiv, stockInfo)
    else {
        const stockElemDiv = document.getElementById(stockInfo[0])
        stockInfo.forEach((info, index) => {
            const stockOldPrice = stockElemDiv.children[2].textContent
                .replace(",", ".").slice(3)
            stockElemDiv.children[index].innerHTML = info
            if (info === stockInfo[2] || info === stockInfo[5])
                animationStockElemDiv(stockElemDiv, stockInfo, info, stockOldPrice)
        })
    }
}

function animationStockElemDiv(stockElemDiv, stockInfo, info, stockOldPrice=false) {
    if (stockOldPrice && info === stockInfo[2]) {
        if (info.replace(",", ".").slice(3) > stockOldPrice) {
            stockElemDiv.children[2].style.color = "#00ff00cc"
            stockElemDiv.children[2].style.backgroundColor = "#fafafa"
            setTimeout(() => {
                stockElemDiv.children[2].style.color = "#fafafa"
                stockElemDiv.children[2].style.backgroundColor = "#2b2b2b"
            }, 250)
        }
        else if (info.replace(",", ".").slice(3) < stockOldPrice) {
            stockElemDiv.children[2].style.color = "#ff3300"
            stockElemDiv.children[2].style.backgroundColor = "#fafafa"
            setTimeout(() => {
                stockElemDiv.children[2].style.color = "#fafafa"
                stockElemDiv.children[2].style.backgroundColor = "#2b2b2b"
            }, 250)
        }
    }
    if (info === stockInfo[5]) {
        let fluctuation = info.replace(",", ".").slice(0, -1)
        if (fluctuation > 0) {
            stockElemDiv.children[4].style.color = "#00ff00cc"
            stockElemDiv.children[5].style.color = "#00ff00cc"
        } else if (fluctuation < 0) {
            stockElemDiv.children[4].style.color = "#ff3300"
            stockElemDiv.children[5].style.color = "#ff3300"
        } else {
            stockElemDiv.children[5].style.color = "#fafafa"
        }
    }
}

function updateDb(stock, addStock=true) {
    if (addStock)
        dbStocks.push(stock)
    else
        dbStocks = dbStocks.filter(item => item !== stock)
    localStorage.dbStocks = JSON.stringify(dbStocks)
}

// =====================================================================================================================

// NEWS ================================================================================================================

function loadNews(refresh=false) {
    const newsElementDiv = document.querySelector("#news_elem_div")
    const newsArticleSelector = ".largeTitle"
    const newsTitleSelector = newsArticleSelector + " article .title"
    const newsBriefSelector = newsArticleSelector + " article .textDiv p"
    const newsTimeAgoSelector = newsArticleSelector + " article .date"
    const newsImgSelector = newsArticleSelector + " article a img"
    const newsLinkSelector = newsArticleSelector + " article > a"
    const newsQty = 20
    const errorMsg = "Notícias fora do ar! Nova tentativa em 1 minuto..."
    getNews(newsTitleSelector, newsBriefSelector,
            newsTimeAgoSelector, newsImgSelector,
            newsLinkSelector, refresh, newsQty)
        .then(response => updateNews(newsElementDiv, response, refresh, newsQty))
        .catch(error => {
            if (error) newsElementDiv.textContent = errorMsg
        })
}

async function getNews(newsTitleSelector, newsBriefSelector,
                       newsTimeAgoSelector, newsImgSelector,
                       newsLinkSelector, refresh, newsQty) {
    const doc = await fetchDOM(urlNews)
    const news = {}
    news.title = []
    news.brief = []
    news.timeAgo = []
    news.img = []
    news.link = []
    try {
        const newsTitle = await doc.querySelectorAll(newsTitleSelector)
        const newsBrief = await doc.querySelectorAll(newsBriefSelector)
        const newsTimeAgo = await doc.querySelectorAll(newsTimeAgoSelector)
        const newsImg = await doc.querySelectorAll(newsImgSelector)
        const linkRoot = "https://br.investing.com"
        const newsLink = await doc.querySelectorAll(newsLinkSelector)
        for (let i = 0; i < newsQty; i++) {
            news.title[i] = await newsTitle[i].textContent.trim()
            news.brief[i] = await newsBrief[i].textContent.trim()
            news.timeAgo[i] = newsTimeAgo[i].textContent
            news.img[i] = await newsImg[i].getAttribute("data-src")
            if (newsLink[i].getAttribute("href")[0] === "/")
                news.link[i] = linkRoot + newsLink[i].getAttribute("href")
            else
                news.link[i] = await newsLink[i].getAttribute("href")
        }
    }
    catch (error) {
        return error
    }
    return news
}

function updateNews(newsElementDiv, response, refresh, newsQty) {
    if (! refresh) {
        newsElementDiv.innerHTML = ""
        for (let i = 0; i < newsQty; i++) {
            const newsDiv = document.createElement("div")
            newsElementDiv.appendChild(newsDiv)
            newsDiv.innerHTML =
                `<h3>${response.title[i]}</h3>
                <p>${response.brief[i]}<small>${response.timeAgo[i]}</small></p>
                <a href="${response.link[i]}" target="_blank">
                <img src="${response.img[i]}" alt="${response.title[i]}"></a>`
        }
    }
    else {
        if (newsElementDiv.childElementCount < newsQty)
            updateNews(newsElementDiv, response, false, newsQty)
        else {
            const newsDivs = newsElementDiv.querySelectorAll("div")
            newsDivs.forEach((news, index) => news.innerHTML =
                `<h3>${response.title[index]}</h3>
                <p>${response.brief[index]}<small>${response.timeAgo[index]}</small></p>
                <a href="${response.link[index]}" target="_blank">
                <img src="${response.img[index]}" alt="${response.title[index]}"></a>`)
        }
    }
}

// =====================================================================================================================

// EVENTS ==============================================================================================================

form.onsubmit = event => event.preventDefault()
formInput.focus()
formInput.onkeyup = () => formInput.value = formInput.value.trim().toUpperCase()
formInputBtn.onclick = () => checkStocks(formInput.value.trim().toUpperCase())

// =====================================================================================================================

// CALLS ===============================================================================================================

loadLocalDateTime()
loadStocksStorage()
loadStocks(true)
setInterval(() => loadStocks(false), 1000)
loadNews()
setInterval(() => loadNews(true), 60000)

// =====================================================================================================================

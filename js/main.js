// VARIABLES ===========================================================================================================

const form = document.querySelector("form")
const formInput = document.querySelector("input")
const formInputBtn = document.querySelector("#input_btn")
const urlCors = "https://cors-anywhere.herokuapp.com/"
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
        form.classList.add("stock_repeated")
        setTimeout(() => form.classList.remove("stock_repeated"), 2000)
    }
    else if (dbStocks.length >= 10) {
        form.classList.add("stock_limit")
        setTimeout(() => form.classList.remove("stock_limit"), 2000)
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
            response.forEach(item => {
                if (item.length !== 0) {
                    if (firstTime)
                        stocksCreateElem(item)
                    else
                        stocksUpdateElem(item)
                    if (warningAdded) {
                        form.classList.add("stock_added")
                        setTimeout(() => form.classList.remove("stock_added"), 2000)
                    }
                }
                else if (warningAdded) {
                    updateDb(item[0], false)
                    form.classList.add("stock_not_exist")
                    setTimeout(() => form.classList.remove("stock_not_exist"), 2000)
                }
            })
        })
        .catch(error => {
            if (error.message === "Failed to fetch") {
                form.classList.add("out_of_service")
                setTimeout(() => form.classList.remove("out_of_service"), 2000)
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

function stocksCreateElem(stockInfo) {
    const stocksElemDiv = document.querySelector("#stocks_elem_div")
    const stockElemDiv = document.createElement("div")
    stockElemDiv.style.opacity = "0"
    stocksElemDiv.appendChild(stockElemDiv)
    setTimeout(() => {
        stockElemDiv.style.opacity = "1"
    }, 0)
    stockElemDiv.id = stockInfo[0]
    stockInfo.forEach(info => {
        stockElemDiv.appendChild(document.createElement("div")).innerHTML = info
        if (info === stockInfo[5]) {
            let fluctuation = info.replace(",", ".").slice(0, -1)
            if (fluctuation > 0) {
                stockElemDiv.children[4].style.color = "#00ff00cc"
                stockElemDiv.children[5].style.color = "#00ff00cc"
            }
            else if (fluctuation < 0) {
                stockElemDiv.children[4].style.color = "#ff3300"
                stockElemDiv.children[5].style.color = "#ff3300"
            }
            else {
                stockElemDiv.children[5].style.color = "#fafafa"
            }
        }
        // rever a parte acima para update
        // refazer a parte abaixo
        // if (info === stockInfo[2]) {
        //     const togglePrice = blinkPrice(info.replace(",", ".").slice(3, -1))
        //     if (togglePrice === 1) {
        //         stockElemDiv.children[2].style.color = "#00ff00cc"
        //         stockElemDiv.children[5].style.backgroundColor = "#00ff00cc"
        //         setTimeout(() => {
        //             stockElemDiv.children[2].style.color = "#fafafa"
        //             stockElemDiv.children[5].style.backgroundColor = "#2b2b2b"
        //         }, 250)
        //     } else if (togglePrice === 2) {
        //         stockElemDiv.children[2].style.color = "#ff3300"
        //         stockElemDiv.children[5].style.backgroundColor = "#ff3300"
        //         setTimeout(() => {
        //             stockElemDiv.children[2].style.color = "#fafafa"
        //             stockElemDiv.children[5].style.backgroundColor = "#2b2b2b"
        //         }, 250)
        //     }
        // }
    })
    stockElemDiv.lastElementChild.onclick = () => {
        stockElemDiv.style.opacity = "0"
        setTimeout(() => {
            stockElemDiv.remove()
        }, 250)
        updateDb(stockInfo[0], false)
    }
}

function stocksUpdateElem(stockInfo) {
    const stockElemDiv = document.getElementById(stockInfo[0])
    stockInfo.forEach((info, index) => stockElemDiv.children[index].innerHTML = info)
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
    const newsElement = document.querySelector("#news_elem_div")
    const newsArticleSelector = ".largeTitle"
    const newsTitleSelector = newsArticleSelector + " article .title"
    const newsBriefSelector = newsArticleSelector + " article .textDiv p"
    const newsTimeAgoSelector = newsArticleSelector + " article .date"
    const newsImgSelector = newsArticleSelector + " article a img"
    const newsLinkSelector = newsArticleSelector + " article > a"
    const errorMsg = "Notícias fora do ar! Nova tentativa em 1 minuto..."
    getNews(newsTitleSelector, newsBriefSelector,
        newsTimeAgoSelector, newsImgSelector,
        newsLinkSelector, refresh)
        .then(response => updateNews(newsElement, response, refresh))
        .catch(error => {
            if (error) newsElement.textContent = errorMsg
        })
}

async function getNews(newsTitleSelector, newsBriefSelector, newsTimeAgoSelector, newsImgSelector, newsLinkSelector) {
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
        for (let i = 0; i < 20; i++) {
            news.title[i] = await newsTitle[i].textContent.trim()
            news.brief[i] = await newsBrief[i].textContent.trim()
            news.timeAgo[i] = newsTimeAgo[i].textContent
            news.img[i] = await newsImg[i].getAttribute("data-src")
            if (newsLink[i].getAttribute("href")[0] === "/")
                news.link[i] = linkRoot + await newsLink[i].getAttribute("href")
            else
                news.link[i] = await newsLink[i].getAttribute("href")
        }
    }
    catch (error) {
        return error
    }
    return news
}

function updateNews(newsElement, response, refresh) {
    if (! refresh) {
        for (let i = 0; i < 20; i++) {
            const newsDiv = document.createElement("div")
            const newsH3 = document.createElement("h3")
            const newsP = document.createElement("p")
            const newsSmall = document.createElement("small")
            const newsA = document.createElement("a")
            const newsImg = document.createElement("img")
            newsElement.appendChild(newsDiv)
            newsDiv.appendChild(newsH3).textContent = response.title[i]
            newsDiv.appendChild(newsP).textContent = response.brief[i]
            newsDiv.appendChild(newsP).appendChild(newsSmall).textContent = response.timeAgo[i]
            newsDiv.appendChild(newsA).setAttribute("href", response.link[i])
            newsA.setAttribute("target", "blank_")
            newsA.appendChild(newsImg).setAttribute("src", response.img[i])
        }
    }
    else if (newsElement.firstElementChild.firstElementChild.textContent !== response.title[0]) {
        const newsH3 = newsElement.querySelector("h3")
        const newsP = newsElement.querySelector("p")
        const newsSmall = newsElement.querySelector("small")
        const newsA = newsElement.querySelector("a")
        const newsImg = newsElement.querySelector("img")
        for (let i = 0; i < 20; i++) {
            newsH3[i].textContent = response.title[i]
            newsP.textContent = response.brief[i]
            newsSmall.textContent = response.timeAgo[i]
            newsA.setAttribute("href", response.link[i])
            newsA.setAttribute("target", "blank_")
            newsImg.setAttribute("src", response.img[i])
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
setInterval(() => loadNews(true), 10000)

// =====================================================================================================================

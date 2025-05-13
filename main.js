const App = {};
window.addEventListener("load", async () => {
  App.setKeys();
  speechSynthesis.cancel();
  App.fillVoices();
  speechSynthesis.onvoiceschanged = App.fillVoices;
  App.fillRates();
  App.fillGaps();
  await App.parseContent();
  //App.pause();
  App.showItem();
});
window.addEventListener("beforeunload", () => {App.scriptWindow.close()});
App.setKeys = function() {
	document.addEventListener("keydown", function(e) {
		if (e.key === "ArrowRight") App.goNext(e.shiftKey);
		if (e.key === "ArrowLeft") App.goPrevious();
	});
};
App.fillVoices = function() {
  App.voices = speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith("en"));
  const html = App.voices.map((voice) => `<option value="${voice.name}">${voice.name}</option>`).join("");
  document.getElementById("voice").innerHTML = html;
  document.getElementById("voice").value = localStorage.getItem("voice") || "Google UK English Male";
};
App.fillRates = function() {
  let html = "";
  for (let rate = 0.5; rate <= 2; rate += 0.1) {
    html += `<option value="${rate.toFixed(2)}">&times;${rate.toFixed(1)}</option>`;
  }
  document.getElementById("rate").innerHTML = html;
  document.getElementById("rate").value = localStorage.getItem("rate") || "1.10";
};
App.fillGaps = function() {
  let html = "";
  for (let gap = 0; gap <= 2; gap += 0.1) {
    html += `<option value="${gap.toFixed(2)}">${gap.toFixed(1)}s</option>`;
  }
  document.getElementById("gap").innerHTML = html;
  document.getElementById("gap").value = localStorage.getItem("gap") || "1.00";
};
App.parseContent = async function() {
  const appURL = new URL(window.location.href);
  let contentURL = appURL.searchParams.get("c");
  if (!contentURL) contentURL = localStorage.getItem("contentURL");
  if (!contentURL) contentURL = "https://wyliebreck.github.io/videos/presence/slides.md";
  localStorage.setItem("contentURL", contentURL);
  document.querySelector("base").href = contentURL;
  const response = await fetch(contentURL);
  let content = await response.text();
  content = content.replace(/{{(.*)}}/g, `<span class="script">$1</span>`);
  content = content.replaceAll("[>]", `<button class="wait" onclick="App.goNext()">Questions?</button>`);
  let html = (new showdown.Converter()).makeHtml(content);
  html = html.split("<hr />").map((x) => `<div class="container"><div class="slide">${x}</div></div>`).join("");
  document.getElementById("slides").innerHTML = html;
  renderMathInElement(document.getElementById("slides"), {
    delimiters: [
      {left: '$$', right: '$$', display: true},
      {left: '$', right: '$', display: false},
    ],
    throwOnError: false
  });
  let positions = [];
  document.querySelectorAll("#slides .slide").forEach((slide, i) => {
    slide.querySelectorAll("script").forEach((script) => {
      let newScript = document.createElement("script");
      newScript.text = script.text;
      script.replaceWith(newScript);
    });
    slide.querySelectorAll("*").forEach((elt, j) => {
      if (elt.classList.contains("script") || elt.classList.contains("wait")) {
        positions.push([i, j, elt.textContent.length]);
      }
    });
  });
  let totalChars = positions.reduce((acc, pos) => acc + pos[2], 0);
  html = "";
  positions.forEach((pos) => {
    let width = (pos[2]/totalChars*100).toFixed(1);
    html += `<div data-slideindex="${pos[0]}" data-scriptindex="${pos[1]}" onmouseenter="App.showPreview(event)" onmouseleave="App.hidePreview()" style="width:${width}%"></div>`;
  });
  document.getElementById("positions").innerHTML = html;
  // Create script slides
  // This was removed on 1 July 2024
  /*
  document.querySelectorAll("#slides .slide").forEach((slide, i) => {
    let container = document.createElement("div");
    container.classList.add("container");
    let div = document.createElement("div");
    div.classList.add("scriptDiv");
    container.append(div);
    slide.querySelectorAll(".script").forEach(script => {
      div.append(script.cloneNode(true));
    });
    slide.closest(".container").insertAdjacentElement("afterend", container);
  });
  */
};
App.showPosition = function(item) {
  let dummy = item;
  while ((dummy = dummy.previousElementSibling)) dummy.classList.add("done");
  dummy = item;
  do dummy.classList.remove("done");
  while ((dummy = dummy.nextElementSibling));
};
App.showItem = function(item, readIt = false) {
  item = item || document.querySelector("#positions div");
  speechSynthesis.cancel();
  if (App.paused) speechSynthesis.pause();
  App.showPosition(item);
  const slideIndex = item.dataset.slideindex;
  const scriptIndex = item.dataset.scriptindex;
  localStorage.setItem("slideIndex", slideIndex);
  let container = document.querySelectorAll("#slides .container").item(slideIndex);
  let slide = container.querySelector(".slide");
  document.querySelectorAll("#slides .container").forEach((container) => container.classList.remove("selected"));
  container.classList.add("selected");
  App.showUntil(slide, scriptIndex);
  const elt = slide.querySelectorAll("*").item(scriptIndex);
  document.getElementById("caption").textContent = null;
  if (elt.classList.contains("script")) {
    document.getElementById("caption").textContent = elt.textContent;
    if (App.scriptWindow) App.scriptWindow.document.body.textContent = elt.textContent;
    if (readIt) {
      //App.readItem(item, elt.textContent);
      let utterance = new SpeechSynthesisUtterance(elt.textContent);
      utterance.voice = App.voices.find(x => x.name === document.getElementById("voice").value);
      utterance.rate = document.getElementById("rate").value*1;
      utterance.onend = async () => {
        if (document.getElementById("auto").checked) {
          let nextItem = item.nextElementSibling;
          if (nextItem) {
            let gap = document.getElementById("gap").value*1000;
            if (nextItem.dataset.slideindex > item.dataset.slideindex) gap = 1500;
            setTimeout(App.goNext, gap)
          }
          else document.getElementById("captions").classList.add("hidden");
        }
      };
      speechSynthesis.speak(utterance);
    }
  }
};
App.readItem = function(item, text) {
  let utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = App.voices.find(x => x.name === document.getElementById("voice").value);
  utterance.rate = document.getElementById("rate").value*1;
  goNext = document.getElementById("auto").checked;
  if (goNext) {
    let nextItem = item.nextElementSibling;
    if (nextItem) {
      let gap = document.getElementById("gap").value*1000;
      if (nextItem.dataset.slideindex > item.dataset.slideindex) gap = 1500;
      utterance.onend = async () => {setTimeout(App.goNext, gap)};
    }
  }
  speechSynthesis.speak(utterance);
};
App.showUntil = function(elt, index) {
  elt.querySelectorAll("*").forEach((e, i) => {
    e.style.visibility = i <= index ? "visible": "hidden";
  });
};
App.pause = function() {
  //if (App.paused) return;
  speechSynthesis.pause();
  App.paused = true;
  document.getElementById("play").onclick = App.resume;
  document.getElementById("play").textContent = "play_arrow";
};
App.resume = function() {
  if (!App.paused) return;
  speechSynthesis.resume();
  App.paused = false;
  document.getElementById("play").onclick = App.pause;
  document.getElementById("play").textContent = "pause";
};
App.refresh = async function() {
  await App.parseContent();
  const slideIndex = localStorage.getItem("slideIndex") || 0;
  const elt = document.querySelector(`#positions div[data-slideindex="${slideIndex}"]`);
  App.showItem(elt);
};
App.delay = function(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
};
App.toggleCaptions = function() {
  if (document.getElementById("captions").textContent === "subtitles") {
    document.getElementById("captions").textContent = "subtitles_off";
    document.getElementById("caption").style.visibility = "visible";
  }
  else {
    document.getElementById("captions").textContent = "subtitles";
    document.getElementById("caption").style.visibility = "hidden";
  }
};
App.showPreview = function(event) {
  const elt = event.target
  let slide = document.querySelectorAll("#slides .slide").item(elt.dataset.slideindex);
  let preview = document.getElementById("preview");
  preview.innerHTML = slide.outerHTML;
  App.showUntil(preview, elt.dataset.scriptindex);
  preview.classList.remove("hidden");
  let left = Math.max(0, event.clientX - preview.clientWidth/2);
  preview.style.left = `${left}px`;
}
App.hidePreview = function() {
  document.getElementById("preview").classList.add("hidden");
};
App.goPrevious = function(which = "item") {
  let currentItem = document.querySelector("#positions div:not([class=done])");
  while ((previousItem = currentItem.previousElementSibling)) {
    if (which === "item") {currentItem = previousItem; break;}
    if (previousItem.dataset.slideindex < currentItem.dataset.slideindex) {break;}
    currentItem = previousItem;
  }
  App.showItem(currentItem);
  //currentItem.click();
};
App.goNext = function(readIt = false) {
  const currentItem = document.querySelector("#positions div:not([class=done])");
  if (currentItem.nextElementSibling) App.showItem(currentItem.nextElementSibling, readIt); //currentItem.nextElementSibling.click();
};
App.share = function() {
  window.prompt("The URL for this video is", `https://wylieb.com/apps/1/voiceover/?c=${localStorage.getItem("contentURL")}`);
};
App.toggleMode = function() {
  if (document.getElementById("mode").textContent === "mic_none") {
    document.getElementById("mode").textContent = "mic_off";
    if (App.scriptWindow && !App.scriptWindow.closed) App.scriptWindow.focus();
    else {
      const width = 400;
      const height = 200;
      let left = window.screenLeft + window.outerWidth - width;
      let top = window.screenTop;
      let params = `left=${left},top=${top},width=${width},height=${height}`;
      App.scriptWindow = window.open("", "", params);
      App.scriptWindow.document.body.style.fontSize = 24;
      App.scriptWindow.document.title = "Voiceover script";
      App.scriptWindow.document.body.textContent = document.getElementById("caption").textContent;
    }
  }
  else {
    document.getElementById("mode").textContent = "mic_none";
    App.scriptWindow.close();
  }
};
App.saveSettings = function() {
  localStorage.setItem("voice", document.getElementById("voice").value);
  localStorage.setItem("rate", document.getElementById("rate").value);
  localStorage.setItem("gap", document.getElementById("gap").value);
};

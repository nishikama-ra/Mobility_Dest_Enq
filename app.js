const GAS_WEB_APP_URL = "";
const needsForm = document.querySelector("#needsForm");
const manageLinkForm = document.querySelector("#manageLinkForm");
const formMessage = document.querySelector("#formMessage");
const manageMessage = document.querySelector("#manageMessage");
const ideasList = document.querySelector("#ideasList");
const refreshButton = document.querySelector("#refreshButton");
const myPostsPanel = document.querySelector("#myPostsPanel");
const myPostsList = document.querySelector("#myPostsList");
const query = new URLSearchParams(window.location.search);
const manageEmail = query.get("manageEmail") || "";
const manageToken = query.get("manageToken") || "";

function isConfigured() {
  return GAS_WEB_APP_URL.startsWith("https://script.google.com/");
}

function getPageUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTitle(item) {
  const area = item.area || "地域未記入";
  const purpose = item.purposeDetail || item.purposeCategory || "移動ニーズ";
  return `${area}の${purpose}`;
}

function callJsonp(params, onSuccess, onError) {
  if (!isConfigured()) {
    onError?.("GASのWebアプリURLを設定すると利用できます。");
    return;
  }

  const callbackName = `mobilityNeedsCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const script = document.createElement("script");
  const url = new URL(GAS_WEB_APP_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("callback", callbackName);

  window[callbackName] = (payload) => {
    delete window[callbackName];
    script.remove();
    if (payload && payload.ok === false) {
      onError?.(payload.error || "処理に失敗しました。");
      return;
    }
    onSuccess(payload);
  };

  script.onerror = () => {
    delete window[callbackName];
    script.remove();
    onError?.("通信に失敗しました。時間をおいてもう一度お試しください。");
  };

  script.src = url.toString();
  document.body.appendChild(script);
}

function renderNeeds(payload) {
  const items = Array.isArray(payload) ? payload : payload.items || [];

  if (!items.length) {
    ideasList.innerHTML = '<p class="empty-state">まだ公開投稿はありません。最初の移動メモをお寄せください。</p>';
    return;
  }

  ideasList.innerHTML = items.map((item) => {
    const route = [item.fromPlace, item.toPlace].filter(Boolean).join(" → ");
    const tags = [item.timeBand, item.personType, item.purposeCategory].filter(Boolean);
    const postedBy = item.nickname || "地域の声";
    const date = item.date || item.createdAt || "";

    return `
      <article class="idea-card">
        <div class="idea-meta">
          <span>${escapeHtml(postedBy)}</span>
          ${date ? `<span>${escapeHtml(date)}</span>` : ""}
        </div>
        <h3>${escapeHtml(buildTitle(item))}</h3>
        ${route ? `<div class="idea-route"><span>${escapeHtml(route)}</span></div>` : ""}
        <p>${escapeHtml(item.story)}</p>
        ${tags.length ? `<div class="idea-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      </article>
    `;
  }).join("");
}

function loadPublicNeeds() {
  callJsonp(
    { action: "list" },
    renderNeeds,
    (message) => {
      ideasList.innerHTML = `<p class="config-warning">${escapeHtml(message)}</p>`;
    }
  );
}

function buildPostFields(item) {
  const route = [item.fromPlace, item.toPlace].filter(Boolean).join(" → ");
  return `
    <div class="idea-meta">
      <span>${escapeHtml(item.status || "有効")}</span>
      ${item.date ? `<span>${escapeHtml(item.date)}</span>` : ""}
    </div>
    <h3>${escapeHtml(buildTitle(item))}</h3>
    ${route ? `<div class="idea-route"><span>${escapeHtml(route)}</span></div>` : ""}
    <p>${escapeHtml(item.story)}</p>
    <div class="idea-tags">
      ${[item.timeBand, item.personType, item.purposeCategory].filter(Boolean).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
}

function renderMyPosts(payload) {
  const items = payload.items || [];
  myPostsPanel.hidden = false;

  if (!items.length) {
    myPostsList.innerHTML = '<p class="empty-state">このメールアドレスで確認・変更できる投稿は見つかりませんでした。</p>';
    return;
  }

  myPostsList.innerHTML = items.map((item) => `
    <article class="idea-card manage-card">
      ${buildPostFields(item)}
      <form class="inline-manage-form" method="post" target="submitFrame" novalidate>
        <input type="hidden" name="source" value="github-pages">
        <input type="hidden" name="formVersion" value="1">
        <input type="hidden" name="email" value="${escapeHtml(manageEmail)}">
        <input type="hidden" name="manageToken" value="${escapeHtml(manageToken)}">
        <input type="hidden" name="submissionId" value="${escapeHtml(item.id)}">
        <input type="hidden" name="pageUrl" value="${escapeHtml(getPageUrl())}">
        <label class="wide-field">
          <span>訂正後の具体的な場面</span>
          <textarea name="correctionStory" rows="4" maxlength="2000" placeholder="訂正する場合は、差し替えたい内容をここに入力してください。">${escapeHtml(item.story)}</textarea>
        </label>
        <div class="form-actions split-actions">
          <button type="submit" name="action" value="update">訂正する</button>
          <button class="quiet-button" type="submit" name="action" value="cancel">取消する</button>
          <p class="inline-message" role="status" aria-live="polite"></p>
        </div>
      </form>
    </article>
  `).join("");

  myPostsList.querySelectorAll(".inline-manage-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!isConfigured()) {
        event.preventDefault();
        form.querySelector(".inline-message").textContent = "GASのWebアプリURLを設定すると取消・訂正できます。";
        return;
      }
      const action = event.submitter?.value || "update";
      if (action === "update" && !form.elements.correctionStory.value.trim()) {
        event.preventDefault();
        form.querySelector(".inline-message").textContent = "訂正内容を入力してください。";
        return;
      }
      form.action = GAS_WEB_APP_URL;
      form.querySelector(".inline-message").textContent = action === "cancel" ? "取消を送信しています。" : "訂正を送信しています。";
      window.setTimeout(() => {
        form.querySelector(".inline-message").textContent = action === "cancel" ? "取消を受け付けました。確認メールを送信します。" : "訂正を受け付けました。確認メールを送信します。";
        loadPublicNeeds();
        loadMyPosts();
      }, 1200);
    });
  });
}

function loadMyPosts() {
  if (!manageEmail || !manageToken) return;
  callJsonp(
    { action: "myPosts", email: manageEmail, manageToken },
    renderMyPosts,
    (message) => {
      myPostsPanel.hidden = false;
      myPostsList.innerHTML = `<p class="config-warning">${escapeHtml(message)}</p>`;
    }
  );
}

needsForm.addEventListener("submit", (event) => {
  if (!isConfigured()) {
    event.preventDefault();
    formMessage.textContent = "GASのWebアプリURLを設定すると投稿できます。";
    return;
  }

  if (!needsForm.reportValidity()) {
    event.preventDefault();
    return;
  }

  needsForm.elements.pageUrl.value = getPageUrl();
  needsForm.action = GAS_WEB_APP_URL;
  formMessage.textContent = "送信しています。";

  window.setTimeout(() => {
    formMessage.textContent = "投稿を受け付けました。公開希望の投稿は事務局の確認後に公開されます。入力したメールアドレスへ投稿内容と確認・変更用リンクを送信します。";
    needsForm.reset();
    needsForm.querySelector('input[name="visibility"][value="public"]').checked = true;
    loadPublicNeeds();
  }, 1000);
});

manageLinkForm.addEventListener("submit", (event) => {
  if (!isConfigured()) {
    event.preventDefault();
    manageMessage.textContent = "GASのWebアプリURLを設定すると確認・変更用リンクを送れます。";
    return;
  }

  if (!manageLinkForm.reportValidity()) {
    event.preventDefault();
    return;
  }

  manageLinkForm.elements.pageUrl.value = getPageUrl();
  manageLinkForm.action = GAS_WEB_APP_URL;
  manageMessage.textContent = "確認・変更用リンクを送信しています。";

  window.setTimeout(() => {
    manageMessage.textContent = "入力したメールアドレスへ確認・変更用リンクを送信しました。メールを確認してください。";
  }, 1000);
});

refreshButton.addEventListener("click", loadPublicNeeds);
loadPublicNeeds();
loadMyPosts();

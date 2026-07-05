const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwXtXdR2JwA0Ti4ELfGDjOSx9aK4i72F0JuZ3ZmiZlE8ZPwWJmSl90KmipD-2OZObKy/exec";
const needsForm = document.querySelector("#needsForm");
const manageLinkForm = document.querySelector("#manageLinkForm");
const formMessage = document.querySelector("#formMessage");
const manageMessage = document.querySelector("#manageMessage");
const ideasList = document.querySelector("#ideasList");
const refreshButton = document.querySelector("#refreshButton");
const myPostsPanel = document.querySelector("#myPostsPanel");
const myPostsList = document.querySelector("#myPostsList");
const appToast = document.querySelector("#appToast");
const appToastMessage = document.querySelector("#appToastMessage");
const appToastClose = document.querySelector("#appToastClose");
const appToastIcon = document.querySelector("#appToastIcon");
const query = new URLSearchParams(window.location.search);
const manageEmail = query.get("manageEmail") || "";
const manageToken = query.get("manageToken") || "";


function showToast(message, kicker = "送信できました", tone = "success") {
  if (!appToast || !appToastMessage) return;
  const kickerNode = appToast.querySelector(".app-toast-kicker");
  if (kickerNode) kickerNode.textContent = kicker;
  if (appToastIcon) {
    appToastIcon.className = `app-toast-icon app-toast-icon-${tone}`;
  }
  appToastMessage.textContent = message;
  appToast.hidden = false;
}

function hideToast() {
  if (appToast) appToast.hidden = true;
}

function clearValidationMessages(form) {
  form.querySelectorAll(".field-error").forEach((node) => node.remove());
  form.querySelectorAll("[aria-invalid='true']").forEach((field) => {
    field.removeAttribute("aria-invalid");
  });
}

function getValidationMessage(field) {
  if (field.validity.valueMissing) {
    if (field.type === "checkbox") return "同意にチェックしてください。";
    if (field.tagName === "SELECT") return "選択してください。";
    return "入力してください。";
  }
  if (field.validity.typeMismatch && field.type === "email") {
    return "メールアドレスの形式で入力してください。";
  }
  if (field.validity.tooLong) {
    return `${field.maxLength}文字以内で入力してください。`;
  }
  return "入力内容を確認してください。";
}

function showFieldError(field) {
  const message = document.createElement("span");
  message.className = "field-error";
  message.textContent = getValidationMessage(field);
  field.setAttribute("aria-invalid", "true");

  if (field.type === "checkbox") {
    field.closest("label")?.append(message);
    return;
  }
  field.insertAdjacentElement("afterend", message);
}

function validateForm(form, summaryNode) {
  clearValidationMessages(form);
  const invalidFields = Array.from(form.elements).filter((field) => {
    return field instanceof HTMLElement && typeof field.checkValidity === "function" && !field.checkValidity();
  });

  if (invalidFields.length === 0) return true;
  invalidFields.forEach(showFieldError);
  if (summaryNode) {
    summaryNode.textContent = "未入力または形式が違う項目があります。赤いメッセージの箇所を確認してください。";
  }
  invalidFields[0].focus({ preventScroll: true });
  invalidFields[0].scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
}

function installValidationClear(form) {
  form.addEventListener("input", (event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement) || !field.matches("input, select, textarea")) return;
    if (!field.checkValidity()) return;
    field.removeAttribute("aria-invalid");
    const next = field.nextElementSibling;
    if (next?.classList.contains("field-error")) next.remove();
    if (field.type === "checkbox") {
      field.closest("label")?.querySelector(".field-error")?.remove();
    }
  });
  form.addEventListener("change", (event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement) || !field.matches("input, select, textarea")) return;
    if (!field.checkValidity()) return;
    field.removeAttribute("aria-invalid");
    const next = field.nextElementSibling;
    if (next?.classList.contains("field-error")) next.remove();
    if (field.type === "checkbox") {
      field.closest("label")?.querySelector(".field-error")?.remove();
    }
  });
}

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

function formatDisplayDate(value) {
  if (!value) return "";
  const text = String(value);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text.replace("T", " ").replace(/\.\d{3}Z$/, "").replace(/Z$/, "");
  }
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function purposeOptions(selectedValue) {
  return ["通勤・通学", "通院", "買い物", "習い事", "お出かけ", "その他"].map((value) => {
    const selected = value === selectedValue ? " selected" : "";
    return `<option${selected}>${escapeHtml(value)}</option>`;
  }).join("");
}

function buildTitle(item) {
  const area = item.area || "地域未記入";
  const purpose = item.purposeDetail || item.purposeCategory || "移動ニーズ";
  return `${area}の${purpose}`;
}

function buildApiUrl(params) {
  const url = new URL(GAS_WEB_APP_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function callApi(params, onSuccess, onError) {
  if (!isConfigured()) {
    onError?.("GASのWebアプリURLを設定すると利用できます。");
    return;
  }

  const url = buildApiUrl(params);
  if (window.fetch) {
    const controller = window.AbortController ? new AbortController() : null;
    const timeoutId = window.setTimeout(() => controller?.abort(), 6000);
    fetch(url.toString(), {
      cache: "no-store",
      redirect: "follow",
      signal: controller?.signal
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        window.clearTimeout(timeoutId);
        handleApiPayload(payload, onSuccess, onError);
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        callJsonp(url, onSuccess, onError);
      });
    return;
  }

  callJsonp(url, onSuccess, onError);
}

function handleApiPayload(payload, onSuccess, onError) {
  if (payload && payload.ok === false) {
    onError?.(payload.error || "処理に失敗しました。");
    return;
  }
  onSuccess(payload);
}

function callJsonp(url, onSuccess, onError) {
  const callbackName = `mobilityNeedsCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const script = document.createElement("script");
  const timeoutId = window.setTimeout(() => {
    cleanupJsonp(callbackName, script);
    onError?.("通信に失敗しました。ページを再読み込みしてもう一度お試しください。");
  }, 12000);

  window[callbackName] = (payload) => {
    window.clearTimeout(timeoutId);
    cleanupJsonp(callbackName, script);
    handleApiPayload(payload, onSuccess, onError);
  };

  script.onerror = () => {
    window.clearTimeout(timeoutId);
    cleanupJsonp(callbackName, script);
    onError?.("通信に失敗しました。ページを再読み込みしてもう一度お試しください。");
  };

  url.searchParams.set("callback", callbackName);
  url.searchParams.set("_", Date.now().toString());
  script.src = url.toString();
  document.body.appendChild(script);
}

function cleanupJsonp(callbackName, script) {
  delete window[callbackName];
  script.remove();
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
    const date = formatDisplayDate(item.createdAt || item.date || "");

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
  callApi(
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
      ${item.createdAt ? `<span>${escapeHtml(formatDisplayDate(item.createdAt))}</span>` : ""}
    </div>
    <h3>${escapeHtml(buildTitle(item))}</h3>
    ${route ? `<div class="idea-route"><span>${escapeHtml(route)}</span></div>` : ""}
    <p>${escapeHtml(item.story)}</p>
    <div class="idea-tags">
      ${[item.timeBand, item.personType, item.purposeCategory].filter(Boolean).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
}

function buildEditablePostForm(item) {
  return `
    <div class="field-grid">
      <label>
        <span>公開のしかた</span>
        <select name="visibility" required>
          <option value="public"${item.visibility === "private" ? "" : " selected"}>Webで公開してよい</option>
          <option value="private"${item.visibility === "private" ? " selected" : ""}>事務局だけに知らせる</option>
        </select>
      </label>
      <label>
        <span>どの地域では</span>
        <input name="area" required maxlength="120" value="${escapeHtml(item.area)}">
      </label>
      <label>
        <span>どの時間帯に</span>
        <input name="timeBand" required maxlength="120" value="${escapeHtml(item.timeBand)}">
      </label>
      <label>
        <span>どんな人が</span>
        <input name="personType" required maxlength="120" value="${escapeHtml(item.personType)}">
      </label>
      <label>
        <span>どんな目的で（カテゴリ）</span>
        <select name="purposeCategory" required>
          <option value="">選んでください</option>
          ${purposeOptions(item.purposeCategory)}
        </select>
      </label>
      <label>
        <span>目的の内容</span>
        <input name="purposeDetail" required maxlength="200" value="${escapeHtml(item.purposeDetail)}">
      </label>
      <label>
        <span>どこから</span>
        <input name="fromPlace" required maxlength="160" value="${escapeHtml(item.fromPlace)}">
      </label>
      <label>
        <span>どこへ</span>
        <input name="toPlace" required maxlength="160" value="${escapeHtml(item.toPlace)}">
      </label>
    </div>
    <label class="wide-field">
      <span>具体的な場面や困っていること</span>
      <textarea name="story" rows="4" required maxlength="2000">${escapeHtml(item.story)}</textarea>
    </label>
    <label class="wide-field">
      <span>ご自身のご経験ですか？あるいはどなたかにお聞きになったものでしょうか？</span>
      <input name="heardFrom" required maxlength="160" value="${escapeHtml(item.heardFrom)}">
    </label>
    <label class="wide-field">
      <span>ニックネーム（公開時の表示名）</span>
      <input name="nickname" required maxlength="80" value="${escapeHtml(item.nickname)}">
    </label>
  `;
}

function renderMyPosts(payload) {
  const items = payload.items || [];
  myPostsPanel.hidden = false;

  if (!items.length) {
    myPostsList.innerHTML = '<p class="empty-state">このメールアドレスで確認・変更できる投稿は見つかりませんでした。</p>';
    return;
  }

  myPostsList.innerHTML = items.map((item) => {
    const summaryDate = formatDisplayDate(item.createdAt || item.date || "");
    return `
    <details class="manage-post" id="post-${escapeHtml(item.id)}">
      <summary>
        <span class="manage-post-date">${escapeHtml(summaryDate || "投稿日時未記録")}</span>
        <span class="manage-post-title">${escapeHtml(buildTitle(item))}</span>
      </summary>
      <div class="idea-card manage-card">
        ${buildPostFields(item)}
      <form class="inline-manage-form" method="post" target="submitFrame" novalidate>
        <input type="hidden" name="source" value="github-pages">
        <input type="hidden" name="formVersion" value="1">
        <input type="hidden" name="email" value="${escapeHtml(manageEmail)}">
        <input type="hidden" name="manageToken" value="${escapeHtml(manageToken)}">
        <input type="hidden" name="submissionId" value="${escapeHtml(item.id)}">
        <input type="hidden" name="pageUrl" value="${escapeHtml(getPageUrl())}">
        <input type="hidden" name="correctionStory" value="${escapeHtml(item.story)}">
        ${buildEditablePostForm(item)}
        <div class="form-actions split-actions">
          <button type="submit" name="action" value="update">訂正する</button>
          <button class="quiet-button" type="submit" name="action" value="cancel">取消する</button>
          <p class="inline-message" role="status" aria-live="polite"></p>
        </div>
      </form>
      </div>
    </details>
  `;
  }).join("");

  myPostsList.querySelectorAll(".inline-manage-form").forEach((form) => {
    installValidationClear(form);
    form.addEventListener("submit", (event) => {
      if (!isConfigured()) {
        event.preventDefault();
        form.querySelector(".inline-message").textContent = "GASのWebアプリURLを設定すると取消・訂正できます。";
        return;
      }
      const action = event.submitter?.value || "update";
      if (action === "update" && !validateForm(form, form.querySelector(".inline-message"))) {
        event.preventDefault();
        return;
      }
      if (action === "update" && form.elements.correctionStory && form.elements.story) {
        form.elements.correctionStory.value = form.elements.story.value;
      }
      form.action = GAS_WEB_APP_URL;
      form.querySelector(".inline-message").textContent = action === "cancel" ? "取消を送信しています。" : "訂正を送信しています。";
      window.setTimeout(() => {
        const doneMessage = action === "cancel" ? "取消を受け付けました。確認メールを送信します。" : "訂正を受け付けました。確認メールを送信します。";
        form.querySelector(".inline-message").textContent = doneMessage;
        showToast(doneMessage, action === "cancel" ? "取消を受け付けました" : "訂正を受け付けました", action === "cancel" ? "cancel" : "edit");
        loadPublicNeeds();
        loadMyPosts();
      }, 1200);
    });
  });
}

function loadMyPosts() {
  if (!manageEmail || !manageToken) return;
  callApi(
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

  if (!validateForm(needsForm, formMessage)) {
    event.preventDefault();
    return;
  }

  needsForm.elements.pageUrl.value = getPageUrl();
  needsForm.action = GAS_WEB_APP_URL;
  formMessage.textContent = "送信しています。";

  window.setTimeout(() => {
    formMessage.textContent = "投稿を受け付けました。公開希望の投稿は事務局の確認後に公開されます。入力したメールアドレスへ投稿内容と確認・変更用リンクを送信します。";
    showToast("投稿を受け付けました。確認メールを送信します。", "投稿ありがとうございます", "success");
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

  if (!validateForm(manageLinkForm, manageMessage)) {
    event.preventDefault();
    return;
  }

  manageLinkForm.elements.pageUrl.value = getPageUrl();
  manageLinkForm.action = GAS_WEB_APP_URL;
  manageMessage.textContent = "確認・変更用リンクを送信しています。";

  window.setTimeout(() => {
    manageMessage.textContent = "入力したメールアドレスへ確認・変更用リンクを送信しました。メールを確認してください。";
    showToast("確認・変更用リンクをメールで送信しました。", "メールを確認してください", "mail");
  }, 1000);
});

appToastClose?.addEventListener("click", hideToast);
appToast?.addEventListener("click", (event) => {
  if (event.target === appToast) hideToast();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideToast();
});

installValidationClear(needsForm);
installValidationClear(manageLinkForm);
refreshButton.addEventListener("click", loadPublicNeeds);
loadPublicNeeds();
loadMyPosts();

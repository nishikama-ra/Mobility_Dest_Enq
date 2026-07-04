/**
 * 移動しやすいまち西鎌倉 投稿ボード
 *
 * GitHub Pagesから送られた投稿をGoogleスプレッドシートに保存し、
 * 事務局が承認した公開投稿だけをJSONPで返します。
 */

const HEADERS = [
  'ID',
  '受付日時',
  '更新日時',
  '取消日時',
  '記入日',
  '状態',
  '公開設定',
  '公開状態',
  'メールアドレス',
  '地域',
  '時間帯',
  '移動する人',
  '目的カテゴリ',
  '目的の内容',
  'どこから',
  'どこへ',
  '具体的な場面',
  'どなたにお聞きになりましたか',
  'ニックネーム',
  '記入者',
  '同意',
  '送信元',
  'フォーム版',
  '事務局メモ'
];

const TOKEN_HEADERS = [
  'メールアドレス',
  '管理トークン',
  '作成日時',
  '有効期限'
];

function setupMobilityNeedsBoard() {
  const existingId = PropertiesService.getScriptProperties().getProperty(CONFIG.spreadsheetIdProperty);
  if (existingId) {
    const existingSpreadsheet = SpreadsheetApp.openById(existingId);
    prepareSheet_(existingSpreadsheet);
    prepareTokenSheet_(existingSpreadsheet);
    return buildSetupResult_(existingId, false);
  }

  const spreadsheet = SpreadsheetApp.create('移動しやすいまち西鎌倉 投稿ボード');
  PropertiesService.getScriptProperties().setProperty(CONFIG.spreadsheetIdProperty, spreadsheet.getId());
  prepareSheet_(spreadsheet);
  prepareTokenSheet_(spreadsheet);
  return buildSetupResult_(spreadsheet.getId(), true);
}

function connectSpreadsheet(spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error('spreadsheetId is required.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  PropertiesService.getScriptProperties().setProperty(CONFIG.spreadsheetIdProperty, spreadsheet.getId());
  prepareSheet_(spreadsheet);
  prepareTokenSheet_(spreadsheet);
  return buildSetupResult_(spreadsheet.getId(), false);
}

function setAdminEmail(email) {
  if (!email) {
    PropertiesService.getScriptProperties().deleteProperty(CONFIG.adminEmailProperty);
    return '事務局メール通知先を既定値に戻しました: ' + CONFIG.defaultAdminEmail;
  }
  assertEmail_(email);
  PropertiesService.getScriptProperties().setProperty(CONFIG.adminEmailProperty, email);
  return '事務局メール通知先を設定しました: ' + email;
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || 'list';

  try {
    if (action === 'health') {
      return outputJson_(params.callback, { ok: true, name: 'mobility-needs-board' });
    }

    if (action === 'list') {
      return outputJson_(params.callback, { ok: true, items: getPublicNeeds_() });
    }

    if (action === 'myPosts') {
      return outputJson_(params.callback, { ok: true, items: getMyPosts_(params.email, params.manageToken) });
    }

    return outputJson_(params.callback, { ok: false, error: 'unknown action' });
  } catch (error) {
    return outputJson_(params.callback, { ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'create';

    if (action === 'requestManageLink') {
      return outputJson_(params.callback, requestManageLink_(params));
    }

    if (action === 'cancel') {
      return outputJson_(params.callback, cancelPost_(params));
    }

    if (action === 'update') {
      return outputJson_(params.callback, updatePost_(params));
    }

    const row = normalizePost_(params);
    const sheet = getSheet_();
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    const manageLink = createManageLink_(row[8], cleanText_(params.pageUrl));
    notifyAdmin_(row, 'new');
    notifyUser_(row, 'new', manageLink);
    return outputJson_(params.callback, { ok: true, id: row[0] });
  } catch (error) {
    return outputJson_(null, { ok: false, error: error.message });
  }
}

function requestManageLink_(params) {
  const email = normalizeEmail_(params.email);
  const pageUrl = cleanText_(params.pageUrl);
  assertEmail_(email);
  if (!pageUrl) {
    throw new Error('pageUrl is required.');
  }
  const link = createManageLink_(email, pageUrl);
  MailApp.sendEmail(email, '移動ニーズ投稿の確認・変更用リンク', buildManageLinkMail_(link));
  return { ok: true };
}

function getPublicNeeds_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  const header = values[0];
  const rows = values.slice(1);
  const index = buildHeaderIndex_(header);

  return rows
    .filter(function(row) {
      return row[index['状態']] === '有効' && row[index['公開設定']] === 'public' && row[index['公開状態']] === CONFIG.publicStatus;
    })
    .slice(-CONFIG.maxPublicItems)
    .reverse()
    .map(function(row) {
      return toPublicItem_(row, index);
    });
}

function getMyPosts_(email, token) {
  const normalizedEmail = normalizeEmail_(email);
  validateManageToken_(normalizedEmail, token);
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  const index = buildHeaderIndex_(values[0]);
  return values.slice(1)
    .filter(function(row) {
      return normalizeEmail_(row[index['メールアドレス']]) === normalizedEmail;
    })
    .reverse()
    .map(function(row) {
      const item = toPublicItem_(row, index);
      item.status = row[index['状態']];
      return item;
    });
}

function toPublicItem_(row, index) {
  return {
    id: row[index['ID']],
    createdAt: formatDate_(row[index['受付日時']]),
    date: row[index['記入日']] || formatDate_(row[index['受付日時']]),
    status: row[index['状態']],
    area: row[index['地域']],
    timeBand: row[index['時間帯']],
    personType: row[index['移動する人']],
    purposeCategory: row[index['目的カテゴリ']],
    purposeDetail: row[index['目的の内容']],
    fromPlace: row[index['どこから']],
    toPlace: row[index['どこへ']],
    story: row[index['具体的な場面']],
    heardFrom: row[index['どなたにお聞きになりましたか']],
    nickname: row[index['ニックネーム']] || '地域の声'
  };
}

function normalizePost_(params) {
  const now = new Date();
  const email = normalizeEmail_(params.email);
  const visibility = params.visibility === 'private' ? 'private' : 'public';
  const required = {
    area: cleanText_(params.area, 120),
    timeBand: cleanText_(params.timeBand, 120),
    personType: cleanText_(params.personType, 120),
    purposeCategory: cleanText_(params.purposeCategory, 120),
    purposeDetail: cleanText_(params.purposeDetail, 200),
    fromPlace: cleanText_(params.fromPlace, 160),
    toPlace: cleanText_(params.toPlace, 160),
    story: cleanText_(params.story, 2000),
    heardFrom: cleanText_(params.heardFrom, 160),
    nickname: cleanText_(params.nickname, 80),
    writerName: cleanText_(params.writerName, 120)
  };

  assertEmail_(email);
  assertRequired_(required.area, 'どの地域では');
  assertRequired_(required.timeBand, 'どの時間帯に');
  assertRequired_(required.personType, 'どんな人が');
  assertRequired_(required.purposeCategory, 'どんな目的で（カテゴリ）');
  assertRequired_(required.purposeDetail, '目的の内容');
  assertRequired_(required.fromPlace, 'どこから');
  assertRequired_(required.toPlace, 'どこへ');
  assertRequired_(required.story, '具体的な場面や困っていること');
  assertRequired_(required.heardFrom, 'どなたにお聞きになりましたか？');
  assertRequired_(required.nickname, 'ニックネーム（公開時の表示名）');
  assertRequired_(required.writerName, '記入者');
  if (params.consent !== 'yes') {
    throw new Error('同意が必要です。');
  }

  return [
    Utilities.getUuid(),
    now,
    '',
    '',
    formatDate_(now),
    '有効',
    visibility,
    visibility === 'public' ? CONFIG.pendingStatus : CONFIG.privateStatus,
    email,
    required.area,
    required.timeBand,
    required.personType,
    required.purposeCategory,
    required.purposeDetail,
    required.fromPlace,
    required.toPlace,
    required.story,
    required.heardFrom,
    required.nickname,
    required.writerName,
    '同意済み',
    cleanText_(params.source, 80),
    cleanText_(params.formVersion, 20),
    ''
  ];
}

function updatePost_(params) {
  const email = normalizeEmail_(params.email);
  validateManageToken_(email, params.manageToken);
  const sheet = getSheet_();
  const match = findEditableRow_(sheet, params.submissionId, email);
  const correction = cleanText_(params.correctionStory, 2000);
  if (!correction) {
    throw new Error('訂正内容を入力してください。');
  }

  const index = match.index;
  const rowNumber = match.rowNumber;
  const row = match.row;
  row[index['具体的な場面']] = correction;
  row[index['更新日時']] = new Date();
  row[index['状態']] = '有効';
  if (row[index['公開設定']] === 'public') {
    row[index['公開状態']] = CONFIG.pendingStatus;
  }
  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
  SpreadsheetApp.flush();
  const manageLink = createManageLink_(email, cleanText_(params.pageUrl));
  notifyAdmin_(row, 'update');
  notifyUser_(row, 'update', manageLink);
  return { ok: true, id: row[index['ID']], action: 'update' };
}

function cancelPost_(params) {
  const email = normalizeEmail_(params.email);
  validateManageToken_(email, params.manageToken);
  const sheet = getSheet_();
  const match = findEditableRow_(sheet, params.submissionId, email);
  const index = match.index;
  const rowNumber = match.rowNumber;
  const row = match.row;
  row[index['状態']] = '取消済み';
  row[index['公開状態']] = CONFIG.privateStatus;
  row[index['取消日時']] = new Date();
  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
  SpreadsheetApp.flush();
  const manageLink = createManageLink_(email, cleanText_(params.pageUrl));
  notifyAdmin_(row, 'cancel');
  notifyUser_(row, 'cancel', manageLink);
  return { ok: true, id: row[index['ID']], action: 'cancel' };
}

function findEditableRow_(sheet, submissionId, email) {
  const id = cleanText_(submissionId, 80);
  if (!id || !email) {
    throw new Error('投稿を特定できません。');
  }

  const values = sheet.getDataRange().getValues();
  const index = buildHeaderIndex_(values[0]);
  for (let i = 1; i < values.length; i++) {
    const row = normalizeRowLength_(values[i], HEADERS.length);
    if (row[index['ID']] === id && normalizeEmail_(row[index['メールアドレス']]) === email) {
      if (row[index['状態']] === '取消済み') {
        throw new Error('この投稿はすでに取消済みです。');
      }
      return { rowNumber: i + 1, row: row, index: index };
    }
  }
  throw new Error('投稿が見つかりません。');
}

function createManageLink_(email, pageUrl) {
  const normalizedEmail = normalizeEmail_(email);
  assertEmail_(normalizedEmail);
  const token = Utilities.getUuid();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const spreadsheet = getSpreadsheet_();
  const sheet = prepareTokenSheet_(spreadsheet);
  sheet.appendRow([normalizedEmail, token, createdAt, expiresAt]);
  SpreadsheetApp.flush();
  const baseUrl = pageUrl || 'https://example.com/';
  return baseUrl + '?manageEmail=' + encodeURIComponent(normalizedEmail) + '&manageToken=' + encodeURIComponent(token) + '#manage';
}

function validateManageToken_(email, token) {
  const normalizedEmail = normalizeEmail_(email);
  const cleanedToken = cleanText_(token, 120);
  assertEmail_(normalizedEmail);
  if (!cleanedToken) {
    throw new Error('確認・変更用リンクが無効です。');
  }

  const sheet = prepareTokenSheet_(getSpreadsheet_());
  const values = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = values.length - 1; i >= 1; i--) {
    const row = normalizeRowLength_(values[i], TOKEN_HEADERS.length);
    if (normalizeEmail_(row[0]) === normalizedEmail && row[1] === cleanedToken) {
      const expiresAt = row[3] instanceof Date ? row[3] : new Date(row[3]);
      if (expiresAt < now) {
        throw new Error('確認・変更用リンクの有効期限が切れています。もう一度メールで確認・変更用リンクを受け取ってください。');
      }
      return true;
    }
  }
  throw new Error('確認・変更用リンクが無効です。もう一度メールで確認・変更用リンクを受け取ってください。');
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(CONFIG.spreadsheetIdProperty);
  if (!spreadsheetId) {
    throw new Error('先に setupMobilityNeedsBoard を実行してください。');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getSheet_() {
  return prepareSheet_(getSpreadsheet_());
}

function prepareSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.sheetName);
  }
  prepareHeaders_(sheet, HEADERS);
  applyPublicStatusValidation_(sheet);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
  return sheet;
}


function applyPublicStatusValidation_(sheet) {
  const statusColumn = HEADERS.indexOf('公開状態') + 1;
  if (!statusColumn) {
    return;
  }
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([CONFIG.pendingStatus, CONFIG.publicStatus, CONFIG.privateStatus], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, statusColumn, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
}
function prepareTokenSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('管理リンク');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('管理リンク');
  }
  prepareHeaders_(sheet, TOKEN_HEADERS);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, TOKEN_HEADERS.length);
  return sheet;
}

function prepareHeaders_(sheet, headers) {
  const width = Math.max(headers.length, sheet.getLastColumn() || headers.length);
  const firstRow = sheet.getRange(1, 1, 1, width).getValues()[0];
  const hasHeaders = firstRow.some(function(value) { return value; });
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  const existing = firstRow.filter(function(value) { return value; });
  const missing = headers.filter(function(name) { return existing.indexOf(name) === -1; });
  if (missing.length) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
}

function normalizeRowLength_(row, length) {
  const normalized = row.slice(0, length);
  while (normalized.length < length) {
    normalized.push('');
  }
  return normalized;
}

function buildHeaderIndex_(header) {
  const index = {};
  header.forEach(function(name, i) {
    index[name] = i;
  });
  return index;
}

function outputJson_(callback, payload) {
  const json = JSON.stringify(payload);
  const body = callback ? callback + '(' + json + ');' : json;
  const mimeType = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mimeType);
}

function notifyAdmin_(row, eventType) {
  const email = getAdminEmail_();
  if (!email) {
    return;
  }

  const eventLabel = eventType === 'cancel' ? '取消' : eventType === 'update' ? '訂正' : '新規投稿';
  const subject = '移動ニーズ投稿: ' + eventLabel + ' / ' + (row[9] || '地域未記入');
  const body = [
    '移動ニーズ投稿に更新がありました。',
    '',
    '区分: ' + eventLabel,
    '投稿者メール: ' + row[8],
    '公開設定: ' + (row[6] === 'public' ? '公開希望' : '事務局のみ'),
    '公開状態: ' + row[7],
    '状態: ' + row[5],
    '地域: ' + row[9],
    '時間帯: ' + row[10],
    '移動する人: ' + row[11],
    '目的カテゴリ: ' + row[12],
    '目的の内容: ' + row[13],
    'どこから: ' + row[14],
    'どこへ: ' + row[15],
    '',
    '具体的な場面:',
    row[16],
    '',
    'どなたに聞いたか: ' + row[17],
    'ニックネーム: ' + row[18],
    '記入者: ' + row[19]
  ].join('\n');

  MailApp.sendEmail(email, subject, body);
}

function notifyUser_(row, eventType, manageLink) {
  const email = row[8];
  if (!email) {
    return;
  }
  const subject = eventType === 'cancel'
    ? '移動ニーズの投稿を取消しました'
    : eventType === 'update'
      ? '移動ニーズの投稿を訂正しました'
      : '移動ニーズの投稿を受け付けました';
  MailApp.sendEmail(email, subject, buildUserMail_(row, eventType, manageLink));
}

function buildUserMail_(row, eventType, manageLink) {
  const headline = eventType === 'cancel'
    ? '投稿を取消しました。取消済みの投稿は公開一覧には表示されません。'
    : eventType === 'update'
      ? '投稿内容を訂正しました。'
      : '移動ニーズの投稿を受け付けました。公開希望の投稿は、事務局の確認後に公開されます。';
  return [
    headline,
    '',
    '地域: ' + row[9],
    '時間帯: ' + row[10],
    '移動する人: ' + row[11],
    '目的カテゴリ: ' + row[12],
    '目的の内容: ' + row[13],
    'どこから: ' + row[14],
    'どこへ: ' + row[15],
    '',
    '内容:',
    row[16],
    '',
    '投稿の確認・訂正・取消はこちら:',
    manageLink
  ].join('\n');
}

function buildManageLinkMail_(manageLink) {
  return [
    '移動ニーズ投稿の確認・変更用リンクをお送りします。',
    '',
    'ご自身の投稿の確認・訂正・取消はこちらから行えます。',
    manageLink,
    '',
    'このリンクの有効期限は30日です。'
  ].join('\n');
}

function getAdminEmail_() {
  const configuredEmail = PropertiesService.getScriptProperties().getProperty(CONFIG.adminEmailProperty);
  return configuredEmail || CONFIG.defaultAdminEmail || '';
}

function buildSetupResult_(spreadsheetId, created) {
  return {
    created: created,
    spreadsheetId: spreadsheetId,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit',
    gasOwnerAccount: CONFIG.gasOwnerAccount,
    adminEmail: getAdminEmail_(),
    next: 'GASをWebアプリとしてデプロイし、GitHub Pages側の app.js にWebアプリURLを設定してください。'
  };
}

function cleanText_(value, maxLength) {
  const limit = maxLength || 2000;
  const text = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, limit);
  return preventFormulaInjection_(text);
}

function preventFormulaInjection_(text) {
  if (/^[=+\-@]/.test(text)) {
    return "'" + text;
  }
  return text;
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function assertRequired_(value, label) {
  if (!value) {
    throw new Error(label + 'は必須です。');
  }
}

function assertEmail_(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) {
    throw new Error('メールアドレスの形式を確認してください。');
  }
}

function formatDate_(value) {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd');
}
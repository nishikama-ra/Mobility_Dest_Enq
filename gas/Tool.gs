function setupPublicNeedsJsonEditTrigger() {
  const spreadsheet = getSpreadsheet_();
  const handlerName = 'publishPublicNeedsJsonOnEdit';

  ScriptApp.newTrigger(handlerName)
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  return '公開投稿JSON更新用の編集時トリガーを設定しました。';
}

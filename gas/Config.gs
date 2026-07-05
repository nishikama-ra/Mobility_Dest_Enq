/**
 * 移動しやすいまち西鎌倉 投稿ボード - 設定
 *
 * 事務局メールやシート名など、運用時に変わる値をまとめます。
 */

const CONFIG = {
  gasOwnerAccount: 'kazutoshi_ishikawa@nishikamakura-jichikai.com',
  defaultAdminEmail: 'kazutoshi_ishikawa@nishikamakura-jichikai.com',
  spreadsheetIdProperty: 'MOBILITY_NEEDS_SPREADSHEET_ID',
  adminEmailProperty: 'MOBILITY_NEEDS_ADMIN_EMAIL',
  adminNotifyMethodProperty: 'MOBILITY_NEEDS_ADMIN_NOTIFY_METHOD',
  teamsWebhookUrlProperty: 'TEAMS_WORKFLOW_WEBHOOK_URL',
  sheetName: '投稿',
  publicSheetName: '投稿一覧（公開可）',
  privateSheetName: '投稿一覧（公開不可）',
  publicStatus: '公開',
  pendingStatus: '承認待ち',
  privateStatus: '非公開',
  defaultAdminNotifyMethod: 'email',
  maxPublicItems: 80
};

# 初期設定手順

## 1. Google Apps Scriptを作る

1. `kazutoshi_ishikawa@nishikamakura-jichikai.com` でGoogleドライブを開き、新しいApps Scriptプロジェクトを作ります。
2. `gas/Config.gs` の内容をGASエディタの `Config.gs` に貼り付けます。
3. `gas/Code.gs` の内容をGASエディタの `Code.gs` に貼り付けます。
4. プロジェクト設定でマニフェストを表示し、`gas/appsscript.json` の内容を反映します。
5. 保存します。

## 2. 保存用スプレッドシートを作る

1. GASエディタで `setupMobilityNeedsBoard` を選びます。
2. 実行します。
3. 初回はGoogleの承認画面が出ます。内容を確認して許可します。
4. 実行結果に表示されるスプレッドシートURLを開き、事務局メンバーに共有します。投稿内容は、このスプレッドシートの `投稿` シートへ入ります。確認・変更用リンクは `管理リンク` シートへ入ります。

既存のスプレッドシートを使いたい場合は、GASエディタで次を実行します。この場合、投稿内容は指定したスプレッドシートの `投稿` シートへ入ります。

```javascript
connectSpreadsheet('スプレッドシートID')
```

## 3. 事務局メール通知を確認する

初期状態では、事務局通知先は `gas/Config.gs` の `defaultAdminEmail` です。
現在の初期値は `kazutoshi_ishikawa@nishikamakura-jichikai.com` です。

後で別メールに変える場合は、GASエディタで次を実行します。

```javascript
setAdminEmail('新しい通知先メールアドレス')
```

`Config.gs` の `defaultAdminEmail` を直接変更しても構いません。

## 4. Webアプリとしてデプロイする

1. GASエディタ右上の「デプロイ」から「新しいデプロイ」を選びます。
2. 種類は「ウェブアプリ」を選びます。
3. 実行ユーザーは「自分」、アクセスできるユーザーは「全員」にします。
4. デプロイしてWebアプリURLをコピーします。

## 5. GitHub Pages側にURLを入れる

`app.js` の先頭にある次の行へ、コピーしたWebアプリURLを入れます。

```javascript
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/xxxxxxxx/exec";
```

## 6. GitHub Pagesで公開する

GitHubリポジトリ `Mobility_Dest_Enq` に反映後、Pages 設定で公開元を `main` ブランチのルートにします。

## 運用メモ

- 入力項目はすべて必須です。未入力の投稿は画面側とGAS側の両方で受け付けません。

- 「公開してよい」の投稿は、投稿直後は「公開状態」が `承認待ち` になります。事務局が内容を確認し、「公開状態」を `公開` にするとWebに表示されます。
- 公開を止めたい投稿は、シートの「公開状態」を `非公開` に変更します。これが公開取消になります。
- 「事務局だけに知らせる」の投稿は、最初から「公開状態」が `非公開` になり、Webには表示されません。
- 投稿者はメールで届く確認・変更用リンクから、自分の投稿を確認・訂正・取消できます。
- 取消済みの投稿はWebには表示されません。
- メールアドレス、記入者、確認・変更用リンク、事務局メモはWebには表示されません。
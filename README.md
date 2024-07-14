# InfraLlmPoc
## About this repository
Amazon Bedrockを使用した画像に表示されている文字列を抽出するサービス用インフラ

## インフラOverView
<image width=80% src="./.docs/PicToTextInfraOverView.drawio.svg">

## 使用している環境
* pulumi バージョン3.124.0
* TypeScript
  * pulumi実装に使用

## クラス構成
<image width=50% src="./.docs/PicToTextInfraClass.drawio.svg">

## ローカル環境構築
docker image pulumi/pulumi-nodejs:3.124.0をdockerhubよりプル
`docker pull pulumi/pulumi-nodejs:3.124.0`
プルしたイメージをもとにコンテナ作成
```docker run --name pulumiNodeServer -d -it --mount type=bind,source={OS絶対ディレクトリ},target=/pulumi/projects pulumi/pulumi-nodejs:3.124.0 /bin/bash```
※ ローカルでデプロイまで行う場合は`--env AWS_ACCESS_KEY_ID={設定値} --env AWS_SECRET_ACCESS_KEY={設定値} --env PULUMI_ACCESS_TOKEN={設定値}` を追加
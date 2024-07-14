# InfraLlmPoc
## About this repository
Amazon Bedrockを使用した画像に表示されている文字列を抽出するサービス用インフラ

## インフラOverView
<image width=80% src="./.docs/PicToTextInfraOverView.drawio.svg">

## 使用している環境
* pulumi バージョン3.124.0
* TypeScript バージョン18.20.4
  * pulumi実装に使用
* Python バージョン3.12

## クラス構成
<image width=50% src="./.docs/PicToTextInfraClass.drawio.svg">

## ローカル環境構築

### pulumi
1. docker image pulumi/pulumi-nodejs:3.124.0をdockerhubよりプル
`docker pull pulumi/pulumi-nodejs:3.124.0`
1. プルしたイメージをもとにコンテナ作成
```docker run --name pulumiNodeServerPicToTextInfra -d -it --mount type=bind,source={OS絶対ディレクトリ},target=/pulumi/projects/InfraPidToTxt pulumi/pulumi-nodejs:3.124.0 /bin/bash```
※ ローカルでデプロイまで行う場合は`--env AWS_ACCESS_KEY_ID={設定値} --env AWS_SECRET_ACCESS_KEY={設定値} --env PULUMI_ACCESS_TOKEN={設定値}` を追加
1. 起動したコンテナにログイン
`docker exec -it pulumiNodeServerPicToTextInfra /bin/bash`
1. 以下コマンドを実行する
`pulumi install`
※ Finishedの表示後コンソールが固まるのでCtrl-Cで実行を終了する

### python
docker image python:3.12をdockerhubよりプル
`docker pull python:3.12`
プルしたイメージをもとにコンテナ作成
```docker run --name pythonServerPicToTextInfra -d -it --mount type=bind,source={OS絶対ディレクトリ},target=/home/InfraPicToTxt python:3.12 /bin/bash```
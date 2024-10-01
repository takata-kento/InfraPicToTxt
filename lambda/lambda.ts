import * as aws from "@pulumi/aws";
import * as archive from "@pulumi/archive";
import * as assert from "@pulumi/pulumi/asset";
import * as fs from "fs";
import * as path from "path";
import * as unzipper from "unzipper";
import { LogGroup } from "@pulumi/aws/cloudwatch";
import { Function } from "@pulumi/aws/lambda";

// Lambdaリソース作成クラス
export class ResourceLambda {
    /**
     * 実行ロール
     */
    private _iamRole: string;
    /**
     * Lambda関数名
     */
    private _functionName: string;
    /**
     * Lambdaソースコードファイル
     */
    private _codeFile: string;
    /**
     * CloudWatchLogs ロググループリソース
     */
    private _cloudWatchLogGroup: LogGroup | null = null;
    /**
     * リソースタグ
     */
    private _tags: aws.Tags;
    /**
     * Lambdaランタイム
     * 基本的にpythonのみを想定しているため固定
     */
    private RUNTIME = "python3.9";
    /**
     * Lambdaランタイム
     * 基本的にpythonのみを想定しているため固定
     */
    private ZIP_ARCHIVE_DIR = "./zipArchives/python/";

    /**
     * Lambdaリソースを作成するための初期化を行います。
     * @param iamRole_ ラムダ実行ロール
     * @param functionName_ Lambda関数名
     * @param codeFile_ Lambdaソースコードファイル
     */
    constructor(iamRole_: string, functionName_: string, codeFile_: string, tags_: aws.Tags) {
        this._iamRole = iamRole_;
        this._functionName = functionName_;
        this._codeFile = codeFile_;
        this._tags = tags_;
    }

    /**
     * Lambdaリソースを作成します。
     * @param provider_? CICD実行ロールにAssumeRoleするためのProvider
     * @param pythonLibsZip_ pythonの依存ライブラリを含むzipファイル
     * @returns Lambdaリソースを表すインスタンス
     */
    public create(provider_?: aws.Provider, pythonLibsZip_?: string): Function {
        const srcZipOutputPath = this.ZIP_ARCHIVE_DIR + this._functionName + ".zip";
        let srcZipArchiveFile
        if (pythonLibsZip_ === undefined) {
            srcZipArchiveFile = this.createZipFileArchive(srcZipOutputPath, this._codeFile);
        } else {
            srcZipArchiveFile = this.createZipFileArchive(srcZipOutputPath, this._codeFile, pythonLibsZip_);
        }
        const logGroupResource = this.createCloudWatchForLambda(provider_);
        const lambdaFunctionConfig = {
                code: new assert.FileArchive(srcZipOutputPath),
                name: this._functionName,
                role: this._iamRole,
                sourceCodeHash: srcZipArchiveFile.then(archive => archive.outputBase64sha256),
                handler: "lambdaFunc.lambda_handler",
                runtime: this.RUNTIME,
                loggingConfig: {
                    logFormat: "Text",
                },
                timeout: 30,
                tags: this._tags
        }

        if (provider_ === undefined) {
            const lambdaFunctionResource = new aws.lambda.Function(
                this._functionName,
                lambdaFunctionConfig,
                {
                    dependsOn: [
                        logGroupResource
                    ]
                })

            return lambdaFunctionResource;
        } else {
            const lambdaFunctionResource = new aws.lambda.Function(
                this._functionName,
                lambdaFunctionConfig,
                {
                    provider: provider_,
                    dependsOn: [
                        logGroupResource
                    ]
                })

            return lambdaFunctionResource;
        }
    }

    /**
     * Lambdaリソース用のCloudWatchロググループを作成します。
     * @param provider_? CICD実行ロールにAssumeRoleするためのProvider
     * @returns CloudWatchLogsのロググループリソースを表すインスタンス
     */
    private createCloudWatchForLambda(provider_?: aws.Provider): LogGroup{
        if (provider_ === undefined) {
            return new aws.cloudwatch.LogGroup(this._functionName,{
                name: `/aws/lambda/${this._functionName}`,
                retentionInDays: 14
            });
        } else {
            return new aws.cloudwatch.LogGroup(this._functionName,{
                name: `/aws/lambda/${this._functionName}`,
                retentionInDays: 14
            },{
                provider: provider_
            });
        }
    }

    /**
     * ソースコードファイルをzipファイルにアーカイブします。
     * @param outputPath_ zipファイルの出力先
     * @param srcFile_ ソースコードファイル
     * @param pythonLibsZip_ pythonの依存ライブラリを含むzipファイル
     * @returns zipファイルの出力結果
     */
    private createZipFileArchive(outputPath_: string, srcFile_: string, pythonLibsZip_?: string): Promise<archive.GetFileResult> {
        const wordDir = `./wordDir${this._functionName}/`
        const fileName = path.basename(srcFile_);
        fs.mkdirSync(wordDir, { recursive: true });
        fs.copyFileSync(srcFile_, wordDir + fileName);

        if (pythonLibsZip_ !== undefined && pythonLibsZip_ !== null) {
            fs.createReadStream(pythonLibsZip_)
                .pipe(unzipper.Extract({path: wordDir}))
                .promise();
        }

        const srcZipFileArchive = archive.getFile({
            type: "zip",
            sourceDir: wordDir,
            outputPath: outputPath_
        })
        return srcZipFileArchive;
    }
}

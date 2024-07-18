import * as aws from "@pulumi/aws";
import * as fs from "fs";

export class IAMRole {
    private roleName: string;
    private policyName: string;
    private policyFileName: string;
    private policyAssumeFileName: string;
    private tags: aws.Tags;

    /**
     * IAMロールを作成するための各種パラメータを設定します。
     * リソースタグは本クラスで作成される以下すべてのリソースに付けられます。
     * IAMロール/IAMポリシー
     * @param _roleName IAMロール名
     * @param _policyName IAMポリシー名
     * @param _policyFileName IAMポリシー定義ファイル名(相対パス指定)
     * @param _tags リソースタグ
     */
    constructor(_roleName: string, _policyName: string, _policyFileName: string, _policyAssumeFileName: string, _tags: aws.Tags){
        this.roleName = _roleName;
        this.policyName = _policyName;
        this.policyFileName = _policyFileName;
        this.policyAssumeFileName = _policyAssumeFileName;
        this.tags = _tags;
    }

    /**
     * IAMロールを作成します。
     * @param _provider 
     * @returns IAMロールリソース
     */
    public createIAMRole(_provider: aws.Provider): aws.iam.PolicyAttachment {
        return new aws.iam.PolicyAttachment(
            `Role_Attachment_${this.roleName}`,
            {
                name: `Role_Attachment_${this.roleName}`,
                roles: [this.createRole(_provider).name],
                policyArn: this.createPolicy(_provider).arn
            },
            {provider: _provider});
    }

    /**
     * 空のIAMロールを作成します。
     * @param _provider 
     * @returns IAMロールリソース
     */
    private createRole(_provider: aws.Provider): aws.iam.Role {
        return new aws.iam.Role(
            `Role_${this.roleName}`,
            {
                name: this.roleName,
                assumeRolePolicy: JSON.stringify(this.readPolicyJson(this.policyAssumeFileName, new Map())),
                tags: this.tags
            },
            {provider: _provider}
        );
    }

    /**
     * IAMポリシーを作成します。
     * @param _provider 
     * @returns IAMポリシーリソース
     */
    private createPolicy(_provider: aws.Provider): aws.iam.Policy {
        let iamPolicy: aws.iam.Policy;

        iamPolicy = new aws.iam.Policy(
            `Policy_${this.policyName}`,
            {
                name: this.policyName,
                policy: JSON.stringify(
                    this.readPolicyJson(
                        this.policyFileName,
                        new Map(
                            [
                                ["aws_account_id", process.env["aws_account_id"] as string]
                            ]
                        )
                    )
                ),
                tags: this.tags
            },
            {
                provider: _provider
            }
        );
        return iamPolicy;
    }

    /**
     * IAMポリシーファイルを読み込みます。
     * @param _policyFileName ポリシーJsonファイル名
     * @param _variables 変数一覧マップ<変数key: string, 値: string>
     * @returns JSONデータ
     */
    private readPolicyJson(_policyFileName: string, _variables: Map<string,string>): JSON {
        let jsonFile = fs.readFileSync(_policyFileName, "utf-8");

        _variables.forEach((value, key) => {
            let s: string = jsonFile;
            let regexp = new RegExp(`\\\${${key}}`, "g");
            jsonFile = s.replace(regexp, value);
        })

        return JSON.parse(jsonFile);
    }
}

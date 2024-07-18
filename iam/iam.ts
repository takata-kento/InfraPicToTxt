import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from "fs";
import { json } from "stream/consumers";

export class IAMRole {
    /**
     * IAMロール名
     */
    private roleName: string;

    /**
     * IAMポリシー名
     */
    private policyName: string;

    /**
     * ポリシー定義ファイル名
     */
    private policyFileName: string;

    /**
     * リソースタグ
     */
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
    constructor(_roleName: string, _policyName: string, _policyFileName: string, _tags: aws.Tags){
        this.roleName = _roleName;
        this.policyName = _policyName;
        this.policyFileName = _policyFileName;
        this.tags = _tags;
    }

    /**
     * IAMロールを作成します。
     * @param _provider 
     * @returns IAMロールリソース
     */
    public createIAMRole(_provider: aws.Provider): aws.iam.Role {
        /**
         * ToDo
         * WRITE IMPLEMENTATION
         */
        return new aws.iam.Role("",{assumeRolePolicy: ""},{});
    }

    /**
     * IAMポリシーを作成します。
     * @param _provider 
     * @returns IAMポリシーリソース
     */
    private createPolicy(_provider: aws.Provider): aws.iam.Policy {
        /**
         * ToDo
         * WRITE IMPLEMENTATION
         */
        let iamPolicy: aws.iam.Policy;

        iamPolicy = new aws.iam.Policy("",{policy: ""},{});
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
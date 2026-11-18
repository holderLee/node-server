//安装两个模块:
//1. npm install archiver@5.3.0(使用版本)
//2. npm install node-ssh@11.1.1(使用版本)
const config ={
    name: 'prod',
    ssh: {
        host: '',
        port: 22,
        username: 'root',
        password: '',
        // privateKey: 'E:/id_rsa', // ssh私钥(不使用此方法时请勿填写， 注释即可)
        passphrase: '' // ssh私钥对应解密密码(不存在设为''即可)
    },
    targetDir: 'D:/workLee/oa-mgr/dist',// 目标压缩目录(可使用相对地址) 
    targetFile: 'dist.zip',// 目标文件
    openCompress: true,// 是否开启本地压缩
    openBackUp: false,// 是否开启远端备份
    deployDir: '/data/', // 远端目录
    releaseDir: 'wwwroot' // 发布目录
}

module.exports = config
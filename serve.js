const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const multiparty = require('multiparty')
const path = require("path")

const app = express()
const LIMIT_SIZE = '1mb'; // 限制上传文件大小
const TEMP_FILE_PATH = "./temp_file" // 临时文件路径
const PORT = 3000; // 端口号

const jsonParser = bodyParser.json({
  limit: LIMIT_SIZE,
});
const urlPaser = bodyParser.urlencoded({
  extended: false,
  limit: LIMIT_SIZE,
})

// 解决跨域问题
app.all("*", (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', "*")
  res.setHeader('Access-Control-Allow-Method', "GET,POST")
  res.setHeader('Access-Control-Allow-Headers', "X-Request-With")
  res.setHeader('Access-Control-Allow-Headers', ["Content-Type", "uuid"])
  
  next();
})

// 接口入参解析
app.use(urlPaser)
app.use(jsonParser)

/**
 * 接口测试
 */
app.get('/test', (req, res) => {
  res.status(200).send('ok')
})

/**
 * 切片文件上传
 */
app.post('/upload/part', (req, res) => {
  const { uuid } = req.headers;
  const newFolderPath = path.join(__dirname, TEMP_FILE_PATH, uuid)

  try {
    fs.mkdirSync(newFolderPath)
  } catch (error) {
    // already exists.
  }
  
  const form = new multiparty.Form({
    uploadDir: newFolderPath,
  })

  form.parse(req, (err, fields, files) => {
    if(err) {
      res.status(500).end({
        code: 500,
        error: err
      });
      return;
    }

    const { index: [index], uuid: [uuid] } = fields
    const [chunk] = files.chunk;

    const folderPath = `${TEMP_FILE_PATH}/${uuid}`

    // 文件重命名
    fs.rename(chunk.path, `${folderPath}/${uuid}@@${index}`, (err) => {
      if(err) {
        console.log('RENAME ERROR', err);
        
        res.status(200).end('Rename Error: ' + err);
        return;
      }
    })

    res.send(JSON.stringify({ code: 200, msg: 'ok' }));
  })
})

/**
 * 切片文件合并
 */
app.post('/upload/part/merge', (req, res) => {
  const { uuid, name } = req.body

  mergeChunk(
    path.resolve(__dirname, TEMP_FILE_PATH, uuid),
    path.resolve(__dirname, TEMP_FILE_PATH, name),
  )

  res.send(JSON.stringify({
    code: 200,
    msg: 'success',
  }))
})

/**
 * 合并切片
 * @param {*} originDir 切片存放的目录地址
 * @param {*} targetFile 要生成的目标文件地址
 */
function mergeChunk(originDir, targetFile) {
  const fileList = fs.readdirSync(originDir)
  fileList.sort((a, b) => {
    const indexA = a.split('@@')[1]
    const indexB = b.split('@@')[1]

    return indexA - indexB;
  })
  
  // MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
  // 11 error listeners added to [WriteStream]. 
  // Use emitter.setMaxListeners() to increase limit
  // while (fileList.length) {}
  
  
  // -----------------  方式1  --------------------
  const newFileWriteableSteam = fs.createWriteStream(targetFile)
  mergeChunkSingle(fileList, originDir, newFileWriteableSteam)

  // -----------------  方式2  --------------------
  // const fList = fileList.map(i => fs.readFileSync(path.resolve(__dirname, originDir, i)))
  // const nFile = Buffer.concat(fList)
  // fs.writeFileSync(targetFile, nFile)
}

/**
 * 单个切片合并
 * @param {*} fileList 切片文件地址列表
 * @param {*} originDir 切片存放的目录地址
 * @param {*} newFileWriteableSteam 生成的目标文件地址的可写文件流
 * @returns 
 */
function mergeChunkSingle(fileList, originDir, newFileWriteableSteam){
  if(!fileList.length) {
    // 合并完成，删除切片数据存放的文件夹
    fs.rmdir(originDir, (err) => {
      err && console.log(err);
    });
    return newFileWriteableSteam.end('Merge finished.')
  }

  const listItem = path.resolve(__dirname, originDir, fileList.shift());
  const listItemReadSteam = fs.createReadStream(listItem)

  // end：是否在传输完毕后自动关闭可写流，默认为 true
  listItemReadSteam.pipe(newFileWriteableSteam, { end: false })

  // recursive 递归
  fs.rm(listItem, { recursive: true }, err => {
    if(err) {
      return err;
    }
  })

  listItemReadSteam.on('end', () => {
    mergeChunkSingle(fileList, originDir, newFileWriteableSteam)
  })
}

app.listen(PORT, () => {
  console.log('start!')
})

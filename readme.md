# large-image-cut
> ZH-CN：大文件切片上传以及在 `nodejs` 中合并  
> EN-US：Large file chunk upload and merge with `nodejs`. 


## Front End side 
> `index.html`

### 核心函数
```javascript
  /**
   * 获取切片文件数据
   */
  function getchunkFiles (file) {}


  /**
   * 上传文件变更
   */
  function handleFileChange(event) {}
```

### 逻辑设计说明
```diff
1. 通过 input 标签的 type="file" 实现获取上传文件的文件对象
2. 上传文件变更时将文件通过 getchunkFiles 函数进行切片
3. 通过 /upload/part 接口进行文件上传
4. 上传时，通过FormData格式进行上传，并在Header中 携带唯一的 uuid 和当前切片的索引
5. 所有切片上传成功后，再调用 /upload/part/merge 接口通知服务端进行合并
```

*** 

## Server side 
> `serve.js` 

### 核心函数
```javascript
/**
 * 合并切片
 * @param {*} originDir 切片存放的目录地址
 * @param {*} targetFile 要生成的目标文件地址
 */
function mergeChunk(originDir, targetFile) {}

/**
 * 单个切片合并
 * @param {*} fileList 切片文件地址列表
 * @param {*} originDir 切片存放的目录地址
 * @param {*} newFileWriteableSteam 生成的目标文件地址的可写文件流
 * @returns 
 */
function mergeChunkSingle(fileList, originDir, newFileWriteableSteam){}
```

### 逻辑设计说明

#### 切片文件上传
> `/upload/part`
```diff
1. 根据Header中的uuid在temp_file目录下创建以uuid命名的文件夹
2. 将切片文件存放于新建的文件夹
3. 保存切片文件的时候，将切片文件重命名为 uuid@@索引 的格式
```

#### 切片文件合并
> `/upload/part/merge` 
```diff
1. 当前端发起了这个接口的请求时，意味着这个文件的切片均已上传成功
2. 这个文件对应的标识是入参中的 uuid, 文件原名称和后缀是入参中的 name
3. 调用 mergeChunk 方法将指定目录的切片进行合并（注：切片需按顺序排列再合并）
4. 这里合并可以用两种方式来实现

   方式一：
  （1） 通过 fs.createWriteStream 创建一个可写文件流 newFileWriteableSteam
  （2） 然后执行 mergeChunkSingle 按顺序将切片合并到这个可写的文件流中
  （3） 合并完成后，将此切片进行删除。并执行下一个切片的合并
  （4） 当所有切片完成合并之后，将存储切片的文件夹删除

  方式二：
  （1）直接通过 fs.readFileSync 将切片读取为Buffer
  （2）然后通过 Buffer.concat 将所有切片进行合并
  （3）最后将合并后的Buffer写到新文件（文件原名称和后缀）之中
```

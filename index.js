// Lê arquivos de configuração do dotenv.
require('dotenv').config();
let AWS = require('aws-sdk');

let cred = new AWS.Credentials(process.env.AWS_KEY, process.env.AWS_SECRET);

let S3 = new AWS.S3({
  credentials: cred,
  region: process.env.AWS_REGION
});

let listParams = {
  Bucket: process.env.AWS_BUCKET,
  Prefix: process.env.AWS_PREFIX,
  MaxKeys: 1000
};

/**
 * Remove um objeto do S3 através do seu nome.
 * @param name
 */
let deleteObject = name => {
  let params = {
    Bucket: process.env.AWS_BUCKET,
    Key: name
  };

  S3.deleteObject(params, (err, data) => {
    if(err){
      console.log("Error removing file " + name);
    } else {
      console.log("Removed file " + name);
    }
  });
};

/**
 * Processa um arquivo para checar se ele deve ser mantido ou removido.
 * @param file
 */
let processSingleFile = file => {
  let name = file.Key;
  if(name.indexOf('_') !== -1){ // Checa se nome tem _ nele
    let prefix = name.split('_');
    prefix = prefix[0].replace('public/images/', '');

    let dimensions = prefix.split('x'); // Checa se o nome segue o formato NUMxNUM
    if(dimensions.length === 2 && !isNaN(dimensions[0]) && !isNaN(dimensions[1])){
      deleteObject(file.Key);
    }
  }
};

/**
 * Processa os dados do s3 até terminar de ler todos os arquivos
 * @param err
 * @param data
 */
let processDataFromS3 = (err, data) => {
  if(err){
    return;
  }

  let contents = data.Contents;
  let newParams = listParams;
  contents.forEach(processSingleFile); // Chama processSingleFile para cada arquivo lido

  if(data.IsTruncated){
    newParams.ContinuationToken = data.NextContinuationToken;
    S3.listObjectsV2(newParams, processDataFromS3);
  }
};

S3.listObjectsV2(listParams, processDataFromS3);
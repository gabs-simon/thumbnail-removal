// Lê arquivos de configuração do dotenv.
require('dotenv').config();
const AWS = require('aws-sdk');
const sharp = require('sharp');

const thumbnail_sizes = [
  {size : 'p', dimensions: '370x281'},
  {size : 'm', dimensions: '600x464'},
  {size : 'g', dimensions: '1440x600'}
];

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

let createThumbnails = name => {
  let params = {
    Bucket: process.env.AWS_BUCKET,
    Key: name
  };

  S3.getObject(params, (err1, inputImage) => {
    if(err1){
      console.log("Error retrieving image from S3");
    } else {
      thumbnail_sizes.forEach(size => {
        const sizes = size.dimensions.split('x');
        sharp(inputImage.Body)
          .resize(parseInt(sizes[0]), parseInt(sizes[1]))
          .toBuffer()
          .then(outputImage => {
            let uploadParams = Object.assign({}, params);
            uploadParams.Body = outputImage;
            uploadParams.Key = params.Key.replace('public/images/', 'public/images/' + size.size + '_');

            S3.upload(uploadParams, function(err2){
              if(err2){
                console.log("Error uploading image to S3");
              }
            });
          })
      });
    }
  })
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
  } else {
    const isOnImageFolder = name.indexOf('public/images/' !== -1);
    const isImage = (name.indexOf('.jpg') !== -1 || name.indexOf('.png') !== -1 || name.indexOf('.gif') !== -1 || name.indexOf('.jpeg') !== -1);
    if(isOnImageFolder && isImage){
      createThumbnails(name);
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